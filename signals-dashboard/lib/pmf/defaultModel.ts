import type { ScoringWeights, ScoringThresholds, ScoringPenalties } from "./types";

export const DEFAULT_WEIGHTS: ScoringWeights = {
  demand: 0.25,
  pain: 0.25,
  wtp: 0.2,
  headroom: 0.2,
  timing: 0.1,
};

export const DEFAULT_THRESHOLDS: ScoringThresholds = {
  build: 80,
  invest: 75,
  monitor: 55,
};

export const DEFAULT_PENALTIES: ScoringPenalties = {
  saturation: 0.75,
};
