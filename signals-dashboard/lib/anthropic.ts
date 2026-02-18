import { logAiUsage } from "@/lib/aiUsage";
import { getAIBudgetStatus } from "@/lib/ai/budget";
import { logAIBudgetBlocked } from "@/lib/ai/logBudgetBlock";

export interface AISummaryV1 {
  summary: string;
  core_pain: string;
  who: string;
  why_now: string;
  assumptions: string[];
}

export interface AISummaryResult {
  fields: AISummaryV1;
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
}

const PRIMARY_MODEL = "claude-sonnet-4-6";
const FALLBACK_CHAIN = [
  "claude-sonnet-4-20250514",
  "claude-3-haiku-20240307",
];

function resolveModel(): { modelFromEnv: string; modelUsed: string } {
  const raw = process.env.ANTHROPIC_MODEL;
  const modelFromEnv = raw ?? "<missing>";

  if (!raw || raw.includes("latest") || raw.startsWith("claude-3-5-")) {
    return { modelFromEnv, modelUsed: PRIMARY_MODEL };
  }

  return { modelFromEnv, modelUsed: raw };
}

async function callAnthropic(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
}

function isModelNotFound(status: number, body: string): boolean {
  if (status !== 404) return false;
  try {
    const parsed = JSON.parse(body);
    return parsed?.error?.type === "not_found_error";
  } catch {
    return false;
  }
}

export async function generateOpportunitySummaryV1(input: {
  opportunityTitle: string;
  clusterTitle: string;
  clusterDescription: string | null;
  opportunityId?: string;
  clusterId?: string;
}): Promise<AISummaryResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  // Budget guard: block AI if daily spend limit is reached
  const budget = await getAIBudgetStatus();
  if (!budget.allowed) {
    console.warn("[anthropic] Budget blocked:", budget.reason);
    await logAIBudgetBlocked({
      reason: budget.reason,
      budget_usd: budget.budgetUsd,
      spent_today_usd: budget.spentTodayUsd,
    });
    throw new Error(`AI budget exceeded: ${budget.reason}`);
  }

  const { modelFromEnv, modelUsed } = resolveModel();

  console.log("[anthropic] model=", modelFromEnv, "using=", modelUsed);

  const prompt = `You are an analyst evaluating a product opportunity.

Opportunity title: ${input.opportunityTitle}
Cluster title: ${input.clusterTitle}
Cluster description: ${input.clusterDescription ?? "(none)"}

Respond with ONLY valid JSON (no markdown, no code fences, no explanation) matching this exact shape:
{
  "summary": "<2-3 sentence executive summary of the opportunity>",
  "core_pain": "<the specific user pain this addresses>",
  "who": "<who experiences this pain — be specific about role/persona>",
  "why_now": "<why this opportunity exists now — market timing, tech shift, etc.>",
  "assumptions": ["<assumption 1>", "<assumption 2>", "<assumption 3>"]
}`;

  // Try primary model, then walk the fallback chain on 404 not_found_error
  const modelsToTry = [modelUsed, ...FALLBACK_CHAIN];
  let res: Response | null = null;
  let activeModel = modelUsed;

  for (let i = 0; i < modelsToTry.length; i++) {
    activeModel = modelsToTry[i];
    res = await callAnthropic(apiKey, activeModel, prompt);

    if (res.ok) break;

    const body = await res.text();

    if (isModelNotFound(res.status, body) && i < modelsToTry.length - 1) {
      const nextModel = modelsToTry[i + 1];
      console.warn(
        `[anthropic] model "${activeModel}" not found, retrying with "${nextModel}"`,
      );
      continue;
    }

    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  if (!res || !res.ok) {
    throw new Error("Anthropic API: all models failed");
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";

  // Extract usage if present (do not fail if missing)
  let usage: { input_tokens: number; output_tokens: number } | undefined;
  if (data?.usage && typeof data.usage.input_tokens === "number") {
    usage = {
      input_tokens: data.usage.input_tokens,
      output_tokens: data.usage.output_tokens ?? 0,
    };
  }

  // Extract request ID if present
  const requestId: string | undefined = data?.id ?? undefined;

  let fields: AISummaryV1;
  try {
    fields = JSON.parse(text) as AISummaryV1;
  } catch {
    throw new Error(
      `Failed to parse AI response as JSON: ${text.slice(0, 500)}`,
    );
  }

  // Log usage (fire-and-forget, never crashes)
  logAiUsage({
    event: "ai_summary_regen",
    model: activeModel,
    input_tokens: usage?.input_tokens ?? null,
    output_tokens: usage?.output_tokens ?? null,
    opportunity_id: input.opportunityId ?? null,
    cluster_id: input.clusterId ?? null,
    meta: {
      source: "anthropic",
      ...(requestId ? { request_id: requestId } : {}),
    },
  }).catch(() => {
    // Swallow — usage logging must never break the main flow
  });

  return { fields, model: activeModel, usage };
}
