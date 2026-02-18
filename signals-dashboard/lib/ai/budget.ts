import { createClient } from "@/lib/supabase/server";

// Same pricing table used by /usage page
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
};

function computeCost(
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null,
): number {
  if (!model || !(model in MODEL_PRICING)) return 0;
  const pricing = MODEL_PRICING[model];
  return (
    ((inputTokens ?? 0) / 1_000_000) * pricing.input +
    ((outputTokens ?? 0) / 1_000_000) * pricing.output
  );
}

export interface BudgetStatus {
  allowed: boolean;
  budgetUsd: number;
  spentTodayUsd: number;
  remainingUsd: number;
  reason: string;
}

export async function getAIBudgetStatus(): Promise<BudgetStatus> {
  const raw = process.env.DAILY_AI_BUDGET_USD;
  const budgetUsd = parseFloat(raw ?? "");

  // Fail closed: if the env var is missing, invalid, or <= 0, block AI
  if (!raw || isNaN(budgetUsd) || budgetUsd <= 0) {
    return {
      allowed: false,
      budgetUsd: 0,
      spentTodayUsd: 0,
      remainingUsd: 0,
      reason:
        "DAILY_AI_BUDGET_USD is missing or invalid. AI is blocked to prevent runaway cost.",
    };
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        allowed: false,
        budgetUsd,
        spentTodayUsd: 0,
        remainingUsd: 0,
        reason: "No authenticated user. AI is blocked.",
      };
    }

    // Start of current UTC day
    const now = new Date();
    const todayUtcStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ).toISOString();

    const { data, error } = await supabase
      .from("ai_usage_events")
      .select("model, input_tokens, output_tokens")
      .eq("owner_id", user.id)
      .gte("created_at", todayUtcStart);

    if (error) {
      console.error("[budget] Failed to query usage:", error.message);
      return {
        allowed: false,
        budgetUsd,
        spentTodayUsd: 0,
        remainingUsd: 0,
        reason: "Failed to check today's spend. AI is blocked to be safe.",
      };
    }

    const spentTodayUsd = (data ?? []).reduce(
      (sum, row) =>
        sum + computeCost(row.model, row.input_tokens, row.output_tokens),
      0,
    );

    const remainingUsd = Math.max(0, budgetUsd - spentTodayUsd);
    const allowed = spentTodayUsd < budgetUsd;

    return {
      allowed,
      budgetUsd,
      spentTodayUsd,
      remainingUsd,
      reason: allowed
        ? `Budget OK: $${spentTodayUsd.toFixed(4)} of $${budgetUsd.toFixed(2)} used today.`
        : `Daily budget of $${budgetUsd.toFixed(2)} reached ($${spentTodayUsd.toFixed(4)} spent). AI is off until tomorrow (UTC).`,
    };
  } catch (e) {
    console.error(
      "[budget] Unexpected error:",
      e instanceof Error ? e.message : e,
    );
    return {
      allowed: false,
      budgetUsd,
      spentTodayUsd: 0,
      remainingUsd: 0,
      reason: "Unexpected error checking budget. AI is blocked to be safe.",
    };
  }
}
