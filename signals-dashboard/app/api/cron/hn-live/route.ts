import { NextResponse } from "next/server";
import { ingestHNLiveCron } from "@/lib/ingestion/hackernews";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const ts = new Date().toISOString();
  const hasCronSecret = !!process.env.CRON_SECRET;
  const hasCronOwner = !!process.env.CRON_OWNER_ID;

  console.log(
    `CRON HIT: hn-live | ${ts} | CRON_SECRET set: ${hasCronSecret} | CRON_OWNER_ID set: ${hasCronOwner}`,
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
    console.warn("CRON FAIL: hn-live authorization header mismatch");
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
    const result = await ingestHNLiveCron(ownerId);

    console.log(
      `CRON OK: hn-live | fetched=${result.fetched} inserted=${result.inserted} duplicates=${result.duplicates} skippedOld=${result.skippedOld} invalid=${result.skippedInvalid}`,
    );

    return NextResponse.json({ ok: true, ts, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(`CRON ERROR: hn-live | ${message}`);
    return NextResponse.json(
      { ok: false, error: message, ts },
      { status: 500 },
    );
  }
}
