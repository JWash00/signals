"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getLatestSnapshotForOpportunity,
  createSnapshotWithArtifacts,
} from "@/lib/artifacts/snapshots";
import { generateOpportunitySummaryV1 } from "@/lib/anthropic";
import { sha256Hex } from "@/lib/hash";

export async function createClusterFromSignal(
  signalId: string,
): Promise<void> {
  if (!signalId) throw new Error("Missing signalId");

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) redirect("/login");

  const { data: signal, error: fetchError } = await supabase
    .from("raw_signals")
    .select("title, content")
    .eq("id", signalId)
    .eq("owner_id", user.id)
    .eq("status", "approved")
    .single();

  if (fetchError) throw new Error(fetchError.message);
  if (!signal) throw new Error("Signal not found or not approved");

  const { error: insertError } = await supabase.from("pain_clusters").insert({
    owner_id: user.id,
    title: signal.title || "(no title)",
    description: signal.content || null,
    pain_category: "workflow_friction",
  });

  if (insertError) throw new Error(insertError.message);

  revalidatePath("/clusters");
}

export async function createOpportunityFromCluster(
  clusterId: string,
): Promise<{ opportunityId: string }> {
  if (!clusterId) throw new Error("Missing clusterId");

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) redirect("/login");

  // Fetch the cluster
  const { data: cluster, error: fetchError } = await supabase
    .from("pain_clusters")
    .select("id, title, description")
    .eq("id", clusterId)
    .eq("owner_id", user.id)
    .single();

  if (fetchError) throw new Error(fetchError.message);
  if (!cluster) throw new Error("Cluster not found");

  // ── STEP 1: Insert opportunity ──────────────────────────────────
  const { data, error: insertError } = await supabase
    .from("opportunities")
    .insert({
      title: cluster.title || "(no title)",
      cluster_id: cluster.id,
      description: cluster.description || null,
      status: "scored",
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);
  if (!data) throw new Error("Failed to create opportunity");

  const opportunityId = data.id;
  const opportunityTitle = cluster.title || "(no title)";

  // ── STEP 2: Create scoring snapshot IMMEDIATELY ─────────────────
  // This MUST succeed before we attempt AI. Uses the existing upsert
  // pattern with onConflict: "opportunity_id,snapshot_date".
  // No owner_id column on scoring_snapshots — do not reference it.
  await createSnapshotWithArtifacts({
    opportunity_id: opportunityId,
    newArtifacts: {},
  });

  // ── STEP 3: Generate AI summary (fault-tolerant) ────────────────
  // Wrapped in try/catch — if Anthropic fails, opportunity + snapshot
  // still exist and the user still gets redirected.
  try {
    const clusterTitle = cluster.title || "(no title)";
    const clusterDesc = cluster.description ?? null;
    const inputsString = opportunityTitle + clusterTitle + (clusterDesc ?? "");
    const inputHash = sha256Hex(inputsString);

    const result = await generateOpportunitySummaryV1({
      opportunityTitle,
      clusterTitle,
      clusterDescription: clusterDesc,
      opportunityId,
      clusterId,
    });

    const summaryWithMeta = {
      ...result.fields,
      _meta: {
        input_hash: inputHash,
        generated_at: new Date().toISOString(),
        model: result.model,
      },
    };

    // Merge ai_summary_v1 into explanations without overwriting
    // artifacts_v1 or any other existing keys.
    const supabaseForUpdate = await createClient();
    const latest = await getLatestSnapshotForOpportunity(opportunityId);
    const existingExplanations =
      (latest?.explanations as Record<string, unknown>) ?? {};

    const mergedExplanations = {
      ...existingExplanations,
      ai_summary_v1: summaryWithMeta,
    };

    const { error: updateError } = await supabaseForUpdate
      .from("scoring_snapshots")
      .update({ explanations: mergedExplanations })
      .eq("opportunity_id", opportunityId)
      .eq("snapshot_date", new Date().toISOString().slice(0, 10));

    if (updateError) {
      console.error("Failed to save AI summary:", updateError.message);
    }
  } catch (e) {
    console.error(
      "AI summary generation failed:",
      e instanceof Error ? e.message : e,
    );
    // Do NOT throw — opportunity + snapshot already created successfully
  }

  revalidatePath("/clusters");
  revalidatePath(`/opportunities/${opportunityId}`);

  return { opportunityId };
}
