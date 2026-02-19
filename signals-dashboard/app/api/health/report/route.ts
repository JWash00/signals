import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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

  // ── Call RPC with service role (SECURITY DEFINER enforces owner scope) ─
  const service = createServiceClient();
  const { data, error } = await service.rpc("pipeline_health_report", {
    p_owner_id: user.id,
  });

  if (error) {
    console.error("[health/report] RPC error:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, report: data });
}
