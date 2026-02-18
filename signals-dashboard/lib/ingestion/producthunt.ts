import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getIngestionState,
  upsertIngestionState,
} from "./ingestionState";

// ── GraphQL ────────────────────────────────────────────────

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

// ── Types ──────────────────────────────────────────────────

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

interface IngestionContext {
  ph_mode: "LIVE" | "TODAY" | "BACKFILL";
  ph_window: string;
}

export interface PHLiveResult {
  mode: "LIVE";
  fetched: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  cursorBefore: string | null;
  cursorAfter: string | null;
  lastSuccessAt: string | null;
  postedAfter: string;
  hasNextPage: boolean;
}

export interface PHTodayResult {
  mode: "TODAY";
  fetched: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  note?: string;
}

export interface PHBackfillResult {
  mode: "BACKFILL";
  fetched: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  cursorBefore: string | null;
  cursorAfter: string | null;
  pagesRun: number;
  backfillComplete: boolean;
}

// ── Shared helpers ─────────────────────────────────────────

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
      "Product Hunt ingestion is not configured. " +
        "Add PRODUCT_HUNT_CLIENT_ID and PRODUCT_HUNT_CLIENT_SECRET to .env.local.",
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
  supabase: SupabaseClient,
): Promise<{ inserted: number; duplicates: number; invalid: number }> {
  let inserted = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const post of posts) {
    // Hard guard: never insert a row with null source_id or missing title
    if (!post.id || !post.name) {
      console.warn(
        "PH skip: post missing id or name",
        post.name ?? "(no name)",
      );
      invalid++;
      continue;
    }

    // Coerce to numbers — engagement_proxy is a numeric column, NOT jsonb
    const votes = Number(post.votesCount ?? 0);
    const comments = Number(post.commentsCount ?? 0);
    const safeVotes =
      typeof votes === "number" && Number.isFinite(votes) ? votes : 0;
    const safeComments =
      typeof comments === "number" && Number.isFinite(comments) ? comments : 0;

    const row = {
      owner_id: ownerId,
      source: "product_hunt",
      source_id: String(post.id),
      source_url: post.url,
      title: post.name,
      content: post.tagline ?? "",
      engagement_proxy: safeVotes,
      metadata: {
        created_at: post.createdAt,
        ph_mode: ctx.ph_mode,
        ph_window: ctx.ph_window,
        upvotes: safeVotes,
        comments: safeComments,
      },
      status: "new",
    };

    const { error } = await supabase.from("raw_signals").insert(row);

    if (error) {
      if (error.code === "23505") {
        duplicates++;
      } else {
        console.error(`PH insert error for ${post.id}:`, error.message);
        duplicates++;
      }
    } else {
      inserted++;
    }
  }

  return { inserted, duplicates, invalid };
}

// ── LIVE: only truly new posts since last_success_at ───────
//
// 1. Read state → last_success_at, cursor
// 2. postedAfter = last_success_at ?? (now - 24h)
// 3. Fetch pages with (order: NEWEST, first: 100, after: cursor, postedAfter)
// 4. STOP if edges.length === 0
// 5. After success:
//    - ALWAYS set last_success_at = now()
//    - Set cursor = endCursor ONLY if we fetched edges
// 6. If API fails → throw (caller catches, state NOT updated)

export async function ingestProductHuntLive(
  ownerId: string,
  supabaseClient?: SupabaseClient,
): Promise<PHLiveResult> {
  const maxPages = 5;
  const supabase = supabaseClient ?? (await createClient());

  // 1. Read state
  const state = await getIngestionState(
    supabase,
    ownerId,
    "product_hunt",
    "live",
  );
  const cursorBefore = state?.cursor ?? null;
  const lastSuccessAt = state?.last_success_at ?? null;

  // 2. Compute postedAfter
  const fallback = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();
  const postedAfter = lastSuccessAt ?? fallback;

  const { clientId, clientSecret } = getCredentials();
  const accessToken = await getAccessToken(clientId, clientSecret);

  // 3. Paginate
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalInvalid = 0;
  let totalFetched = 0;
  // LIVE always starts with a fresh cursor. The saved cursor was for a
  // previous postedAfter window and is invalid once last_success_at advances.
  let cursor: string | null = null;
  let lastEndCursor: string | null = null;
  let hasNextPage = false;
  let runSucceeded = false;

  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPostsPage(accessToken, {
      first: 100,
      after: cursor,
      postedAfter,
      order: "NEWEST",
    });

    // 4. STOP immediately if no edges — do NOT advance cursor
    if (page.posts.length === 0) break;

    totalFetched += page.posts.length;
    lastEndCursor = page.pageInfo.endCursor;

    const { inserted, duplicates, invalid } = await insertPosts(
      ownerId,
      page.posts,
      { ph_mode: "LIVE", ph_window: postedAfter },
      supabase,
    );
    totalInserted += inserted;
    totalDuplicates += duplicates;
    totalInvalid += invalid;

    hasNextPage = page.pageInfo.hasNextPage;
    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
    cursor = page.pageInfo.endCursor;
  }

  // Entire pagination loop completed without throwing
  runSucceeded = true;

  // 5. Update state — only write when run succeeded (API didn't throw)
  if (runSucceeded) {
    const patch: {
      last_success_at: string;
      cursor?: string | null;
      meta: Record<string, unknown>;
    } = {
      last_success_at: new Date().toISOString(),
      meta: {
        fetched: totalFetched,
        inserted: totalInserted,
        duplicates: totalDuplicates,
        invalid: totalInvalid,
        hasNextPage,
        postedAfter,
      },
    };

    // Only advance cursor when we actually received edges
    if (totalFetched > 0 && lastEndCursor) {
      patch.cursor = lastEndCursor;
    }

    await upsertIngestionState(
      supabase,
      ownerId,
      "product_hunt",
      "live",
      patch,
    );
  }

  const cursorAfter =
    totalFetched > 0 && lastEndCursor ? lastEndCursor : null;

  return {
    mode: "LIVE",
    fetched: totalFetched,
    inserted: totalInserted,
    duplicates: totalDuplicates,
    invalid: totalInvalid,
    cursorBefore,
    cursorAfter,
    lastSuccessAt,
    postedAfter,
    hasNextPage,
  };
}

