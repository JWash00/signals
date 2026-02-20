import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  return NextResponse.json({ ok: true, report: data });
}
