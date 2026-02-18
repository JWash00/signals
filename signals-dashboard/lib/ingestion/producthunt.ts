import { createClient } from "@/lib/supabase/server";

// Paginated query with postedAfter filter and cursor support
const POSTS_QUERY = `
query LatestPosts($first: Int!, $after: String, $postedAfter: DateTime) {
  posts(first: $first, after: $after, postedAfter: $postedAfter, order: NEWEST) {
    edges {
      node {
        id
        name
        tagline
        url
        createdAt
        votesCount
        commentsCount
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}
`;

interface PHNode {
  id: string;
  name: string;
  tagline: string;
  url: string;
  createdAt: string;
  votesCount: number;
  commentsCount: number;
}

interface PHPageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

interface PHPage {
  posts: PHNode[];
  pageInfo: PHPageInfo;
}

export interface PHIngestionResult {
  inserted: number;
  skipped: number;
}

export interface PHLiveResult {
  inserted: number;
  skipped: number;
  windowHours: number;
}

export interface PHBackfillResult {
  inserted: number;
  skipped: number;
  windowDays: number;
  pagesRun: number;
  pageSize: number;
}

// ── Shared helpers ─────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.PRODUCT_HUNT_CLIENT_ID;
  const clientSecret = process.env.PRODUCT_HUNT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Product Hunt ingestion is not configured. Add PRODUCT_HUNT_CLIENT_ID and PRODUCT_HUNT_CLIENT_SECRET to your .env.local.",
    );
  }
  return { clientId, clientSecret };
}

async function getAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetchWithTimeout(
    "https://api.producthunt.com/v2/oauth/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Product Hunt token request failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Product Hunt token response missing access_token");
  }

  return data.access_token as string;
}

async function fetchPostsPage(
  accessToken: string,
  variables: { first: number; after?: string | null; postedAfter?: string | null },
): Promise<PHPage> {
  const vars: Record<string, unknown> = { first: variables.first };
  if (variables.after) vars.after = variables.after;
  if (variables.postedAfter) vars.postedAfter = variables.postedAfter;

  const res = await fetchWithTimeout(
    "https://api.producthunt.com/v2/api/graphql",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: POSTS_QUERY, variables: vars }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Product Hunt GraphQL request failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }

  const json = await res.json();

  if (json.errors) {
    throw new Error(
      `Product Hunt GraphQL errors: ${JSON.stringify(json.errors).slice(0, 300)}`,
    );
  }

  const edges = json?.data?.posts?.edges;
  if (!Array.isArray(edges)) {
    throw new Error("Unexpected Product Hunt response shape (no edges array)");
  }

  const pageInfo: PHPageInfo = json?.data?.posts?.pageInfo ?? {
    endCursor: null,
    hasNextPage: false,
  };

  return {
    posts: edges.map((e: { node: PHNode }) => e.node),
    pageInfo,
  };
}

async function insertPosts(
  ownerId: string,
  posts: PHNode[],
): Promise<{ inserted: number; skipped: number }> {
  const supabase = await createClient();
  let inserted = 0;
  let skipped = 0;

  for (const post of posts) {
    const row = {
      owner_id: ownerId,
      source: "producthunt",
      source_id: post.id,
      source_url: post.url,
      title: post.name,
      content: post.tagline ?? "",
      engagement_proxy: {
        upvotes: post.votesCount ?? null,
        comments: post.commentsCount ?? null,
      },
      metadata: {
        created_at: post.createdAt,
      },
      status: "new",
    };

    const { error } = await supabase.from("raw_signals").insert(row);

    if (error) {
      if (error.code === "23505") {
        skipped++;
      } else {
        console.error(`PH insert error for ${post.id}:`, error.message);
        skipped++;
      }
    } else {
      inserted++;
    }
  }

  return { inserted, skipped };
}

// ── Original export (kept for backward compat) ────────────────

export async function ingestProductHuntLatest(
  ownerId: string,
): Promise<PHIngestionResult> {
  const { clientId, clientSecret } = getCredentials();
  const accessToken = await getAccessToken(clientId, clientSecret);
  const page = await fetchPostsPage(accessToken, { first: 20 });
  return insertPosts(ownerId, page.posts);
}

// ── Live: newest posts within last N hours ────────────────────

export async function ingestProductHuntLive(
  ownerId: string,
): Promise<PHLiveResult> {
  const windowHours = parseInt(
    process.env.PRODUCT_HUNT_LIVE_LOOKBACK_HOURS ?? "24",
    10,
  );
  const pageSize = parseInt(process.env.PRODUCT_HUNT_PAGE_SIZE ?? "20", 10);

  const { clientId, clientSecret } = getCredentials();
  const accessToken = await getAccessToken(clientId, clientSecret);

  const postedAfter = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();

  const page = await fetchPostsPage(accessToken, {
    first: pageSize,
    postedAfter,
  });

  const { inserted, skipped } = await insertPosts(ownerId, page.posts);
  return { inserted, skipped, windowHours };
}

// ── Backfill: older posts within last N days, paged ───────────

export async function backfillProductHuntHistorical(
  ownerId: string,
): Promise<PHBackfillResult> {
  const windowDays = parseInt(
    process.env.PRODUCT_HUNT_BACKFILL_DAYS ?? "30",
    10,
  );
  const maxPages = parseInt(
    process.env.PRODUCT_HUNT_BACKFILL_PAGES ?? "5",
    10,
  );
  const pageSize = parseInt(process.env.PRODUCT_HUNT_PAGE_SIZE ?? "20", 10);

  const { clientId, clientSecret } = getCredentials();
  const accessToken = await getAccessToken(clientId, clientSecret);

  const postedAfter = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  let totalInserted = 0;
  let totalSkipped = 0;
  let cursor: string | null = null;
  let pagesRun = 0;

  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPostsPage(accessToken, {
      first: pageSize,
      after: cursor,
      postedAfter,
    });

    pagesRun++;

    if (page.posts.length === 0) break;

    const { inserted, skipped } = await insertPosts(ownerId, page.posts);
    totalInserted += inserted;
    totalSkipped += skipped;

    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
    cursor = page.pageInfo.endCursor;
  }

  return {
    inserted: totalInserted,
    skipped: totalSkipped,
    windowDays,
    pagesRun,
    pageSize,
  };
}
