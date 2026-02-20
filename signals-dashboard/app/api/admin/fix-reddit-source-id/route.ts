import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { deriveSourceIdFromRow } from "@/lib/sources/reddit";

export const dynamic = "force-dynamic";

/**
 * One-off admin route to backfill NULL source_id on reddit raw_signals rows.
 * Protected by x-cron-secret header.
 *
 * Usage: GET /api/admin/fix-reddit-source-id
 *   Header: x-cron-secret: <CRON_SECRET>
 */
export async function GET(req: Request) {
  // ── Auth ──────────────────────────────────────────────────
  if (!process.env.CRON_SECRET || !process.env.CRON_OWNER_ID) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET or CRON_OWNER_ID not configured" },
      { status: 500 },
    );
  }

  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const ownerId = process.env.CRON_OWNER_ID;

  // ── Service client (bypasses RLS) ─────────────────────────
  const supabase = createServiceClient();

  // ── Find reddit rows with NULL source_id ──────────────────
  const { data: rows, error: selectError } = await supabase
    .from("raw_signals")
    .select("id, metadata, source_url, created_at")
    .eq("owner_id", ownerId)
    .eq("source", "reddit")
    .is("source_id", null)
    .limit(200);

  if (selectError) {
    console.error("ADMIN FIX: select error:", selectError.message);
    return NextResponse.json(
      { ok: false, error: selectError.message },
      { status: 500 },
    );
  }

  if (!rows || rows.length === 0) {
    console.log("ADMIN FIX: reddit source_id backfill fixed=0 still_null=0");
    return NextResponse.json({ ok: true, fixed: 0, still_null: 0, duplicates: 0 });
  }

  // ── Derive and update source_id for each row ─────────────
  let fixed = 0;
  let stillNull = 0;

  for (const row of rows) {
    const derived = deriveSourceIdFromRow({
      raw: row.metadata,
      url: row.source_url,
    });

    if (!derived || derived.trim() === "") {
      stillNull++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("raw_signals")
      .update({ source_id: derived })
      .eq("id", row.id);

    if (updateError) {
      console.error(`ADMIN FIX: update error for row ${row.id}:`, updateError.message);
      stillNull++;
    } else {
      fixed++;
    }
  }

  // ── Detect duplicates (report only, do NOT delete) ────────
  const { data: dupRows, error: dupError } = await supabase
    .from("raw_signals")
    .select("source_id")
    .eq("owner_id", ownerId)
    .eq("source", "reddit")
    .not("source_id", "is", null);

  let duplicates = 0;
  if (!dupError && dupRows) {
    const seen = new Map<string, number>();
    for (const r of dupRows) {
      const sid = r.source_id as string;
      seen.set(sid, (seen.get(sid) ?? 0) + 1);
    }
    for (const count of seen.values()) {
      if (count > 1) duplicates += count - 1;
    }
  }

  console.log(
    `ADMIN FIX: reddit source_id backfill fixed=${fixed} still_null=${stillNull} duplicates=${duplicates}`,
  );

  return NextResponse.json({ ok: true, fixed, still_null: stillNull, duplicates });
}
