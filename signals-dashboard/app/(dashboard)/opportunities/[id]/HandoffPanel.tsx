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
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)", marginBottom: "var(--space-4)" }}>
          No handoff generated yet.
        </p>
        {error && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-error-text)", marginBottom: "var(--space-2)" }}>
            {error}
          </p>
        )}
        <Button onClick={handleGenerate} disabled={isPending} loading={isPending}>
          {isPending ? "Generating..." : "Generate Handoff (v1)"}
        </Button>
      </Card>
    );
  }

  return (
    <Card title="Handoff (v1)">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--text-sm)" }}>
        <Row label="Opportunity" value={handoff.opportunity_name} />
        <Row label="Source Type" value={handoff.source_type} />
        <Row label="Summary" value={handoff.summary || "\u2014"} />
        <Row
          label="Evidence"
          value={`${handoff.evidence_count.raw_signals ?? 0} signals, ${handoff.evidence_count.sources ?? 0} sources`}
        />
        <div>
          <span style={{ fontWeight: 500, color: "var(--color-text-secondary)" }}>PMF Snapshot</span>
          <div style={{ marginTop: "var(--space-1)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", fontSize: "var(--text-xs)" }}>
            <span>Demand: {handoff.pmf_snapshot.demand ?? "\u2014"}</span>
            <span>Pain: {handoff.pmf_snapshot.pain ?? "\u2014"}</span>
            <span>Competition: {handoff.pmf_snapshot.competition ?? "\u2014"}</span>
            <span>WTP: {handoff.pmf_snapshot.wtp ?? "\u2014"}</span>
          </div>
        </div>
        <Row label="Build Decision" value={handoff.build_decision ?? "\u2014"} />
        <Row label="Execution Surface" value={handoff.execution_surface ?? "\u2014"} />
        <Row label="Why" value={handoff.why ?? "\u2014"} />
        <Row label="Created" value={new Date(handoff.created_at_iso).toLocaleString()} />
      </div>
      <div style={{ marginTop: "var(--space-4)" }}>
        {error && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-error-text)", marginBottom: "var(--space-2)" }}>
            {error}
          </p>
        )}
        <Button onClick={handleGenerate} disabled={isPending} loading={isPending} variant="secondary">
          {isPending ? "Regenerating..." : "Regenerate Handoff"}
        </Button>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontWeight: 500, color: "var(--color-text-secondary)" }}>{label}: </span>
      <span style={{ color: "var(--color-text-primary)" }}>{value}</span>
    </div>
  );
}
