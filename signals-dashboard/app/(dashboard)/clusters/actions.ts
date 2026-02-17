"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createClusterFromSignal(signalId: string): Promise<void> {
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

  // Fetch the cluster to get its title and description
  const { data: cluster, error: fetchError } = await supabase
    .from("pain_clusters")
    .select("id, title, description")
    .eq("id", clusterId)
    .eq("owner_id", user.id)
    .single();

  if (fetchError) throw new Error(fetchError.message);
  if (!cluster) throw new Error("Cluster not found");

  // Insert opportunity using the same fields as the existing createOpportunity action
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

  revalidatePath("/clusters");

  return { opportunityId: data.id };
}
