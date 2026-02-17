import { config, validateConfig, getSupabase, log, logIngestionRun } from '../lib/config.js';

validateConfig(['supabase.url', 'supabase.serviceRoleKey', 'reddit.clientId', 'reddit.clientSecret']);

const SUBREDDITS = {
  tier1: ['SaaS', 'startups', 'Entrepreneur', 'smallbusiness', 'microsaas', 'indiehackers'],
  tier2: ['webdev', 'nocode', 'selfhosted', 'automation', 'marketing', 'freelance'],
  tier3: [],
};

const PAIN_KEYWORDS = [
  'looking for', 'anyone know', 'i wish', 'frustrated with',
  'switched from', 'alternative to', 'willing to pay', 'i\'d pay',
  'shut up and take my money', 'broken', 'terrible',
  'can\'t believe there\'s no', 'spent hours', 'need a tool',
  'hate using', 'worst part about', 'dealbreaker', 'gave up on',
  'manual process', 'waste of time', 'there has to be a better',
  'does anyone else struggle', 'pain point', 'wish there was',
];

const NOISE_KEYWORDS = [
  'i built', 'just launched', 'show hn', 'self-promotion',
  'hiring', 'job posting', 'affiliate', 'sponsored',
  'check out my', 'we just released',
];

const POSTS_PER_SUBREDDIT = 25;
const MIN_UPVOTES = 3;

let redditToken = null;
let tokenExpiry = 0;

async function getRedditToken() {
  if (redditToken && Date.now() < tokenExpiry) return redditToken;

  const credentials = Buffer.from(
    `${config.reddit.clientId}:${config.reddit.clientSecret}`
  ).toString('base64');

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': config.reddit.userAgent,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`Reddit OAuth failed: ${res.status} ${res.statusText}`);

  const data = await res.json();
  redditToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
  return redditToken;
}

async function fetchSubredditPosts(subreddit, limit = POSTS_PER_SUBREDDIT) {
  const token = await getRedditToken();

  const res = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/hot?limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': config.reddit.userAgent,
      },
    }
  );

  if (!res.ok) {
    log('scout_reddit', `Failed to fetch r/${subreddit}: ${res.status}`);
    return [];
  }

  const data = await res.json();
  return (data?.data?.children || []).map(child => child.data);
}

async function fetchPostComments(subreddit, postId, limit = 50) {
  const token = await getRedditToken();

  const res = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/comments/${postId}?limit=${limit}&sort=top`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': config.reddit.userAgent,
      },
    }
  );

  if (!res.ok) return [];

  const data = await res.json();
  if (!Array.isArray(data) || data.length < 2) return [];

  return (data[1]?.data?.children || [])
    .filter(c => c.kind === 't1' && c.data?.body)
    .map(c => c.data);
}

function isPainSignal(text) {
  const lower = text.toLowerCase();
  return PAIN_KEYWORDS.some(kw => lower.includes(kw));
}

function isNoise(text) {
  const lower = text.toLowerCase();
  return NOISE_KEYWORDS.some(kw => lower.includes(kw));
}

function buildSignalFromPost(post) {
  return {
    source: 'reddit',
    source_url: `https://reddit.com${post.permalink}`,
    source_id: post.id,
    raw_text: `${post.title}\n\n${post.selftext || ''}`.trim().slice(0, 10000),
    author: post.author,
    thread_title: post.title,
    parent_context: `r/${post.subreddit}`,
    upvotes: post.ups || 0,
    comments: post.num_comments || 0,
    shares: 0,
    published_at: new Date(post.created_utc * 1000).toISOString(),
  };
}

function buildSignalFromComment(comment, postTitle, subreddit) {
  return {
    source: 'reddit',
    source_url: `https://reddit.com${comment.permalink}`,
    source_id: comment.id,
    raw_text: comment.body.trim().slice(0, 10000),
    author: comment.author,
    thread_title: postTitle,
    parent_context: `r/${subreddit}`,
    upvotes: comment.ups || 0,
    comments: 0,
    shares: 0,
    published_at: new Date(comment.created_utc * 1000).toISOString(),
  };
}

async function insertSignals(signals) {
  const sb = getSupabase();
  let inserted = 0;
  let duplicates = 0;
  let errors = [];

  for (const signal of signals) {
    const { data, error } = await sb
      .from('raw_signals')
      .upsert(signal, {
        onConflict: 'content_hash',
        ignoreDuplicates: true,
      })
      .select('id');

    if (error) {
      errors.push({ signal: signal.source_id, error: error.message });
    } else if (data && data.length > 0) {
      inserted++;
    } else {
      duplicates++;
    }
  }

  return { inserted, duplicates, errors };
}

async function scanReddit() {
  const startTime = Date.now();
  log('scout_reddit', '═══ Starting Reddit scan ═══');

  const allSubreddits = [...SUBREDDITS.tier1, ...SUBREDDITS.tier2, ...SUBREDDITS.tier3];
  let totalFound = 0;
  let totalNew = 0;
  let totalNoise = 0;
  let allErrors = [];

  for (const subreddit of allSubreddits) {
    log('scout_reddit', `Scanning r/${subreddit}...`);

    try {
      const posts = await fetchSubredditPosts(subreddit);
      let subredditSignals = [];

      for (const post of posts) {
        const postText = `${post.title} ${post.selftext || ''}`;

        if (post.ups >= MIN_UPVOTES && isPainSignal(postText) && !isNoise(postText)) {
          subredditSignals.push(buildSignalFromPost(post));
        }

        if (post.num_comments >= 10 && post.ups >= 10) {
          const comments = await fetchPostComments(subreddit, post.id, 30);

          for (const comment of comments) {
            if (comment.ups >= MIN_UPVOTES && isPainSignal(comment.body) && !isNoise(comment.body)) {
              subredditSignals.push(buildSignalFromComment(comment, post.title, subreddit));
            }
          }

          await new Promise(r => setTimeout(r, 1000));
        }
      }

      totalFound += subredditSignals.length;

      if (subredditSignals.length > 0) {
        const result = await insertSignals(subredditSignals);
        totalNew += result.inserted;
        allErrors.push(...result.errors);
        log('scout_reddit', `  r/${subreddit}: ${subredditSignals.length} signals found, ${result.inserted} new, ${result.duplicates} dupes`);
      } else {
        log('scout_reddit', `  r/${subreddit}: 0 pain signals found`);
      }

      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      log('scout_reddit', `  r/${subreddit}: ERROR — ${err.message}`);
      allErrors.push({ subreddit, error: err.message });
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  log('scout_reddit', `═══ Scan complete: ${totalFound} found, ${totalNew} new, ${duration.toFixed(1)}s ═══`);

  await logIngestionRun('scout_reddit', 'reddit', {
    found: totalFound,
    new: totalNew,
    noise: totalNoise,
    status: allErrors.length > 0 ? 'completed_with_errors' : 'completed',
    durationSeconds: duration,
    errors: allErrors,
  });

  return { found: totalFound, new: totalNew, errors: allErrors };
}

scanReddit().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
