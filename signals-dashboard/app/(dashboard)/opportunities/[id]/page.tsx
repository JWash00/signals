import { requireUser } from "@/lib/auth/requireUser";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ScoreCard } from "@/components/pmf/ScoreCard";
import { JsonBlock } from "@/components/pmf/JsonBlock";
import { addCompetitor } from "../actions";
import { runAnalysis } from "../../runs/actions";
import {
  getLatestSnapshotForOpportunity,
  createSnapshotWithArtifacts,
} from "@/lib/artifacts/snapshots";
import { HandoffPanel } from "./HandoffPanel";
import { ChecklistPanel } from "./ChecklistPanel";
import DecisionPanel from "./DecisionPanel";
import { sha256Hex } from "@/lib/hash";
import { generateOpportunitySummaryV1 } from "@/lib/anthropic";
import type { AISummaryV1 } from "@/lib/anthropic";
import type { Verdict } from "@/lib/pmf/types";
import type { ArtifactsV1 } from "@/lib/artifacts/types";

interface OpportunityDetailProps {
  params: Promise<{ id: string }>;
}

export default async function OpportunityDetailPage({
  params,
}: OpportunityDetailProps) {
  const { id } = await params;
  const { user, supabase } = await requireUser();

  // ── 1. Fetch opportunity from detail view (for display) ────────
  const { data: detail, error } = await supabase
    .from("opportunity_detail_v1")
    .select("*")
    .eq("opportunity_id", id)
    .single();

  if (error || !detail) {
    return (
      <div
        style={{
          padding: "var(--space-4)",
          borderRadius: "var(--radius-md)",
          background: "var(--color-error-bg)",
          color: "var(--color-error-text)",
          border: "1px solid var(--color-error-border)",
          fontSize: "var(--text-sm)",
        }}
      >
        {error?.message ?? "Opportunity not found"}
      </div>
    );
  }

  const hasScore = detail.score_total != null && detail.verdict != null;

  // ── 2. Fetch opportunity row for cluster_id + title ────────────
  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, title, cluster_id")
    .eq("id", id)
    .single();

  // ── 3. Build input string for hash ─────────────────────────────
  let inputsString = opp?.title ?? "";
  let clusterTitle = "";
  let clusterDescription: string | null = null;

  if (opp?.cluster_id) {
    const { data: cluster } = await supabase
      .from("pain_clusters")
      .select("title, description")
      .eq("id", opp.cluster_id)
      .single();

    if (cluster) {
      clusterTitle = cluster.title ?? "";
      clusterDescription = cluster.description ?? null;
      inputsString += clusterTitle + (clusterDescription ?? "");
    }
  }

  const inputHash = sha256Hex(inputsString);

  // ── 4. Get or create snapshot ──────────────────────────────────
  let snapshot = await getLatestSnapshotForOpportunity(id);

  if (!snapshot) {
    await createSnapshotWithArtifacts({
      opportunity_id: id,
      newArtifacts: {},
    });
    snapshot = await getLatestSnapshotForOpportunity(id);
  }

  // ── 5. Extract existing artifacts + AI summary ─────────────────
  let artifacts: ArtifactsV1 = {};
  let aiSummary: AISummaryV1 | null = null;
  let existingHash: string | null = null;

  if (snapshot?.explanations) {
    const expl = snapshot.explanations as Record<string, unknown>;
    if (expl.artifacts_v1 && typeof expl.artifacts_v1 === "object") {
      artifacts = expl.artifacts_v1 as ArtifactsV1;
    }
    if (expl.ai_summary_v1 && typeof expl.ai_summary_v1 === "object") {
      const stored = expl.ai_summary_v1 as Record<string, unknown>;
      const meta = stored._meta as Record<string, unknown> | undefined;
      existingHash = (meta?.input_hash as string) ?? null;
      aiSummary = stored as unknown as AISummaryV1;
    }
  }

  // ── 6. Decide staleness ────────────────────────────────────────
  const needsAi = !aiSummary || existingHash !== inputHash;

  // ── 7. Regenerate if stale ─────────────────────────────────────
  if (needsAi) {
    try {
      const result = await generateOpportunitySummaryV1({
        opportunityTitle: opp?.title ?? "",
        clusterTitle,
        clusterDescription,
        opportunityId: id,
        clusterId: opp?.cluster_id ?? undefined,
      });

      // Build the stored object with _meta
      const summaryWithMeta = {
        ...result.fields,
        _meta: {
          input_hash: inputHash,
          generated_at: new Date().toISOString(),
          model: result.model,
        },
      };

      // Merge into explanations without overwriting other keys
      const supabaseForUpdate = await createClient();
      const existingExplanations =
        (snapshot?.explanations as Record<string, unknown>) ?? {};

      const mergedExplanations = {
        ...existingExplanations,
        ai_summary_v1: summaryWithMeta,
      };

      const { error: updateError } = await supabaseForUpdate
        .from("scoring_snapshots")
        .update({ explanations: mergedExplanations })
        .eq("opportunity_id", id)
        .eq("snapshot_date", new Date().toISOString().slice(0, 10));

      if (updateError) {
        console.error("Failed to save AI summary:", updateError.message);
      } else {
        // Update local state for rendering
        aiSummary = result.fields;
      }
    } catch (e) {
      console.error(
        "AI summary regeneration failed:",
        e instanceof Error ? e.message : e,
      );
      // Do NOT throw — page still renders
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      {/* Header */}
      <div>
        <h1
          style={{
            fontSize: "var(--text-2xl)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          {(detail.title as string) ?? `Opportunity ${id}`}
        </h1>
        {detail.status && (
          <div style={{ marginTop: "var(--space-2)" }}>
            <Badge variant="default">{detail.status as string}</Badge>
          </div>
        )}
      </div>

      {/* Decision */}
      <DecisionPanel
        opportunityId={id}
        currentStatus={(detail.status as string) ?? null}
        killReasonInitial={(detail.kill_reason as string) ?? null}
      />

      {/* AI Summary (v1) */}
      <Card title="AI Summary (v1)">
        {aiSummary ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <p
              style={{
                fontSize: "var(--text-base)",
                color: "var(--color-text-primary)",
                lineHeight: "var(--leading-relaxed)",
                margin: 0,
              }}
            >
              {aiSummary.summary}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-4)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: "var(--color-text-tertiary)",
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.05em",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  Core Pain
                </div>
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {aiSummary.core_pain}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: "var(--color-text-tertiary)",
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.05em",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  Who
                </div>
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {aiSummary.who}
                </div>
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  color: "var(--color-text-tertiary)",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.05em",
                  marginBottom: "var(--space-1)",
                }}
              >
                Why Now
              </div>
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {aiSummary.why_now}
              </div>
            </div>
            {aiSummary.assumptions.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: "var(--color-text-tertiary)",
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.05em",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  Key Assumptions
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "var(--space-5)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-1)",
                  }}
                >
                  {aiSummary.assumptions.map((a, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-tertiary)",
              margin: 0,
            }}
          >
            AI summary not available yet.
          </p>
        )}
      </Card>

      {/* Latest Score */}
      {hasScore && (
        <ScoreCard
          score={detail.score_total as number}
          verdict={detail.verdict as Verdict}
          confidence={(detail.confidence as number) ?? 0}
        />
      )}

      {/* Handoff Artifact */}
      <HandoffPanel
        opportunityId={id}
        handoff={artifacts.handoff_v1 ?? null}
      />

      {/* Checklist Artifact */}
      <ChecklistPanel
        opportunityId={id}
        checklist={artifacts.checklist_v1 ?? null}
      />

      {/* Score Breakdown */}
      {detail.score_breakdown && (
        <Card title="Score Breakdown">
          <JsonBlock data={detail.score_breakdown} />
        </Card>
      )}

      {/* Explanations */}
      {detail.explanations && (
        <Card title="Explanations">
          <JsonBlock data={detail.explanations} />
        </Card>
      )}

      {/* Competitors */}
      <Card title="Competitors">
        {detail.competitors ? (
          <JsonBlock data={detail.competitors} />
        ) : (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-tertiary)",
            }}
          >
            No competitors yet
          </p>
        )}
      </Card>

      {/* Recent Signals */}
      {detail.recent_signals && (
        <Card title="Recent Signals">
          <JsonBlock data={detail.recent_signals} />
        </Card>
      )}

      {/* Add Competitor Form */}
      <Card title="Add Competitor">
        <form
          action={addCompetitor}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <input type="hidden" name="opportunity_id" value={id} />
          <Input
            id="comp-name"
            name="name"
            label="Name"
            required
            placeholder="Competitor name"
          />
          <Input
            id="comp-url"
            name="url"
            label="URL"
            placeholder="https://..."
          />
          <Input
            id="comp-notes"
            name="notes"
            label="Notes"
            placeholder="Optional notes"
          />
          <Button type="submit">Add Competitor</Button>
        </form>
      </Card>

      {/* Run Analysis Form */}
      <Card title="Run Analysis">
        <form
          action={runAnalysis}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <input type="hidden" name="opportunity_id" value={id} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-4)",
            }}
          >
            <Input
              id="demand_strength"
              name="demand_strength"
              label="Demand Strength (0-1)"
              type="number"
              step="0.01"
              min="0"
              max="1"
              required
              placeholder="0.0"
            />
            <Input
              id="pain_intensity"
              name="pain_intensity"
              label="Pain Intensity (0-1)"
              type="number"
              step="0.01"
              min="0"
              max="1"
              required
              placeholder="0.0"
            />
            <Input
              id="willingness_to_pay"
              name="willingness_to_pay"
              label="Willingness to Pay (0-1)"
              type="number"
              step="0.01"
              min="0"
              max="1"
              required
              placeholder="0.0"
            />
            <Input
              id="competitive_headroom"
              name="competitive_headroom"
              label="Competitive Headroom (0-1)"
              type="number"
              step="0.01"
              min="0"
              max="1"
              required
              placeholder="0.0"
            />
            <Input
              id="saturation"
              name="saturation"
              label="Saturation (0-1)"
              type="number"
              step="0.01"
              min="0"
              max="1"
              required
              placeholder="0.0"
            />
            <Input
              id="timing"
              name="timing"
              label="Timing (0-1)"
              type="number"
              step="0.01"
              min="0"
              max="1"
              required
              placeholder="0.0"
            />
          </div>
          <Button type="submit">Run Analysis</Button>
        </form>
      </Card>
    </div>
  );
}
