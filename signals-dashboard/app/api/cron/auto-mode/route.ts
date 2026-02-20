import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { problemSignature } from "@/lib/auto/problemSignature";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Constants (locked numbers) ──────────────────────────────────
const PAIN_GROUP_MIN_APPROVED = 2;
const BIG_IDEA_MIN_APPROVED = 3;

// ── Pricing (same table as budget.ts) ───────────────────────────
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
  const p = MODEL_PRICING[model];
  return (
    ((inputTokens ?? 0) / 1_000_000) * p.input +
    ((outputTokens ?? 0) / 1_000_000) * p.output
  );
}

// ── Budget check (service-role compatible) ──────────────────────
async function checkBudget(
  supabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
): Promise<{ allowed: boolean; reason: string }> {
  const raw = process.env.DAILY_AI_BUDGET_USD;
  const budgetUsd = parseFloat(raw ?? "");

  if (!raw || isNaN(budgetUsd) || budgetUsd <= 0) {
    return {
      allowed: false,
      reason: "DAILY_AI_BUDGET_USD is missing or invalid. AI is blocked.",
    };
  }

  const now = new Date();
  const todayUtcStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();

  const { data, error } = await supabase
    .from("ai_usage_events")
    .select("model, input_tokens, output_tokens")
    .eq("owner_id", ownerId)
    .gte("created_at", todayUtcStart);

  if (error) {
    console.error("[auto-mode] Budget query failed:", error.message);
    return { allowed: false, reason: "Failed to check spend. AI blocked." };
  }

  const spent = (data ?? []).reduce(
    (sum, row) => sum + computeCost(row.model, row.input_tokens, row.output_tokens),
    0,
  );

  if (spent >= budgetUsd) {
    return {
      allowed: false,
      reason: `Daily budget of $${budgetUsd.toFixed(2)} reached ($${spent.toFixed(4)} spent).`,
    };
  }

  return { allowed: true, reason: "OK" };
}

// ── AI model resolution (mirrors anthropic.ts) ─────────────────
function resolveModel(): string {
  const raw = process.env.ANTHROPIC_MODEL;
  if (!raw || raw.includes("latest") || raw.startsWith("claude-3-5-")) {
    return "claude-sonnet-4-6";
  }
  return raw;
}

