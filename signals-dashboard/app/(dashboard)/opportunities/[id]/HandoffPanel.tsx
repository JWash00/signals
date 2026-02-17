"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { HandoffV1 } from "@/lib/artifacts/types";
import { generateHandoffV1 } from "./actions";

interface HandoffPanelProps {
  opportunityId: string;
  handoff: HandoffV1 | null;
}

export function HandoffPanel({ opportunityId, handoff }: HandoffPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateHandoffV1(opportunityId);
      if (!result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  if (!handoff) {
    return (
      <Card title="Handoff">
        <p className="mb-4 text-sm text-gray-500">
          No handoff generated yet.
        </p>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <Button onClick={handleGenerate} disabled={isPending}>
          {isPending ? "Generating..." : "Generate Handoff (v1)"}
        </Button>
      </Card>
    );
  }

  return (
    <Card title="Handoff (v1)">
      <div className="space-y-3 text-sm">
        <Row label="Opportunity" value={handoff.opportunity_name} />
        <Row label="Source Type" value={handoff.source_type} />
        <Row label="Summary" value={handoff.summary || "—"} />
        <Row
          label="Evidence"
          value={`${handoff.evidence_count.raw_signals ?? 0} signals, ${handoff.evidence_count.sources ?? 0} sources`}
        />
        <div>
          <span className="font-medium text-gray-700">PMF Snapshot</span>
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
            <span>Demand: {handoff.pmf_snapshot.demand ?? "—"}</span>
            <span>Pain: {handoff.pmf_snapshot.pain ?? "—"}</span>
            <span>Competition: {handoff.pmf_snapshot.competition ?? "—"}</span>
            <span>WTP: {handoff.pmf_snapshot.wtp ?? "—"}</span>
          </div>
        </div>
        <Row label="Build Decision" value={handoff.build_decision ?? "—"} />
        <Row label="Execution Surface" value={handoff.execution_surface ?? "—"} />
        <Row label="Why" value={handoff.why ?? "—"} />
        <Row label="Created" value={new Date(handoff.created_at_iso).toLocaleString()} />
      </div>
      <div className="mt-4">
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <Button onClick={handleGenerate} disabled={isPending} variant="secondary">
          {isPending ? "Regenerating..." : "Regenerate Handoff"}
        </Button>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-gray-700">{label}: </span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}
