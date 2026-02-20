import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ── Required env vars (checked server-side, values never leaked) ──
const REQUIRED_ENV = [
  { key: "CRON_SECRET", label: "Cron password (CRON_SECRET)", requiredFor: "Robots" },
  { key: "CRON_OWNER_ID", label: "Owner ID (CRON_OWNER_ID)", requiredFor: "Robots" },
  { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Database URL (NEXT_PUBLIC_SUPABASE_URL)", requiredFor: "Everything" },
  { key: "SUPABASE_SECRET_KEY", label: "Server key (SUPABASE_SECRET_KEY)", requiredFor: "Robots" },
  { key: "DAILY_AI_BUDGET_USD", label: "Daily AI budget (DAILY_AI_BUDGET_USD)", requiredFor: "AI scoring" },
  { key: "ANTHROPIC_API_KEY", label: "AI key (ANTHROPIC_API_KEY)", requiredFor: "AI scoring" },
  { key: "PRODUCT_HUNT_CLIENT_ID", label: "Product Hunt ID (PRODUCT_HUNT_CLIENT_ID)", requiredFor: "Product Hunt" },
  { key: "PRODUCT_HUNT_CLIENT_SECRET", label: "Product Hunt secret (PRODUCT_HUNT_CLIENT_SECRET)", requiredFor: "Product Hunt" },
  { key: "REDDIT_SUBREDDITS", label: "Reddit list (REDDIT_SUBREDDITS)", requiredFor: "Reddit coverage" },
  { key: "APIFY_TOKEN", label: "Apify token (APIFY_TOKEN)", requiredFor: "Indie Hackers" },
  { key: "APIFY_IH_STORIES_ACTOR_ID", label: "IH Stories actor (APIFY_IH_STORIES_ACTOR_ID)", requiredFor: "Indie Hackers" },
  { key: "APIFY_IH_POSTS_ACTOR_ID", label: "IH Posts actor (APIFY_IH_POSTS_ACTOR_ID)", requiredFor: "Indie Hackers" },
];

export async function GET() {
  // ── Authenticate via session cookie ──────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // ── Check env vars (never leak values, only key names + labels) ──
  const missingEnv = REQUIRED_ENV.filter(
    (e) => !process.env[e.key] || String(process.env[e.key]).trim().length === 0,
  ).map((e) => ({ label: e.label, requiredFor: e.requiredFor }));

  // ── Call RPC with authenticated client (SECURITY DEFINER handles scope)
  const { data, error } = await supabase.rpc("pipeline_health_report", {
    p_owner_id: user.id,
  });

  if (error) {
    console.error("[health/report] RPC error:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  // Validate response has expected shape (migration may not be applied yet)
  const report = data as Record<string, unknown> | null;
  if (!report || !Array.isArray(report.flags)) {
    console.error(
      "[health/report] RPC returned unexpected shape — migration likely not applied. Got:",
      JSON.stringify(data),
    );
    return NextResponse.json(
      {
        ok: false,
        error:
          "Health report function not deployed. Run the pipeline_health_report_v2 migration in the Supabase SQL Editor.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, report: data, missing_env: missingEnv });
}
