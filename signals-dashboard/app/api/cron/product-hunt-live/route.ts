import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ingestProductHuntLive } from "@/lib/ingestion/producthunt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const ts = new Date().toISOString();
  const hasCronSecret = !!process.env.CRON_SECRET;
  const hasCronOwner = !!process.env.CRON_OWNER_ID;

  console.log(
    `CRON HIT: product-hunt-live | ${ts} | CRON_SECRET set: ${hasCronSecret} | CRON_OWNER_ID set: ${hasCronOwner}`,
  );

  // ── Auth ──────────────────────────────────────────────────
  if (!process.env.CRON_SECRET) {
    console.error("CRON FAIL: CRON_SECRET env var is not set");
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET missing" },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("CRON FAIL: authorization header mismatch");
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // ── Owner ─────────────────────────────────────────────────
  const ownerId = process.env.CRON_OWNER_ID;
  if (!ownerId) {
    console.error("CRON FAIL: CRON_OWNER_ID env var is not set");
    return NextResponse.json(
      { ok: false, error: "CRON_OWNER_ID not configured" },
      { status: 500 },
    );
  }

  // ── Run ingestion ─────────────────────────────────────────
  try {
    const supabase = createServiceClient();
    const result = await ingestProductHuntLive(ownerId, supabase);

    console.log(
      `CRON OK: product-hunt-live | fetched=${result.fetched} inserted=${result.inserted} duplicates=${result.duplicates}`,
    );

    return NextResponse.json({ ok: true, ts, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(`CRON ERROR: product-hunt-live | ${message}`);
    return NextResponse.json(
      { ok: false, error: message, ts },
      { status: 500 },
    );
  }
}
