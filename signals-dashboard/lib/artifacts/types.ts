export interface HandoffV1 {
  opportunity_id: string;
  opportunity_name: string;
  source_type: "pain-first" | "product-first" | "unknown";
  summary: string;
  evidence_count: {
    raw_signals: number | null;
    sources: number | null;
  };
  pmf_snapshot: {
    demand: number | null;
    pain: number | null;
    competition: number | null;
    wtp: number | null;
  };
  build_decision: "BUILD" | "HOLD" | "KILL" | null;
  execution_surface: "EXTENSION" | "AGENT" | "HYBRID" | "SAAS" | null;
  why: string | null;
  created_at_iso: string;
}

export interface ChecklistV1 {
  atomic_value: string;
  value_surface: {
    inside_workflow: boolean;
    actionable: boolean;
    detectable_moment: boolean;
  };
  disqualifiers: {
    summarization_lookup: boolean;
    dom_scrape_no_authority: boolean;
    horizontal_ai_assistant: boolean;
    stateless_value: boolean;
    no_data_compounding: boolean;
    likely_native_feature: boolean;
  };
  durability_scores: {
    platform_encroachment: 0 | 1 | 2;
    workflow_state: 0 | 1 | 2;
    vertical_specificity: 0 | 1 | 2;
    permission_moat: 0 | 1 | 2;
    expansion_vector: 0 | 1 | 2;
    data_compounding: 0 | 1 | 2;
    total: number;
    hard_kill: boolean;
  };
  execution_surface: "EXTENSION" | "AGENT" | "HYBRID" | "SAAS" | null;
  verdict: "BUILD" | "HOLD" | "KILL" | null;
  reason: string;
  created_at_iso: string;
}

export interface ArtifactsV1 {
  handoff_v1?: HandoffV1;
  checklist_v1?: ChecklistV1;
}
