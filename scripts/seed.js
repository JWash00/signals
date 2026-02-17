// ============================================================
// SIGNALFORGE — Seed Script
//
// Populates the database with realistic pain signals, clusters,
// and competitors for testing the full pipeline.
//
// Usage: node scripts/seed.js
//        node scripts/seed.js --clean   (wipe seed data first)
// ============================================================

import { config, validateConfig, getSupabase, log } from '../lib/config.js';

validateConfig(['supabase.url', 'supabase.serviceRoleKey']);

const sb = getSupabase();

// ─── Realistic Pain Signals ──────────────────────────────────
// Three clusters of pain: invoice reconciliation, social media scheduling, client reporting

const SIGNALS = [
  // ═══ CLUSTER 1: Invoice Reconciliation for Agencies (strong pain) ═══
  {
    source: 'reddit', source_id: 'seed_inv_01',
    source_url: 'https://reddit.com/r/SaaS/comments/seed1',
    raw_text: 'I spend 6 hours every Friday matching invoices to timesheets across 12 clients. QuickBooks on one screen, Harvest on another, a spreadsheet in between. There has to be a better way. Would happily pay $50/mo to get my Fridays back.',
    author: 'u/agency_burnout', thread_title: 'What tool do you wish existed?', parent_context: 'r/SaaS',
    upvotes: 342, comments: 91, shares: 5, published_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_inv_02',
    source_url: 'https://reddit.com/r/freelance/comments/seed2',
    raw_text: 'QuickBooks plus Harvest plus 4 spreadsheets. Every week I want to quit. Why is invoice reconciliation so painful for agencies? My bookkeeper charges me $800/mo just to sort this out and still makes mistakes.',
    author: 'u/freelance_pain', thread_title: 'Weekly rant thread', parent_context: 'r/freelance',
    upvotes: 128, comments: 37, shares: 2, published_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    source: 'youtube', source_id: 'seed_inv_03',
    source_url: 'https://youtube.com/watch?v=seed3',
    raw_text: 'Great video but honestly none of these tools handle multi-client invoicing well. I tried InvoiceX and BillMatch — both are terrible for agencies with 10+ clients. Would switch instantly if something better existed.',
    author: 'AgencyGuy42', thread_title: 'Best Invoice Tools 2026', parent_context: 'YouTube Comments',
    upvotes: 15, comments: 3, shares: 0, published_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    source: 'g2', source_id: 'seed_inv_04',
    source_url: 'https://g2.com/products/invoicex/reviews/seed4',
    raw_text: 'Rating: 2/5. No API, completely breaks our automation workflows. Support takes 3+ days to respond. We pay $79/mo for this garbage and are actively looking for alternatives. If you have more than 5 clients, avoid InvoiceX.',
    author: 'Verified User', thread_title: 'InvoiceX Review', parent_context: 'G2 Reviews',
    upvotes: 8, comments: 0, shares: 0, published_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_inv_05',
    source_url: 'https://reddit.com/r/Entrepreneur/comments/seed5',
    raw_text: 'Ran an agency for 3 years. The #1 thing that burned me out was not client work — it was the invoicing. Matching hours to invoices to payments across 15 clients with different billing cycles. I actually hired a full-time person just for this. $45K/year for something software should handle.',
    author: 'u/ex_agency_owner', thread_title: 'What finally made you quit your agency?', parent_context: 'r/Entrepreneur',
    upvotes: 567, comments: 143, shares: 12, published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_inv_06',
    source_url: 'https://reddit.com/r/smallbusiness/comments/seed6',
    raw_text: 'Does anyone else manually reconcile invoices against bank statements? I do this for 3 hours every week and my accountant says there is no tool that automates this properly for small agencies. Seems like a massive gap in the market.',
    author: 'u/smb_founder', thread_title: 'Accounting pain points', parent_context: 'r/smallbusiness',
    upvotes: 89, comments: 24, shares: 1, published_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    source: 'hacker_news', source_id: 'seed_inv_07',
    source_url: 'https://news.ycombinator.com/item?id=seed7',
    raw_text: 'I built a Zapier automation to match Stripe payments to FreshBooks invoices. Took me 2 weeks. It still breaks every month when clients change payment methods. This whole category is ripe for disruption — especially for agencies managing multiple client accounts.',
    author: 'hn_builder', thread_title: 'Ask HN: What manual process do you wish was automated?', parent_context: 'Hacker News',
    upvotes: 203, comments: 67, shares: 0, published_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_inv_08',
    source_url: 'https://reddit.com/r/microsaas/comments/seed8',
    raw_text: 'Thinking of building an invoice reconciliation tool for agencies. My wife runs a marketing agency and spends an entire day per month on this. After talking to 10 other agency owners they all have the same problem. Market seems small but willingness to pay is insane — one person said they would pay $200/mo without hesitation.',
    author: 'u/builder_dan', thread_title: 'Validating my next micro-SaaS idea', parent_context: 'r/microsaas',
    upvotes: 178, comments: 52, shares: 3, published_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    source: 'linkedin', source_id: 'seed_inv_09',
    source_url: 'https://linkedin.com/posts/seed9',
    raw_text: 'Agency owners: how much time do you spend on invoice reconciliation per week? Running a poll. So far 67% say more than 4 hours. This is broken. Someone build the solution and take my money 💰',
    author: 'Sarah Chen', thread_title: 'Invoice reconciliation poll', parent_context: 'LinkedIn',
    upvotes: 234, comments: 89, shares: 15, published_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_inv_10',
    source_url: 'https://reddit.com/r/SaaS/comments/seed10',
    raw_text: 'We switched from InvoiceX to doing it all in Google Sheets with some Apps Script automation. Honestly, the spreadsheet works better. That tells you how bad the existing tools are. Budget: we were paying $79/mo for InvoiceX and would pay up to $99/mo for something that actually works.',
    author: 'u/sheets_convert', thread_title: 'Tools you replaced with spreadsheets', parent_context: 'r/SaaS',
    upvotes: 156, comments: 41, shares: 2, published_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_inv_11',
    source_url: 'https://reddit.com/r/startups/comments/seed11',
    raw_text: 'Just cancelled BillMatch. Their multi-client feature is a joke — you have to manually switch between client views, no consolidated dashboard, and the CSV export breaks if any client name has a comma. Back to spreadsheets.',
    author: 'u/csv_hell', thread_title: 'Tools that disappointed you', parent_context: 'r/startups',
    upvotes: 94, comments: 28, shares: 0, published_at: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    source: 'twitter_x', source_id: 'seed_inv_12',
    source_url: 'https://x.com/agencycfo/status/seed12',
    raw_text: 'Hot take: the agency invoicing software market is a graveyard of bad products. InvoiceX, BillMatch, AgencyBill — all mediocre. The first team that builds a proper multi-client reconciliation engine with API integrations will print money. Proven by the $50-200/mo people already pay for garbage.',
    author: '@agencycfo', thread_title: '', parent_context: 'X/Twitter',
    upvotes: 87, comments: 19, shares: 31, published_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },

  // ═══ CLUSTER 2: Social Media Scheduling for Solopreneurs (moderate pain) ═══
  {
    source: 'reddit', source_id: 'seed_soc_01',
    source_url: 'https://reddit.com/r/SaaS/comments/seed_s1',
    raw_text: 'Buffer and Hootsuite are bloated and expensive for solo creators. I just need to schedule posts across 3 platforms with a simple calendar view. Why does this cost $50/mo?',
    author: 'u/solo_creator', thread_title: 'Overpriced tools thread', parent_context: 'r/SaaS',
    upvotes: 89, comments: 34, shares: 1, published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_soc_02',
    source_url: 'https://reddit.com/r/marketing/comments/seed_s2',
    raw_text: 'I switched from Hootsuite to Later but Later dropped their free tier. Now trying Publer but it crashes constantly. The social media scheduling space has like 50 tools and none of them work well for solo users. Looking for something under $15/mo.',
    author: 'u/marketer_mike', thread_title: 'Best budget social scheduler?', parent_context: 'r/marketing',
    upvotes: 67, comments: 45, shares: 0, published_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    source: 'youtube', source_id: 'seed_soc_03',
    source_url: 'https://youtube.com/watch?v=seed_s3',
    raw_text: 'Tried all 10 tools in this video. They all do basically the same thing. What I really want is AI that writes the posts too, not just schedules them. That would be worth paying for.',
    author: 'ContentQueen', thread_title: 'Top 10 Social Media Schedulers 2026', parent_context: 'YouTube Comments',
    upvotes: 23, comments: 5, shares: 0, published_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_soc_04',
    source_url: 'https://reddit.com/r/nocode/comments/seed_s4',
    raw_text: 'Built my own social scheduler with Make.com and Airtable. Works fine for my needs. The commercial tools are way overpriced for what they do.',
    author: 'u/nocode_builder', thread_title: 'Things I automated myself', parent_context: 'r/nocode',
    upvotes: 45, comments: 12, shares: 0, published_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_soc_05',
    source_url: 'https://reddit.com/r/SaaS/comments/seed_s5',
    raw_text: 'Social media scheduling is a commodity. There are literally 50+ tools doing the same thing. Buffer, Hootsuite, Later, Publer, SocialBee, Pallyy, Planable, Metricool, Vista Social... I could keep going. Unless you have a truly unique angle, don\'t build another one.',
    author: 'u/saas_veteran', thread_title: 'Ideas that are overdone', parent_context: 'r/SaaS',
    upvotes: 234, comments: 67, shares: 4, published_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_soc_06',
    source_url: 'https://reddit.com/r/indiehackers/comments/seed_s6',
    raw_text: 'I need a social scheduler that handles TikTok properly. Most tools still don\'t support direct TikTok publishing. Would pay $20/mo for something that does TikTok + Instagram + LinkedIn well.',
    author: 'u/tiktok_creator', thread_title: 'TikTok tools for creators', parent_context: 'r/indiehackers',
    upvotes: 56, comments: 18, shares: 0, published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },

  // ═══ CLUSTER 3: Client Reporting for Agencies (emerging) ═══
  {
    source: 'reddit', source_id: 'seed_rpt_01',
    source_url: 'https://reddit.com/r/marketing/comments/seed_r1',
    raw_text: 'I spend 2 days per month building client reports in Google Slides. Pulling data from Google Analytics, Facebook Ads, Google Ads, Mailchimp — copy paste into slides. There are tools like AgencyAnalytics but they\'re $150/mo minimum. Need something affordable.',
    author: 'u/report_slave', thread_title: 'Client reporting is killing me', parent_context: 'r/marketing',
    upvotes: 112, comments: 38, shares: 2, published_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_rpt_02',
    source_url: 'https://reddit.com/r/SaaS/comments/seed_r2',
    raw_text: 'Client reporting tools for marketing agencies are either too expensive (AgencyAnalytics, Whatagraph) or too basic (Google Looker Studio is free but clients hate the interface). The sweet spot — automated, white-labeled, under $50/mo — doesn\'t exist.',
    author: 'u/agency_reports', thread_title: 'Gap in the market?', parent_context: 'r/SaaS',
    upvotes: 78, comments: 22, shares: 1, published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    source: 'linkedin', source_id: 'seed_rpt_03',
    source_url: 'https://linkedin.com/posts/seed_r3',
    raw_text: 'Agency owners: What do you use for client reporting? We just migrated from DashThis to AgencyAnalytics and it\'s better but still $200/mo for 10 clients. The data pulling is fine but the report templates are ugly and rigid.',
    author: 'Mike Torres', thread_title: 'Agency reporting tools', parent_context: 'LinkedIn',
    upvotes: 45, comments: 31, shares: 3, published_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_rpt_04',
    source_url: 'https://reddit.com/r/Entrepreneur/comments/seed_r4',
    raw_text: 'My agency switched to automating reports with Zapier + GPT-4 + Google Slides API. Took 2 weeks to set up but saves us 20 hours/month. Still looking for a proper product though because our automation breaks every time an API changes.',
    author: 'u/automation_agency', thread_title: 'AI tools for agencies', parent_context: 'r/Entrepreneur',
    upvotes: 156, comments: 44, shares: 5, published_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    source: 'g2', source_id: 'seed_rpt_05',
    source_url: 'https://g2.com/products/agencyanalytics/reviews/seed_r5',
    raw_text: 'Rating: 3/5. AgencyAnalytics does the job but it\'s expensive for small agencies. $12 per client per month adds up fast. The SEO reporting is good but social media data is often delayed or inaccurate. Customer support is responsive though.',
    author: 'Verified User', thread_title: 'AgencyAnalytics Review', parent_context: 'G2 Reviews',
    upvotes: 5, comments: 0, shares: 0, published_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    source: 'reddit', source_id: 'seed_rpt_06',
    source_url: 'https://reddit.com/r/webdev/comments/seed_r6',
    raw_text: 'Frustrated with client reporting. Built a custom dashboard with Next.js + Tremor + Google Analytics API. Works great for my 5 clients but not scalable. Wish there was an open-source or affordable white-label solution I could just customize.',
    author: 'u/dev_agency', thread_title: 'Tools you built for your agency', parent_context: 'r/webdev',
    upvotes: 67, comments: 19, shares: 0, published_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

// ─── Competitors ─────────────────────────────────────────────

const COMPETITORS = {
  invoicing: [
    {
      name: 'InvoiceX', url: 'https://invoicex.com',
      pricing: { free_tier: false, entry: '$49/mo', mid: '$99/mo', enterprise: 'Custom' },
      g2_rating: 3.4, monthly_traffic: 12000,
      top_complaints: ['No API', 'Slow support (3+ day response)', 'No multi-client dashboard', 'CSV exports break', 'Outdated UI'],
      missing_features: ['API access', 'Multi-client consolidated view', 'Harvest integration', 'Auto-reconciliation', 'Bank feed sync'],
      estimated_mrr: '$50K-$100K', vulnerability_assessment: 'High — users actively seeking alternatives, no API locks them out of automation workflows',
    },
    {
      name: 'BillMatch', url: 'https://billmatch.io',
      pricing: { free_tier: true, entry: '$39/mo', mid: '$79/mo' },
      g2_rating: 3.7, monthly_traffic: 8000,
      top_complaints: ['US only', 'No multi-currency', 'Clunky UI', 'Client switching is manual', 'Limited integrations'],
      missing_features: ['Multi-currency support', 'International invoicing', 'Modern UI', 'Consolidated dashboard', 'QuickBooks sync'],
      estimated_mrr: '$30K-$60K', vulnerability_assessment: 'Moderate — limited to US market, clunky UX, but has loyal user base',
    },
    {
      name: 'AgencyBill Pro', url: 'https://agencybill.pro',
      pricing: { free_tier: false, entry: '$69/mo', mid: '$149/mo', enterprise: '$299/mo' },
      g2_rating: 3.9, monthly_traffic: 5000,
      top_complaints: ['Expensive for small agencies', 'Complex onboarding', 'Overkill for <10 clients'],
      missing_features: ['Simpler pricing tier', 'Quick setup wizard', 'Stripe integration'],
      estimated_mrr: '$20K-$40K', vulnerability_assessment: 'Low-moderate — good product but overpriced for the SMB segment',
    },
  ],
  social: [
    {
      name: 'Buffer', url: 'https://buffer.com',
      pricing: { free_tier: true, entry: '$6/mo/channel', mid: '$12/mo/channel' },
      g2_rating: 4.3, monthly_traffic: 850000,
      top_complaints: ['Gets expensive with many channels', 'Analytics are basic', 'No TikTok direct publish'],
      missing_features: ['AI content generation', 'Advanced analytics', 'TikTok direct publishing'],
      estimated_mrr: '$2M-$5M', vulnerability_assessment: 'Very low — strong brand, loyal users, well-funded',
    },
    {
      name: 'Hootsuite', url: 'https://hootsuite.com',
      pricing: { free_tier: false, entry: '$99/mo', mid: '$249/mo' },
      g2_rating: 4.2, monthly_traffic: 1200000,
      top_complaints: ['Expensive', 'Bloated interface', 'Slow', 'Per-seat pricing is brutal'],
      missing_features: ['Affordable solo plan', 'Faster interface', 'Better mobile app'],
      estimated_mrr: '$10M+', vulnerability_assessment: 'Very low — enterprise incumbent with massive market share',
    },
    {
      name: 'Later', url: 'https://later.com',
      pricing: { free_tier: false, entry: '$25/mo', mid: '$45/mo' },
      g2_rating: 4.4, monthly_traffic: 600000,
      top_complaints: ['Killed free tier', 'Instagram-focused', 'Limited LinkedIn features'],
      missing_features: ['Free tier', 'Better LinkedIn support', 'AI writing assistant'],
      estimated_mrr: '$3M-$8M', vulnerability_assessment: 'Very low — well-established with strong Instagram user base',
    },
    {
      name: 'Publer', url: 'https://publer.io',
      pricing: { free_tier: true, entry: '$12/mo', mid: '$21/mo' },
      g2_rating: 4.5, monthly_traffic: 200000,
      top_complaints: ['Crashes frequently', 'Customer support is slow', 'Analytics delayed'],
      missing_features: ['Stability improvements', 'Better analytics', 'Faster support'],
      estimated_mrr: '$500K-$1M', vulnerability_assessment: 'Low — affordable and popular despite stability issues',
    },
    {
      name: 'SocialBee', url: 'https://socialbee.com',
      pricing: { free_tier: false, entry: '$29/mo', mid: '$49/mo' },
      g2_rating: 4.5, monthly_traffic: 150000,
      top_complaints: ['Learning curve', 'No free trial long enough', 'Category system confusing'],
      missing_features: ['Simpler UX', 'Longer free trial', 'Better onboarding'],
      estimated_mrr: '$400K-$800K', vulnerability_assessment: 'Low — strong product with category-based scheduling niche',
    },
  ],
  reporting: [
    {
      name: 'AgencyAnalytics', url: 'https://agencyanalytics.com',
      pricing: { free_tier: false, entry: '$79/mo (5 clients)', mid: '$179/mo (15 clients)', enterprise: 'Custom' },
      g2_rating: 4.7, monthly_traffic: 95000,
      top_complaints: ['Expensive per client', 'Social data delayed', 'Report templates rigid', 'Ugly default templates'],
      missing_features: ['Affordable small agency tier', 'Better social media data', 'Flexible report designer', 'AI-generated insights'],
      estimated_mrr: '$1M-$3M', vulnerability_assessment: 'Low — market leader but pricing creates opening for budget alternative',
    },
    {
      name: 'Whatagraph', url: 'https://whatagraph.com',
      pricing: { free_tier: false, entry: '$199/mo', mid: '$'+'299/mo' },
      g2_rating: 4.5, monthly_traffic: 45000,
      top_complaints: ['Very expensive', 'Overkill for small agencies', 'Steep learning curve'],
      missing_features: ['Affordable tier', 'Simpler setup', 'Better mobile view'],
      estimated_mrr: '$500K-$1.5M', vulnerability_assessment: 'Moderate — priced out of SMB market entirely',
    },
    {
      name: 'DashThis', url: 'https://dashthis.com',
      pricing: { free_tier: false, entry: '$49/mo (3 dashboards)', mid: '$149/mo (10 dashboards)' },
      g2_rating: 4.5, monthly_traffic: 35000,
      top_complaints: ['Dashboard limit is annoying', 'Limited customization', 'Dated design'],
      missing_features: ['Unlimited dashboards', 'Modern design', 'AI summaries', 'White-label email delivery'],
      estimated_mrr: '$300K-$800K', vulnerability_assessment: 'Moderate — dated product with per-dashboard pricing frustration',
    },
  ],
};

// ─── Seed Functions ──────────────────────────────────────────

async function cleanSeedData() {
  log('seed', 'Cleaning existing seed data...');

  // Delete in dependency order
  await sb.from('alerts').delete().like('title', '%seed%');
  await sb.from('alerts').delete().like('title', '%Invoice Reconciliation%');
  await sb.from('alerts').delete().like('title', '%Social Media Scheduling%');
  await sb.from('alerts').delete().like('title', '%Client Reporting%');
  await sb.from('scoring_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb.from('opportunities').delete().like('title', '%Invoice Reconciliation%');
  await sb.from('opportunities').delete().like('title', '%Social Media Scheduling%');
  await sb.from('opportunities').delete().like('title', '%Client Reporting%');
  await sb.from('competitors').delete().in('name', [
    'InvoiceX', 'BillMatch', 'AgencyBill Pro',
    'Buffer', 'Hootsuite', 'Later', 'Publer', 'SocialBee',
    'AgencyAnalytics', 'Whatagraph', 'DashThis',
  ]);

  // Remove signals by seed source_id
  await sb.from('raw_signals').delete().like('source_id', 'seed_%');

  // Remove seed clusters
  await sb.from('pain_clusters').delete().like('slug', 'seed-%');

  log('seed', '✓ Seed data cleaned');
}

async function insertSignals() {
  log('seed', `Inserting ${SIGNALS.length} pain signals...`);

  let inserted = 0;
  for (const signal of SIGNALS) {
    const { data, error } = await sb
      .from('raw_signals')
      .upsert(signal, { onConflict: 'content_hash', ignoreDuplicates: true })
      .select('id');

    if (error) {
      log('seed', `  Error inserting ${signal.source_id}: ${error.message}`);
    } else if (data && data.length > 0) {
      inserted++;
    }
  }

  log('seed', `✓ ${inserted} signals inserted`);
  return inserted;
}

async function createClusters() {
  log('seed', 'Creating pain clusters...');

  const clusters = [
    {
      title: 'Invoice Reconciliation for Agencies',
      slug: 'seed-invoice-reconciliation-agencies',
      description: 'Agency owners spending hours weekly matching invoices to timesheets across multiple clients, tools (QuickBooks, Harvest, Stripe), and billing cycles. Existing tools lack multi-client dashboards, APIs, and automation.',
      pain_category: 'workflow_friction',
      first_seen: new Date(Date.now() - 30 * 86400000).toISOString(),
      last_seen: new Date().toISOString(),
    },
    {
      title: 'Social Media Scheduling for Solopreneurs',
      slug: 'seed-social-scheduling-solopreneurs',
      description: 'Solo creators frustrated by expensive, bloated social media scheduling tools. Want simple, affordable multi-platform scheduling under $15/mo with TikTok support.',
      pain_category: 'cost_complaint',
      first_seen: new Date(Date.now() - 45 * 86400000).toISOString(),
      last_seen: new Date().toISOString(),
    },
    {
      title: 'Client Reporting for Marketing Agencies',
      slug: 'seed-client-reporting-agencies',
      description: 'Marketing agencies spending days building client reports manually from multiple data sources. Existing tools are either too expensive ($150+/mo) or too basic (Looker Studio). Sweet spot of automated, white-labeled, affordable reporting does not exist.',
      pain_category: 'workflow_friction',
      first_seen: new Date(Date.now() - 15 * 86400000).toISOString(),
      last_seen: new Date().toISOString(),
    },
  ];

  const clusterIds = [];

  for (const cluster of clusters) {
    const { data, error } = await sb
      .from('pain_clusters')
      .insert(cluster)
      .select('id, title')
      .single();

    if (error) {
      log('seed', `  Error creating cluster "${cluster.title}": ${error.message}`);
      // Try to find existing
      const { data: existing } = await sb
        .from('pain_clusters')
        .select('id, title')
        .eq('slug', cluster.slug)
        .single();
      if (existing) clusterIds.push(existing);
    } else {
      clusterIds.push(data);
      log('seed', `  ✓ Cluster: "${data.title}" (${data.id})`);
    }
  }

  return clusterIds;
}

async function assignSignalsToClusters(clusterIds) {
  log('seed', 'Assigning signals to clusters...');

  const invoiceCluster = clusterIds.find(c => c.title.includes('Invoice'));
  const socialCluster = clusterIds.find(c => c.title.includes('Social'));
  const reportingCluster = clusterIds.find(c => c.title.includes('Reporting'));

  if (invoiceCluster) {
    const { error } = await sb
      .from('raw_signals')
      .update({ cluster_id: invoiceCluster.id, is_processed: true, is_noise: false })
      .like('source_id', 'seed_inv_%');
    if (!error) log('seed', `  ✓ 12 signals → Invoice Reconciliation cluster`);
  }

  if (socialCluster) {
    const { error } = await sb
      .from('raw_signals')
      .update({ cluster_id: socialCluster.id, is_processed: true, is_noise: false })
      .like('source_id', 'seed_soc_%');
    if (!error) log('seed', `  ✓ 6 signals → Social Media Scheduling cluster`);
  }

  if (reportingCluster) {
    const { error } = await sb
      .from('raw_signals')
      .update({ cluster_id: reportingCluster.id, is_processed: true, is_noise: false })
      .like('source_id', 'seed_rpt_%');
    if (!error) log('seed', `  ✓ 6 signals → Client Reporting cluster`);
  }
}

async function insertCompetitors(clusterIds) {
  log('seed', 'Inserting competitor profiles...');

  const invoiceCluster = clusterIds.find(c => c.title.includes('Invoice'));
  const socialCluster = clusterIds.find(c => c.title.includes('Social'));
  const reportingCluster = clusterIds.find(c => c.title.includes('Reporting'));

  const insertComps = async (clusterId, comps) => {
    for (const comp of comps) {
      const { error } = await sb
        .from('competitors')
        .upsert({ ...comp, cluster_id: clusterId }, { onConflict: 'cluster_id,url' });
      if (error) log('seed', `  Error inserting ${comp.name}: ${error.message}`);
    }
  };

  if (invoiceCluster) {
    await insertComps(invoiceCluster.id, COMPETITORS.invoicing);
    log('seed', `  ✓ ${COMPETITORS.invoicing.length} competitors → Invoice Reconciliation`);
  }

  if (socialCluster) {
    await insertComps(socialCluster.id, COMPETITORS.social);
    log('seed', `  ✓ ${COMPETITORS.social.length} competitors → Social Media Scheduling`);
  }

  if (reportingCluster) {
    await insertComps(reportingCluster.id, COMPETITORS.reporting);
    log('seed', `  ✓ ${COMPETITORS.reporting.length} competitors → Client Reporting`);
  }
}

async function updateClusterAggregates(clusterIds) {
  log('seed', 'Updating cluster aggregates...');

  for (const cluster of clusterIds) {
    // The trigger should have fired, but let's also manually update some fields
    // that depend on time-based calculations
    const { data: signals } = await sb
      .from('raw_signals')
      .select('source, engagement_score, upvotes, comments, published_at, raw_text')
      .eq('cluster_id', cluster.id)
      .eq('is_noise', false);

    if (!signals || signals.length === 0) continue;

    const platforms = [...new Set(signals.map(s => s.source))];
    const avgEngagement = signals.reduce((sum, s) => sum + (s.engagement_score || 0), 0) / signals.length;

    // Calculate velocity (signals in last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const velocity7d = signals.filter(s => new Date(s.published_at).getTime() > sevenDaysAgo).length;
    const velocity30d = signals.filter(s => new Date(s.published_at).getTime() > thirtyDaysAgo).length;

    // Top quotes by engagement
    const topQuotes = signals
      .sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
      .slice(0, 10)
      .map(s => ({
        text: s.raw_text.slice(0, 300),
        source: s.source,
        engagement: s.engagement_score,
      }));

    const velocityTrend = velocity7d > (velocity30d / 4) * 1.5 ? 'accelerating'
      : velocity7d < (velocity30d / 4) * 0.5 ? 'decelerating' : 'stable';

    const { error } = await sb
      .from('pain_clusters')
      .update({
        signal_count: signals.length,
        platforms: platforms,
        platform_count: platforms.length,
        avg_engagement: Math.round(avgEngagement),
        avg_intensity: 7.5, // estimated for seed data
        velocity_7d: velocity7d,
        velocity_30d: velocity30d,
        velocity_trend: velocityTrend,
        wtp_ratio: 0.35, // estimated for seed data
        top_quotes: topQuotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cluster.id);

    if (!error) {
      log('seed', `  ✓ "${cluster.title}": ${signals.length} signals, ${platforms.length} platforms, velocity: ${velocity7d}/week (${velocityTrend})`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────

async function runSeed() {
  const startTime = Date.now();
  const args = process.argv.slice(2);

  log('seed', '═══ SignalForge Seed Script ═══');

  if (args.includes('--clean')) {
    await cleanSeedData();
  }

  // 1. Insert signals
  await insertSignals();

  // 2. Create clusters
  const clusterIds = await createClusters();

  // 3. Assign signals to clusters
  await assignSignalsToClusters(clusterIds);

  // 4. Insert competitors
  await insertCompetitors(clusterIds);

  // 5. Update cluster aggregates
  await updateClusterAggregates(clusterIds);

  const duration = (Date.now() - startTime) / 1000;
  log('seed', `\n═══ Seed complete (${duration.toFixed(1)}s) ═══`);
  log('seed', `\nYour database now has 3 test clusters ready for scoring:`);
  log('seed', `  1. Invoice Reconciliation for Agencies — 12 signals, 5 platforms, strong pain + WTP (should score HIGH)`);
  log('seed', `  2. Social Media Scheduling for Solopreneurs — 6 signals, 2 platforms, moderate pain, SATURATED market (should score LOW)`);
  log('seed', `  3. Client Reporting for Marketing Agencies — 6 signals, 3 platforms, emerging pain, pricing gap (should score MEDIUM)`);
  log('seed', `\nNext steps:`);
  log('seed', `  1. node agents/scorer.js    → Score all three clusters`);
  log('seed', `  2. node agents/scribe.js    → Generate daily briefing`);
}

runSeed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
