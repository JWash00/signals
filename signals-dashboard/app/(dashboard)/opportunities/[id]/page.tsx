import { requireUser } from "@/lib/auth/requireUser";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ScoreCard } from "@/components/pmf/ScoreCard";
import { JsonBlock } from "@/components/pmf/JsonBlock";
import { addCompetitor } from "../actions";
import { runAnalysis } from "../../runs/actions";
import { getLatestSnapshotForOpportunity } from "@/lib/artifacts/snapshots";
import { HandoffPanel } from "./HandoffPanel";
import { ChecklistPanel } from "./ChecklistPanel";
import DecisionPanel from "./DecisionPanel";
import type { Verdict } from "@/lib/pmf/types";
import type { ArtifactsV1 } from "@/lib/artifacts/types";

interface OpportunityDetailProps {
  params: Promise<{ id: string }>;
}

export default async function OpportunityDetailPage({
  params,
}: OpportunityDetailProps) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: detail, error } = await supabase
    .from("opportunity_detail_v1")
    .select("*")
    .eq("opportunity_id", id)
    .single();

  if (error || !detail) {
    return (
      <div className="rounded bg-red-50 p-4 text-red-600">
        {error?.message ?? "Opportunity not found"}
      </div>
    );
  }

  const hasScore =
    detail.score_total != null && detail.verdict != null;

  // Parse artifacts from latest snapshot
  let artifacts: ArtifactsV1 = {};
  try {
    const latestSnapshot = await getLatestSnapshotForOpportunity(id);
    if (latestSnapshot?.explanations) {
      const expl = latestSnapshot.explanations as Record<string, unknown>;
      if (expl.artifacts_v1 && typeof expl.artifacts_v1 === "object") {
        artifacts = expl.artifacts_v1 as ArtifactsV1;
      }
    }
  } catch {
    // Snapshot read failed — artifacts stay empty
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {detail.title ?? `Opportunity ${id}`}
        </h1>
        {detail.status && (
          <span className="mt-1 inline-block rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
            {detail.status}
          </span>
        )}
      </div>

      {/* Decision */}
      <DecisionPanel
        opportunityId={id}
        currentStatus={(detail.status as string) ?? null}
        killReasonInitial={(detail.kill_reason as string) ?? null}
      />

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
          <p className="text-sm text-gray-500">No competitors yet</p>
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
        <form action={addCompetitor} className="flex flex-col gap-4">
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
        <form action={runAnalysis} className="flex flex-col gap-4">
          <input type="hidden" name="opportunity_id" value={id} />
          <div className="grid grid-cols-2 gap-4">
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
