"use server";

import { requireUser } from "@/lib/auth/requireUser";
import {
  getLatestSnapshotForOpportunity,
  createSnapshotWithArtifacts,
} from "@/lib/artifacts/snapshots";
import type { HandoffV1, ChecklistV1 } from "@/lib/artifacts/types";
import { revalidatePath } from "next/cache";

export async function generateHandoffV1(
  opportunityId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await requireUser();

    // Read opportunity info
    const { data: opp, error: oppErr } = await supabase
      .from("opportunities")
      .select("id, title, description, cluster_id, status, score_total, competitor_count")
      .eq("id", opportunityId)
      .single();

    if (oppErr || !opp) {
      return { ok: false, error: oppErr?.message ?? "Opportunity not found" };
    }

    // Get signal count from cluster if available
    let signalCount: number | null = null;
    let platformCount: number | null = null;
    if (opp.cluster_id) {
      const { data: cluster } = await supabase
        .from("pain_clusters")
        .select("signal_count, platform_count")
        .eq("id", opp.cluster_id)
        .single();
      if (cluster) {
        signalCount = cluster.signal_count;
        platformCount = cluster.platform_count;
      }
    }

    // Read latest snapshot for PMF scores
    const latest = await getLatestSnapshotForOpportunity(opportunityId);
    const breakdown = latest?.score_breakdown as Record<string, unknown> | null;

    const handoff: HandoffV1 = {
      opportunity_id: opportunityId,
      opportunity_name: opp.title ?? `Opportunity ${opportunityId}`,
      source_type: opp.cluster_id ? "pain-first" : "unknown",
      summary: opp.description ?? "",
      evidence_count: {
        raw_signals: signalCount,
        sources: platformCount,
      },
      pmf_snapshot: {
        demand: breakdown?.demand != null ? Number(breakdown.demand) : null,
        pain: breakdown?.pain != null ? Number(breakdown.pain) : null,
        competition: breakdown?.headroom != null ? Number(breakdown.headroom) : null,
        wtp: breakdown?.wtp != null ? Number(breakdown.wtp) : null,
      },
      build_decision: latest?.verdict as HandoffV1["build_decision"] ?? null,
      execution_surface: null,
      why: null,
      created_at_iso: new Date().toISOString(),
    };

    await createSnapshotWithArtifacts({
      opportunity_id: opportunityId,
      newArtifacts: { handoff_v1: handoff },
      priorSnapshot: latest,
    });

    revalidatePath(`/opportunities/${opportunityId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function saveChecklistV1(
  opportunityId: string,
  checklist: ChecklistV1,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();

    // Compute total
    const d = checklist.durability_scores;
    const total =
      d.platform_encroachment +
      d.workflow_state +
      d.vertical_specificity +
      d.permission_moat +
      d.expansion_vector +
      d.data_compounding;

    // Hard kill rule: platform_encroachment=0 AND data_compounding=0
    const hardKill = d.platform_encroachment === 0 && d.data_compounding === 0;

    checklist.durability_scores.total = total;
    checklist.durability_scores.hard_kill = hardKill;

    // Enforce hard kill verdict
    if (hardKill && checklist.verdict !== "KILL") {
      checklist.verdict = "KILL";
      checklist.reason = checklist.reason
        ? `[AUTO-KILL: platform_encroachment=0, data_compounding=0] ${checklist.reason}`
        : "Hard kill: no platform encroachment defense and no data compounding.";
    }

    // If BUILD, execution_surface must be set
    if (checklist.verdict === "BUILD" && !checklist.execution_surface) {
      return {
        ok: false,
        error: "Verdict is BUILD but execution_surface is not set. Choose EXTENSION, AGENT, HYBRID, or SAAS.",
      };
    }

    checklist.created_at_iso = new Date().toISOString();

    const latest = await getLatestSnapshotForOpportunity(opportunityId);

    await createSnapshotWithArtifacts({
      opportunity_id: opportunityId,
      newArtifacts: { checklist_v1: checklist },
      priorSnapshot: latest,
    });

    revalidatePath(`/opportunities/${opportunityId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