// ── Main handler ────────────────────────────────────────────────
export async function GET(req: Request) {
  const ts = new Date().toISOString();

  // ── Auth ────────────────────────────────────────────────────
  if (!process.env.CRON_SECRET) {
    console.error("CRON FAIL: auto-mode — CRON_SECRET not set");
    return NextResponse.json({ ok: false, error: "CRON_SECRET missing" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("CRON FAIL: auto-mode — authorization mismatch");
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = process.env.CRON_OWNER_ID;
  if (!ownerId) {
    console.error("CRON FAIL: auto-mode — CRON_OWNER_ID not set");
    return NextResponse.json({ ok: false, error: "CRON_OWNER_ID not configured" }, { status: 500 });
  }

  const supabase = createServiceClient();

  try {
    // ════════════════════════════════════════════════════════════
    // STEP 1 & 2: Put Same Problems Together (Pain Groups)
    // ════════════════════════════════════════════════════════════

    // 1a. Fetch approved signals not yet linked to a cluster
    const { data: unlinkedSignals, error: sigErr } = await supabase
      .from("raw_signals")
      .select("id, title, content")
      .eq("owner_id", ownerId)
      .eq("status", "approved")
      .is("cluster_id", null)
      .limit(500);

    if (sigErr) throw new Error(`Fetch unlinked signals: ${sigErr.message}`);

    const signals = unlinkedSignals ?? [];

    // 1b. Fetch all existing clusters for this owner (for signature matching)
    const { data: existingClusters, error: clErr } = await supabase
      .from("pain_clusters")
      .select("id, title, description")
      .eq("owner_id", ownerId);

    if (clErr) throw new Error(`Fetch clusters: ${clErr.message}`);

    // Build signature → cluster map from existing clusters
    const sigToCluster = new Map<string, string>();
    for (const cl of existingClusters ?? []) {
      const sig = problemSignature(cl.title, cl.description);
      if (sig) sigToCluster.set(sig, cl.id);
    }

    // 1c. Group unlinked signals by their signature
    const sigGroups = new Map<string, Array<{ id: string; title: string; content: string | null }>>();
    for (const s of signals) {
      const sig = problemSignature(s.title ?? "", s.content);
      if (!sig) continue;
      if (!sigGroups.has(sig)) sigGroups.set(sig, []);
      sigGroups.get(sig)!.push(s);
    }

    let groupsCreated = 0;
    let linksCreated = 0;

    for (const [sig, group] of sigGroups) {
      let clusterId = sigToCluster.get(sig);

      // If no existing cluster and not enough signals, skip
      if (!clusterId && group.length < PAIN_GROUP_MIN_APPROVED) continue;

      // Create new cluster if needed
      if (!clusterId) {
        const representative = group[0];
        const { data: newCluster, error: insertErr } = await supabase
          .from("pain_clusters")
          .insert({
            owner_id: ownerId,
            title: representative.title || "(auto-grouped)",
            description: representative.content || null,
            pain_category: "uncategorized",
          })
          .select("id")
          .single();

        if (insertErr || !newCluster) {
          console.error(`[auto-mode] Failed to create cluster for sig "${sig}":`, insertErr?.message ?? "no data");
          continue;
        }

        clusterId = newCluster.id as string;
        sigToCluster.set(sig, clusterId);
        groupsCreated++;
      }

      // Link all signals in this group to the cluster
      const signalIds = group.map((s) => s.id);
      const { error: linkErr, count } = await supabase
        .from("raw_signals")
        .update({ cluster_id: clusterId })
        .in("id", signalIds)
        .is("cluster_id", null); // idempotent: only update if still unlinked

      if (linkErr) {
        console.error(`[auto-mode] Failed to link signals to cluster ${clusterId}:`, linkErr.message);
      } else {
        linksCreated += count ?? signalIds.length;
      }
    }

    console.log(
      `AUTO MODE: attached signals to pain groups | signals_seen=${signals.length} groups_created=${groupsCreated} links_created=${linksCreated}`,
    );

    // ════════════════════════════════════════════════════════════
    // STEP 3: Create Big Ideas from Pain Groups
    // ════════════════════════════════════════════════════════════

    // 3a. Count approved signals per cluster
    const { data: clusterCounts, error: countErr } = await supabase
      .from("raw_signals")
      .select("cluster_id")
      .eq("owner_id", ownerId)
      .eq("status", "approved")
      .not("cluster_id", "is", null);

    if (countErr) throw new Error(`Count cluster signals: ${countErr.message}`);

    const approvedPerCluster = new Map<string, number>();
    for (const row of clusterCounts ?? []) {
      const cid = row.cluster_id as string;
      approvedPerCluster.set(cid, (approvedPerCluster.get(cid) ?? 0) + 1);
    }

    // 3b. Find clusters that qualify (>= BIG_IDEA_MIN_APPROVED)
    const qualifyingClusterIds = Array.from(approvedPerCluster.entries())
      .filter(([, count]) => count >= BIG_IDEA_MIN_APPROVED)
      .map(([cid]) => cid);

    // 3c. Find which qualifying clusters already have an opportunity
    let bigIdeasCreated = 0;

    if (qualifyingClusterIds.length > 0) {
      const { data: existingOpps, error: oppErr } = await supabase
        .from("opportunities")
        .select("cluster_id")
        .in("cluster_id", qualifyingClusterIds);

      if (oppErr) throw new Error(`Fetch existing opportunities: ${oppErr.message}`);

      const clusterIdsWithOpp = new Set(
        (existingOpps ?? []).map((o) => o.cluster_id as string),
      );

      // 3d. Create Big Ideas for clusters that don't have one yet
      for (const cid of qualifyingClusterIds) {
        if (clusterIdsWithOpp.has(cid)) continue;

        // Fetch cluster details for the title
        const { data: cluster } = await supabase
          .from("pain_clusters")
          .select("title, description")
          .eq("id", cid)
          .single();

        if (!cluster) continue;

        const { error: createErr } = await supabase.from("opportunities").insert({
          title: cluster.title || "(auto-created)",
          cluster_id: cid,
          description: cluster.description || null,
          status: "scored",
        });

        if (createErr) {
          console.error(`[auto-mode] Failed to create opportunity for cluster ${cid}:`, createErr.message);
          continue;
        }

        bigIdeasCreated++;
      }
    }

    console.log(`AUTO MODE: created big ideas | bigIdeasCreated=${bigIdeasCreated}`);

    // ════════════════════════════════════════════════════════════
    // STEP 4: Score Big Ideas ("Is This a Real Business?")
    // ════════════════════════════════════════════════════════════

    // 4a. Find unscored opportunities (no scoring_snapshot yet)
    const { data: allOpps, error: allOppsErr } = await supabase
      .from("opportunities")
      .select("id, title, cluster_id")
      .in(
        "cluster_id",
        (existingClusters ?? []).map((c) => c.id),
      );

    if (allOppsErr) throw new Error(`Fetch opportunities: ${allOppsErr.message}`);

    const oppIds = (allOpps ?? []).map((o) => o.id);

    let unscoredOpps: typeof allOpps = [];

    if (oppIds.length > 0) {
      // Find which ones already have snapshots
      const { data: snapshots } = await supabase
        .from("scoring_snapshots")
        .select("opportunity_id")
        .in("opportunity_id", oppIds);

      const scoredOppIds = new Set(
        (snapshots ?? []).map((s) => s.opportunity_id as string),
      );

      unscoredOpps = (allOpps ?? []).filter((o) => !scoredOppIds.has(o.id));
    }

    let scoredCount = 0;
    let skippedBudgetCount = 0;

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (unscoredOpps.length > 0 && apiKey) {
      for (const opp of unscoredOpps) {
        // Budget check before each AI call
        const budget = await checkBudget(supabase, ownerId);
        if (!budget.allowed) {
          console.log(`AUTO MODE: budget exceeded, skip scoring | reason=${budget.reason}`);

          // Log budget block
          await supabase.from("ai_usage_events").insert({
            owner_id: ownerId,
            event: "ai_budget_blocked",
            model: "none",
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            meta: { reason: budget.reason, source: "auto-mode" },
          });

          skippedBudgetCount += unscoredOpps.length - scoredCount;
          break;
        }

        // Fetch cluster info for the prompt
        const { data: cluster } = await supabase
          .from("pain_clusters")
          .select("title, description")
          .eq("id", opp.cluster_id)
          .single();

        if (!cluster) continue;

        try {
          const result = await callAnthropic(
            apiKey,
            opp.title,
            cluster.title,
            cluster.description,
          );

          // Create scoring snapshot
          const snapshotDate = new Date().toISOString().slice(0, 10);
          await supabase.from("scoring_snapshots").upsert(
            {
              opportunity_id: opp.id,
              snapshot_date: snapshotDate,
              explanations: { ai_summary_v1: result.summary },
            },
            { onConflict: "opportunity_id,snapshot_date" },
          );

          // Log AI usage
          await supabase.from("ai_usage_events").insert({
            owner_id: ownerId,
            event: "ai_summary_regen",
            model: result.model,
            input_tokens: result.usage?.input_tokens ?? 0,
            output_tokens: result.usage?.output_tokens ?? 0,
            total_tokens:
              (result.usage?.input_tokens ?? 0) +
              (result.usage?.output_tokens ?? 0),
            opportunity_id: opp.id,
            cluster_id: opp.cluster_id,
            meta: { source: "auto-mode" },
          });

          scoredCount++;
        } catch (e) {
          console.error(
            `[auto-mode] AI scoring failed for opp ${opp.id}:`,
            e instanceof Error ? e.message : e,
          );
        }
      }
    } else if (!apiKey) {
      console.warn("[auto-mode] ANTHROPIC_API_KEY not set, skipping scoring step");
    }

    console.log(
      `AUTO MODE: scored big ideas | scoredCount=${scoredCount} skippedBudgetCount=${skippedBudgetCount}`,
    );

    return NextResponse.json({
      ok: true,
      ts,
      step1_signals_seen: signals.length,
      step2_groups_created: groupsCreated,
      step2_links_created: linksCreated,
      step3_big_ideas_created: bigIdeasCreated,
      step4_scored: scoredCount,
      step4_skipped_budget: skippedBudgetCount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(`CRON ERROR: auto-mode | ${message}`);
    return NextResponse.json({ ok: false, error: message, ts }, { status: 500 });
  }
}

// ── Anthropic call (mirrors generateOpportunitySummaryV1) ───────
const PRIMARY_MODEL = "claude-sonnet-4-6";
const FALLBACK_CHAIN = ["claude-sonnet-4-20250514", "claude-3-haiku-20240307"];

async function callAnthropic(
  apiKey: string,
  opportunityTitle: string,
  clusterTitle: string,
  clusterDescription: string | null,
): Promise<{
  summary: Record<string, unknown>;
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
}> {
  const model = resolveModel();
  const modelsToTry = [model, ...FALLBACK_CHAIN];

  const prompt = `You are an analyst evaluating a product opportunity.

Opportunity title: ${opportunityTitle}
Cluster title: ${clusterTitle}
Cluster description: ${clusterDescription ?? "(none)"}

Respond with ONLY valid JSON (no markdown, no code fences, no explanation) matching this exact shape:
{
  "summary": "<2-3 sentence executive summary of the opportunity>",
  "core_pain": "<the specific user pain this addresses>",
  "who": "<who experiences this pain — be specific about role/persona>",
  "why_now": "<why this opportunity exists now — market timing, tech shift, etc.>",
  "assumptions": ["<assumption 1>", "<assumption 2>", "<assumption 3>"]
}`;

  let res: Response | null = null;
  let activeModel = model;

  for (let i = 0; i < modelsToTry.length; i++) {
    activeModel = modelsToTry[i];

    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: activeModel,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (res.ok) break;

    const body = await res.text();
    try {
      const parsed = JSON.parse(body);
      if (res.status === 404 && parsed?.error?.type === "not_found_error" && i < modelsToTry.length - 1) {
        console.warn(`[auto-mode] model "${activeModel}" not found, trying next`);
        continue;
      }
    } catch {
      // not JSON, fall through to throw
    }

    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  if (!res || !res.ok) {
    throw new Error("Anthropic API: all models failed");
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";

  let usage: { input_tokens: number; output_tokens: number } | undefined;
  if (data?.usage && typeof data.usage.input_tokens === "number") {
    usage = {
      input_tokens: data.usage.input_tokens,
      output_tokens: data.usage.output_tokens ?? 0,
    };
  }

  let summary: Record<string, unknown>;
  try {
    summary = JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${text.slice(0, 500)}`);
  }

  return { summary, model: activeModel, usage };
}
