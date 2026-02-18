import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Paginated query with postedAfter filter, cursor, and configurable order
const POSTS_QUERY = `
query LatestPosts($first: Int!, $after: String, $postedAfter: DateTime, $order: PostsOrder) {
  posts(first: $first, after: $after, postedAfter: $postedAfter, order: $order) {
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

// Ingestion context stored in raw_signals.metadata so /review can show it
interface IngestionContext {
  ph_mode: "LIVE" | "TODAY" | "BACKFILL";
  ph_window: string; // e.g. "24h", "today", "30d"
}

export interface PHIngestionResult {
  inserted: number;
  skipped: number;
  invalid: number;
}

export interface PHLiveResult {
  inserted: number;
  skipped: number;
  invalid: number;
  fetched: number;
  mode: "LIVE";
  windowLabel: string;
}

export interface PHTodayResult {
  inserted: number;
  skipped: number;
  invalid: number;
  fetched: number;
  mode: "TODAY";
  windowLabel: string;
  note?: string;
}

export interface PHBackfillResult {
  inserted: number;
  skipped: number;
  invalid: number;
  fetched: number;
  mode: "BACKFILL";
  windowLabel: string;
  pagesRun: number;
  backfillComplete: boolean;
}

// ── Ingestion state helpers ───────────────────────────────────

interface IngestionState {
  last_success_at: string | null;
  cursor: string | null;
}

async function getIngestionState(
  supabase: SupabaseClient,
  ownerId: string,
  source: string,
  mode: string,
): Promise<IngestionState> {
  const { data } = await supabase
    .from("ingestion_state")
    .select("last_success_at, cursor")
    .eq("owner_id", ownerId)
    .eq("source", source)
    .eq("mode", mode)
    .maybeSingle();

  return {
    last_success_at: data?.last_success_at ?? null,
    cursor: data?.cursor ?? null,
  };
}

async function upsertIngestionState(
  supabase: SupabaseClient,
  ownerId: string,
  source: string,
  mode: string,
  updates: { last_success_at?: string; cursor?: string | null },
): Promise<void> {
  await supabase
    .from("ingestion_state")
    .upsert(
      {
        owner_id: ownerId,
        source,
        mode,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,source,mode" },
    );
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
  variables: {
    first: number;
    after?: string | null;
    postedAfter?: string | null;
    order?: string;
  },
): Promise<PHPage> {
  const vars: Record<string, unknown> = {
    first: variables.first,
    order: variables.order ?? "NEWEST",
  };
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
  ctx: IngestionContext,
  supabaseClient?: SupabaseClient,
): Promise<{ inserted: number; skipped: number; invalid: number }> {
  const supabase = supabaseClient ?? (await createClient());
  let inserted = 0;
  let skipped = 0;
  let invalid = 0;

  for (const post of posts) {
    // Hard guard: never insert a row with null source_id
    if (!post.id) {
      console.warn("PH skip: post missing id", post.name ?? "(no name)");
      invalid++;
      continue;
    }

    const row = {
      owner_id: ownerId,
      source: "product_hunt",
      source_id: String(post.id),
      source_url: post.url,
      title: post.name,
      content: post.tagline ?? "",
      engagement_proxy: {
        upvotes: post.votesCount ?? null,
        comments: post.commentsCount ?? null,
      },
      metadata: {
        created_at: post.createdAt,
        ph_mode: ctx.ph_mode,
        ph_window: ctx.ph_window,
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

  return { inserted, skipped, invalid };
}

// ── Original export (kept for backward compat) ────────────────

export async function ingestProductHuntLatest(
  ownerId: string,
  supabaseClient?: SupabaseClient,
): Promise<PHIngestionResult> {
  const { clientId, clientSecret } = getCredentials();
  const accessToken = await getAccessToken(clientId, clientSecret);
  const page = await fetchPostsPage(accessToken, { first: 20 });
  return insertPosts(ownerId, page.posts, {
    ph_mode: "LIVE",
    ph_window: "latest",
  }, supabaseClient);
}

// ── LIVE: newest posts since last successful run ──────────────

export async function ingestProductHuntLive(
  ownerId: string,
  supabaseClient?: SupabaseClient,
): Promise<PHLiveResult> {
  const windowHours = parseInt(
    process.env.PRODUCT_HUNT_LIVE_LOOKBACK_HOURS ?? "24",
    10,
  );
  const pageSize = parseInt(process.env.PRODUCT_HUNT_PAGE_SIZE ?? "20", 10);
  const maxPages = 5;

  const supabase = supabaseClient ?? (await createClient());
  const state = await getIngestionState(supabase, ownerId, "product_hunt", "live");

  const { clientId, clientSecret } = getCredentials();
  const accessToken = await getAccessToken(clientId, clientSecret);

  // Use last_success_at if available, else fall back to lookback window
  const fallback = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();
  const postedAfter = state.last_success_at ?? fallback;

  const windowLabel = state.last_success_at
    ? `since ${new Date(state.last_success_at).toISOString().slice(0, 16)}Z`
    : `${windowHours}h`;

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalInvalid = 0;
  let totalFetched = 0;
  let cursor: string | null = null;

  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPostsPage(accessToken, {
      first: pageSize,
      after: cursor,
      postedAfter,
      order: "NEWEST",
    });

    totalFetched += page.posts.length;

    if (page.posts.length === 0) break;

    const { inserted, skipped, invalid } = await insertPosts(
      ownerId, page.posts,
      { ph_mode: "LIVE", ph_window: windowLabel },
      supabase,
    );
    totalInserted += inserted;
    totalSkipped += skipped;
    totalInvalid += invalid;

    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
    cursor = page.pageInfo.endCursor;
  }

  // Mark success — even if inserted=0, advance the watermark
  await upsertIngestionState(supabase, ownerId, "product_hunt", "live", {
    last_success_at: new Date().toISOString(),
  });

  return {
    inserted: totalInserted,
    skipped: totalSkipped,
    invalid: totalInvalid,
    fetched: totalFetched,
    mode: "LIVE",
    windowLabel,
  };
}

// ── TODAY: newest posts since midnight UTC ─────────────────────

export async function ingestProductHuntTodaysWinners(
  ownerId: string,
  supabaseClient?: SupabaseClient,
): Promise<PHTodayResult> {
  const pageSize = parseInt(process.env.PRODUCT_HUNT_PAGE_SIZE ?? "20", 10);

  const supabase = supabaseClient ?? (await createClient());

  const { clientId, clientSecret } = getCredentials();
  const accessToken = await getAccessToken(clientId, clientSecret);

  // Start of today UTC
  const now = new Date();
  const todayUtcStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();

  // Try VOTES order for top-ranked posts today.
  // If VOTES isn't supported, the API will return an error and we fall back to NEWEST.
  let page: PHPage;
  let note: string | undefined;
  try {
    page = await fetchPostsPage(accessToken, {
      first: pageSize,
      postedAfter: todayUtcStart,
      order: "VOTES",
    });
  } catch {
    // VOTES order not supported — fall back to NEWEST for today
    page = await fetchPostsPage(accessToken, {
      first: pageSize,
      postedAfter: todayUtcStart,
      order: "NEWEST",
    });
    note = "Sorted by newest (VOTES order not available). Results are today's posts, newest first.";
  }

  const windowLabel = "today";
  const fetched = page.posts.length;
  const { inserted, skipped, invalid } = await insertPosts(
    ownerId, page.posts,
    { ph_mode: "TODAY", ph_window: windowLabel },
    supabase,
  );

  // Mark success
  await upsertIngestionState(supabase, ownerId, "product_hunt", "today", {
    last_success_at: new Date().toISOString(),
  });

  return { inserted, skipped, invalid, fetched, mode: "TODAY", windowLabel, note };
}

// ── BACKFILL: older posts within last N days, resumes cursor ──

export async function backfillProductHuntHistorical(
  ownerId: string,
  supabaseClient?: SupabaseClient,
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

  const supabase = supabaseClient ?? (await createClient());
  const state = await getIngestionState(supabase, ownerId, "product_hunt", "backfill");

  const { clientId, clientSecret } = getCredentials();
  const accessToken = await getAccessToken(clientId, clientSecret);

  const postedAfter = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const windowLabel = `${windowDays}d`;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalInvalid = 0;
  let totalFetched = 0;
  // Resume from saved cursor if available
  let cursor: string | null = state.cursor;
  let pagesRun = 0;
  let backfillComplete = false;

  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPostsPage(accessToken, {
      first: pageSize,
      after: cursor,
      postedAfter,
      order: "NEWEST",
    });

    pagesRun++;
    totalFetched += page.posts.length;

    if (page.posts.length === 0) {
      backfillComplete = true;
      break;
    }

    const { inserted, skipped, invalid } = await insertPosts(
      ownerId, page.posts,
      { ph_mode: "BACKFILL", ph_window: windowLabel },
      supabase,
    );
    totalInserted += inserted;
    totalSkipped += skipped;
    totalInvalid += invalid;

    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) {
      backfillComplete = true;
      break;
    }
    cursor = page.pageInfo.endCursor;
  }

  // Save cursor for next run (null if complete)
  await upsertIngestionState(supabase, ownerId, "product_hunt", "backfill", {
    last_success_at: new Date().toISOString(),
    cursor: backfillComplete ? null : cursor,
  });

  return {
    inserted: totalInserted,
    skipped: totalSkipped,
    invalid: totalInvalid,
    fetched: totalFetched,
    mode: "BACKFILL",
    windowLabel,
    pagesRun,
    backfillComplete,
  };
}
