"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/requireUser";
import {
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  DEFAULT_PENALTIES,
} from "@/lib/pmf/defaultModel";

export async function createDefaultModel() {
  const { user, supabase } = await requireUser();

  const { error } = await supabase.from("scoring_models").insert({
    user_id: user.id,
    name: "Default PMF Model",
    version: 1,
    active: true,
    weights: DEFAULT_WEIGHTS,
    thresholds: DEFAULT_THRESHOLDS,
    penalties: DEFAULT_PENALTIES,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/models");
}

export async function setActiveModel(formData: FormData) {
  const { user, supabase } = await requireUser();
  const modelId = formData.get("model_id") as string;

  // Deactivate all models for user
  await supabase
    .from("scoring_models")
    .update({ active: false })
    .eq("user_id", user.id);

  // Activate selected
  const { error } = await supabase
    .from("scoring_models")
    .update({ active: true })
    .eq("id", modelId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/models");
}

export async function updateModel(formData: FormData) {
  const { user, supabase } = await requireUser();
  const modelId = formData.get("model_id") as string;
  const weightsRaw = formData.get("weights") as string;
  const thresholdsRaw = formData.get("thresholds") as string;
  const penaltiesRaw = formData.get("penalties") as string;

  // Validate JSON
  let weights, thresholds, penalties;
  try {
    weights = JSON.parse(weightsRaw);
    thresholds = JSON.parse(thresholdsRaw);
    penalties = JSON.parse(penaltiesRaw);
  } catch {
    throw new Error("Invalid JSON in weights, thresholds, or penalties");
  }

  // Validate weight keys
  const requiredWeights = ["demand", "pain", "wtp", "headroom", "timing"];
  for (const key of requiredWeights) {
    if (typeof weights[key] !== "number" || weights[key] < 0 || weights[key] > 1) {
      throw new Error(`Weight "${key}" must be a number between 0 and 1`);
    }
  }

  const requiredThresholds = ["build", "invest", "monitor"];
  for (const key of requiredThresholds) {
    if (typeof thresholds[key] !== "number" || thresholds[key] < 0 || thresholds[key] > 100) {
      throw new Error(`Threshold "${key}" must be a number between 0 and 100`);
    }
  }

  if (typeof penalties.saturation !== "number" || penalties.saturation < 0 || penalties.saturation > 1) {
    throw new Error("Penalty saturation must be a number between 0 and 1");
  }

  const { error } = await supabase
    .from("scoring_models")
    .update({ weights, thresholds, penalties, updated_at: new Date().toISOString() })
    .eq("id", modelId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/models");
}
