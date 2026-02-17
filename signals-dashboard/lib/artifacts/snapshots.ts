import { createClient } from "@/lib/supabase/server";
import type { ArtifactsV1 } from "./types";

export async function getLatestSnapshotForOpportunity(opportunityId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scoring_snapshots")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export function mergeArtifacts(
  existingExplanations: Record<string, unknown> | null,
  newArtifacts: Partial<ArtifactsV1>,
): Record<string, unknown> {
  const base = existingExplanations ?? {};
  const existing: ArtifactsV1 =
    (base.artifacts_v1 as ArtifactsV1) ?? {};

  return {
    ...base,
    artifacts_v1: {
      ...existing,
      ...newArtifacts,
    },
  };
}

export async function createSnapshotWithArtifacts(params: {
  opportunity_id: string;
  newArtifacts: Partial<ArtifactsV1>;
  priorSnapshot?: Record<string, unknown> | null;
}) {
  const supabase = await createClient();
  const { opportunity_id, newArtifacts, priorSnapshot } = params;

  const prior = priorSnapshot ?? (await getLatestSnapshotForOpportunity(opportunity_id));

  const mergedExplanations = mergeArtifacts(
    (prior?.explanations as Record<string, unknown>) ?? null,
    newArtifacts,
  );

  const row = {
    opportunity_id,
    snapshot_date: new Date().toISOString().slice(0, 10),
    // Carry forward prior score fields
    score_total: prior?.score_total ?? null,
    score_pain: prior?.score_pain ?? null,
    score_velocity: prior?.score_velocity ?? null,
    score_wtp: prior?.score_wtp ?? null,
    score_competition: prior?.score_competition ?? null,
    score_feasibility: prior?.score_feasibility ?? null,
    tier: prior?.tier ?? null,
    signal_count: prior?.signal_count ?? null,
    competitor_count: prior?.competitor_count ?? null,
    // Carry forward model fields if present
    model_id: prior?.model_id ?? null,
    model_version: prior?.model_version ?? null,
    verdict: prior?.verdict ?? null,
    confidence: prior?.confidence ?? null,
    score_breakdown: prior?.score_breakdown ?? null,
    // Set merged explanations
    explanations: mergedExplanations,
  };

  const { error } = await supabase
    .from("scoring_snapshots")
    .upsert(row, { onConflict: "opportunity_id,snapshot_date" });

  if (error) throw new Error(error.message);
}
