import type {
  AnalysisInputs,
  ScoringModel,
  ScoringResult,
  Verdict,
  Contradiction,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeScore(
  inputs: AnalysisInputs,
  model: Pick<ScoringModel, "weights" | "thresholds" | "penalties">,
): ScoringResult {
  const { weights, thresholds, penalties } = model;

  const components: Record<string, number> = {
    demand: weights.demand * inputs.demand_strength,
    pain: weights.pain * inputs.pain_intensity,
    wtp: weights.wtp * inputs.willingness_to_pay,
    headroom: weights.headroom * inputs.competitive_headroom,
    timing: weights.timing * inputs.timing,
  };

  const base =
    100 *
    (components.demand +
      components.pain +
      components.wtp +
      components.headroom +
      components.timing);

  const satPenalty = penalties.saturation * 100 * inputs.saturation;
  const final = clamp(base - satPenalty, 0, 100);

  // Contradictions
  const contradictions: Contradiction[] = [];
  if (inputs.demand_strength >= 0.7 && inputs.willingness_to_pay <= 0.3) {
    contradictions.push({
      rule: "demand_vs_wtp",
      description:
        "High demand (>=0.7) but low willingness to pay (<=0.3)",
    });
  }
  if (
    inputs.pain_intensity >= 0.7 &&
    inputs.competitive_headroom <= 0.2 &&
    inputs.saturation >= 0.7
  ) {
    contradictions.push({
      rule: "pain_vs_headroom_saturation",
      description:
        "High pain (>=0.7) but low headroom (<=0.2) and high saturation (>=0.7)",
    });
  }

  // Missing inputs
  const missingInputs: string[] = [];
  const inputEntries: [string, number][] = [
    ["demand_strength", inputs.demand_strength],
    ["pain_intensity", inputs.pain_intensity],
    ["willingness_to_pay", inputs.willingness_to_pay],
    ["competitive_headroom", inputs.competitive_headroom],
    ["saturation", inputs.saturation],
    ["timing", inputs.timing],
  ];
  for (const [name, val] of inputEntries) {
    if (val === undefined || val === null || isNaN(val)) {
      missingInputs.push(name);
    }
  }

  // Confidence
  let confidence = 0.85;
  confidence -= 0.1 * contradictions.length;
  confidence -= 0.05 * missingInputs.length;
  confidence = clamp(confidence, 0.1, 0.95);

  // Verdict
  let verdict: Verdict;
  if (inputs.saturation >= 0.8) {
    if (final >= thresholds.invest && inputs.saturation < 0.6) {
      verdict = "INVEST";
    } else if (final >= thresholds.monitor) {
      verdict = "MONITOR";
    } else {
      verdict = "PASS";
    }
  } else if (final >= thresholds.build && inputs.saturation < 0.6) {
    verdict = "BUILD";
  } else if (final >= thresholds.invest && inputs.saturation < 0.6) {
    verdict = "INVEST";
  } else if (final >= thresholds.monitor) {
    verdict = "MONITOR";
  } else {
    verdict = "PASS";
  }

  // Explanations
  const sortedComponents = Object.entries(components)
    .map(([factor, value]) => ({
      factor,
      contribution: +(value * 100).toFixed(2),
    }))
    .sort((a, b) => b.contribution - a.contribution);

  const topPositive = sortedComponents.slice(0, 3);

  const topNegative: { factor: string; impact: number }[] = [];
  if (satPenalty > 0) {
    topNegative.push({
      factor: "saturation_penalty",
      impact: +(-satPenalty).toFixed(2),
    });
  }
  const weakest = sortedComponents[sortedComponents.length - 1];
  if (weakest) {
    topNegative.push({
      factor: `weak_${weakest.factor}`,
      impact: weakest.contribution,
    });
  }

  return {
    score_total: +final.toFixed(2),
    verdict,
    confidence: +confidence.toFixed(2),
    score_breakdown: {
      base: +base.toFixed(2),
      saturation_penalty: +satPenalty.toFixed(2),
      final: +final.toFixed(2),
      components: Object.fromEntries(
        Object.entries(components).map(([k, v]) => [
          k,
          +(v * 100).toFixed(2),
        ]),
      ),
    },
    explanations: {
      top_positive: topPositive,
      top_negative: topNegative,
      contradictions,
      missing: missingInputs,
    },
  };
}
