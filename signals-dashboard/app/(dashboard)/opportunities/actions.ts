"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/requireUser";

export async function createOpportunity(formData: FormData) {
  const { supabase } = await requireUser();

  const title = formData.get("title") as string;
  const cluster_id = formData.get("cluster_id") as string;
  const status = (formData.get("status") as string) || "new";

  if (!title) {
    throw new Error("Title is required");
  }

  const { data, error } = await supabase
    .from("opportunities")
    .insert({ title, cluster_id: cluster_id || null, status })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/opportunities/${data.id}`);
}

export async function addCompetitor(formData: FormData) {
  const { supabase } = await requireUser();

  const opportunity_id = formData.get("opportunity_id") as string;
  const name = formData.get("name") as string;
  const url = (formData.get("url") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!name) {
    throw new Error("Name is required");
  }

  // Look up the cluster_id for this opportunity
  const { data: opp } = await supabase
    .from("opportunities")
    .select("cluster_id")
    .eq("id", opportunity_id)
    .single();

  if (!opp?.cluster_id) {
    throw new Error("Opportunity has no cluster assigned");
  }

  const { error } = await supabase.from("competitors").insert({
    cluster_id: opp.cluster_id,
    name,
    url,
    vulnerability_assessment: notes,
  });

  if (error) {
    if (error.message.includes("max") || error.message.includes("limit") || error.code === "23514") {
      throw new Error("Competitor limit reached (max 4 per cluster). Remove one before adding another.");
    }
    throw new Error(error.message);
  }

  revalidatePath(`/opportunities/${opportunity_id}`);
}
