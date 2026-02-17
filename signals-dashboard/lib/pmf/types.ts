export interface ScoringWeights {
  demand: number;
  pain: number;
  wtp: number;
  headroom: number;
  timing: number;
}

export interface ScoringThresholds {
  build: number;
  invest: number;
  monitor: number;
}

export interface ScoringPenalties {
  saturation: number;
}

export interface ScoringModel {
  id: string;
  user_id: string;
  name: string;
  version: number;
  active: boolean;
  weights: ScoringWeights;
  thresholds: ScoringThresholds;
  penalties: ScoringPenalties;
  created_at: string;
  updated_at: string;
}

export type Verdict = "BUILD" | "INVEST" | "MONITOR" | "PASS";

export interface AnalysisInputs {
  demand_strength: number;
  pain_intensity: number;
  willingness_to_pay: number;
  competitive_headroom: number;
  saturation: number;
  timing: number;
}

export interface Contradiction {
  rule: string;
  description: string;
}

export interface Explanations {
  top_positive: { factor: string; contribution: number }[];
  top_negative: { factor: string; impact: number }[];
  contradictions: Contradiction[];
  missing: string[];
}

export interface ScoreBreakdown {
  base: number;
  saturation_penalty: number;
  final: number;
  components: Record<string, number>;
}

export interface ScoringResult {
  score_total: number;
  verdict: Verdict;
  confidence: number;
  score_breakdown: ScoreBreakdown;
  explanations: Explanations;
}
