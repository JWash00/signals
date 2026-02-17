"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/requireUser";
import { computeScore } from "@/lib/pmf/engine";
import { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS, DEFAULT_PENALTIES } from "@/lib/pmf/defaultModel";
import type { AnalysisInputs, ScoringModel } from "@/lib/pmf/types";

export async function runAnalysis(formData: FormData) {
  const { user, supabase } = await requireUser();

  const opportunity_id = formData.get("opportunity_id") as string;

  const inputs: AnalysisInputs = {
    demand_strength: parseFloat(formData.get("demand_strength") as string),
    pain_intensity: parseFloat(formData.get("pain_intensity") as string),
    willingness_to_pay: parseFloat(formData.get("willingness_to_pay") as string),
    competitive_headroom: parseFloat(formData.get("competitive_headroom") as string),
    saturation: parseFloat(formData.get("saturation") as string),
    timing: parseFloat(formData.get("timing") as string),
  };

  // Load active scoring model for user
  let { data: model } = await supabase
    .from("scoring_models")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .single();

  // If no active model, create a default one
  if (!model) {
    const { data: newModel, error: createError } = await supabase
      .from("scoring_models")
      .insert({
        user_id: user.id,
        name: "Default PMF Model",
        version: 1,
        active: true,
        weights: DEFAULT_WEIGHTS,
        thresholds: DEFAULT_THRESHOLDS,
        penalties: DEFAULT_PENALTIES,
      })
      .select("*")
      .single();

    if (createError) {
      throw new Error(createError.message);
    }
    model = newModel;
  }

  const typedModel = model as unknown as ScoringModel;

  const result = computeScore(inputs, {
    weights: typedModel.weights,
    thresholds: typedModel.thresholds,
    penalties: typedModel.penalties,
  });

  const { error } = await supabase.from("scoring_snapshots").insert({
    opportunity_id,
    model_id: typedModel.id,
    model_version: typedModel.version,
    verdict: result.verdict,
    confidence: result.confidence,
    score_breakdown: result.score_breakdown,
    explanations: result.explanations,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/opportunities/${opportunity_id}`);
}