// ── TODAY: today's top posts since midnight UTC ─────────────
//
// - Filter: postedAfter = today 00:00 UTC
// - No cursor state (no read, no write)
// - Update last_success_at after success
// - Try VOTES order, fall back to NEWEST

export async function ingestProductHuntTodaysWinners(
  ownerId: string,
  supabaseClient?: SupabaseClient,
): Promise<PHTodayResult> {
  const supabase = supabaseClient ?? (await createClient());

  const { clientId, clientSecret } = getCredentials();
  const accessToken = await getAccessToken(clientId, clientSecret);

  const now = new Date();
  const todayUtcStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();

  let page: PHPage;
  let note: string | undefined;
  try {
    page = await fetchPostsPage(accessToken, {
      first: 100,
      postedAfter: todayUtcStart,
      order: "VOTES",
    });
  } catch {
    page = await fetchPostsPage(accessToken, {
      first: 100,
      postedAfter: todayUtcStart,
      order: "NEWEST",
    });
    note =
      "Sorted by newest (VOTES order not available). Results are today's posts, newest first.";
  }

  const fetched = page.posts.length;
  const { inserted, duplicates, invalid } = await insertPosts(
    ownerId,
    page.posts,
    { ph_mode: "TODAY", ph_window: "today" },
    supabase,
  );

  // Update last_success_at only (no cursor)
  await upsertIngestionState(
    supabase,
    ownerId,
    "product_hunt",
    "today",
    {
      last_success_at: new Date().toISOString(),
      meta: { fetched, inserted, duplicates, invalid },
    },
  );

  return { mode: "TODAY", fetched, inserted, duplicates, invalid, note };
}

// ── BACKFILL: walk older posts with cursor pagination ───────
//
// - Ignore postedAfter (no time filter)
// - Use cursor from state to resume
// - Enforce MAX_PAGES safety limit
// - Write cursor to state
// - Do NOT update last_success_at

export async function backfillProductHuntHistorical(
  ownerId: string,
  supabaseClient?: SupabaseClient,
): Promise<PHBackfillResult> {
  const maxPages = parseInt(
    process.env.PRODUCT_HUNT_BACKFILL_PAGES ?? "5",
    10,
  );
  const supabase = supabaseClient ?? (await createClient());

  // Read state — resume from cursor
  const state = await getIngestionState(
    supabase,
    ownerId,
    "product_hunt",
    "backfill",
  );
  const cursorBefore = state?.cursor ?? null;

  const { clientId, clientSecret } = getCredentials();
  const accessToken = await getAccessToken(clientId, clientSecret);

  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalInvalid = 0;
  let totalFetched = 0;
  let cursor = cursorBefore;
  let pagesRun = 0;
  let backfillComplete = false;
  let runSucceeded = false;

  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPostsPage(accessToken, {
      first: 100,
      after: cursor,
      // No postedAfter — walk ALL posts
      order: "NEWEST",
    });

    pagesRun++;

    // Hard-stop: break immediately when edges.length === 0
    if (page.posts.length === 0) {
      backfillComplete = true;
      break;
    }

    totalFetched += page.posts.length;

    const { inserted, duplicates, invalid } = await insertPosts(
      ownerId,
      page.posts,
      { ph_mode: "BACKFILL", ph_window: "all" },
      supabase,
    );
    totalInserted += inserted;
    totalDuplicates += duplicates;
    totalInvalid += invalid;

    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) {
      backfillComplete = true;
      break;
    }
    cursor = page.pageInfo.endCursor;
  }

  // Entire pagination loop completed without throwing
  runSucceeded = true;

  const cursorAfter = backfillComplete ? null : cursor;

  // Write cursor only — do NOT update last_success_at for backfill
  if (runSucceeded) {
    await upsertIngestionState(
      supabase,
      ownerId,
      "product_hunt",
      "backfill",
      {
        cursor: cursorAfter,
        meta: {
          fetched: totalFetched,
          inserted: totalInserted,
          duplicates: totalDuplicates,
          invalid: totalInvalid,
          pagesRun,
          backfillComplete,
        },
      },
    );
  }

  return {
    mode: "BACKFILL",
    fetched: totalFetched,
    inserted: totalInserted,
    duplicates: totalDuplicates,
    invalid: totalInvalid,
    cursorBefore,
    cursorAfter,
    pagesRun,
    backfillComplete,
  };
}
