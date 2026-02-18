import { createClient } from "@/lib/supabase/server";

export async function logAIBudgetBlocked(input: {
  reason: string;
  budget_usd: number;
  spent_today_usd: number;
}): Promise<void> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("ai_usage_events").insert({
      owner_id: user.id,
      event: "ai_budget_blocked",
      model: "none",
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      meta: {
        reason: input.reason,
        budget_usd: input.budget_usd,
        spent_today_usd: input.spent_today_usd,
      },
    });
  } catch (e) {
    console.error(
      "[budget] Failed to log budget block:",
      e instanceof Error ? e.message : e,
    );
  }
}
