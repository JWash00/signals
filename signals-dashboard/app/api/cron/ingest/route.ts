import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ingestRedditForUser } from "@/lib/ingestion/reddit";
import {
  ingestProductHuntLive,
  ingestProductHuntTodaysWinners,
  backfillProductHuntHistorical,
} from "@/lib/ingestion/producthunt";

type JobName = "reddit_live" | "ph_live" | "ph_today" | "ph_backfill" | "all";

const VALID_JOBS = new Set<JobName>([
  "reddit_live",
  "ph_live",
  "ph_today",
  "ph_backfill",
  "all",
]);

function isValidJob(job: string): job is JobName {
  return VALID_JOBS.has(job as JobName);
}

/** Check secret from header or query string */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // Vercel cron sends Authorization: Bearer <secret>
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  // Manual curl: x-cron-secret header
  const cronHeader = req.headers.get("x-cron-secret");
  if (cronHeader === secret) return true;

  // Browser / GET testing: ?secret=...
  const querySecret = req.nextUrl.searchParams.get("secret");
  if (querySecret === secret) return true;

  return false;
}

interface JobResult {
  inserted: number;
  skipped: number;
  error?: string;
}

async function runJob(
  job: JobName,
  ownerId: string,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Record<string, JobResult>> {
  const results: Record<string, JobResult> = {};

  const jobs: JobName[] = job === "all"
    ? ["reddit_live", "ph_live", "ph_today", "ph_backfill"]
    : [job];

  for (const j of jobs) {
    try {
      switch (j) {
        case "reddit_live": {
          const r = await ingestRedditForUser(ownerId, supabase);
          results.reddit_live = { inserted: r.inserted, skipped: r.skipped };
          break;
        }
        case "ph_live": {
          const r = await ingestProductHuntLive(ownerId, supabase);
          results.ph_live = { inserted: r.inserted, skipped: r.skipped };
          break;
        }
        case "ph_today": {
          const r = await ingestProductHuntTodaysWinners(ownerId, supabase);
          results.ph_today = { inserted: r.inserted, skipped: r.skipped };
          break;
        }
        case "ph_backfill": {
          const r = await backfillProductHuntHistorical(ownerId, supabase);
          results.ph_backfill = { inserted: r.inserted, skipped: r.skipped };
          break;
        }
      }
    } catch (e) {
      results[j] = {
        inserted: 0,
        skipped: 0,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  }

  return results;
}

async function handleRequest(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const ownerId = process.env.CRON_OWNER_ID;
  if (!ownerId) {
    return NextResponse.json(
      { ok: false, error: "CRON_OWNER_ID not configured" },
      { status: 500 },
    );
  }

  // Get job from query string or body
  let job: string | null = req.nextUrl.searchParams.get("job");

  if (!job && req.method === "POST") {
    try {
      const body = await req.json();
      job = body?.job ?? null;
    } catch {
      // No body or invalid JSON — fall through
    }
  }

  if (!job || !isValidJob(job)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid job. Must be one of: ${[...VALID_JOBS].join(", ")}`,
      },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const results = await runJob(job, ownerId, supabase);

  return NextResponse.json({ ok: true, job, results });
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}
