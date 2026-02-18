import { createClient } from "@/lib/supabase/server";

export async function logAiUsage(input: {
  event: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  opportunity_id?: string | null;
  cluster_id?: string | null;
  raw_signal_id?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const total_tokens =
      (input.input_tokens ?? 0) + (input.output_tokens ?? 0);

    const { error } = await supabase.from("ai_usage_events").insert({
      owner_id: user.id,
      event: input.event,
      model: input.model,
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
      total_tokens,
      opportunity_id: input.opportunity_id ?? null,
      cluster_id: input.cluster_id ?? null,
      raw_signal_id: input.raw_signal_id ?? null,
      meta: input.meta ?? {},
    });

    if (error) {
      console.error("[aiUsage] Failed to log usage:", error.message);
    }
  } catch (e) {
    console.error(
      "[aiUsage] Error logging usage:",
      e instanceof Error ? e.message : e,
    );
  }
}
