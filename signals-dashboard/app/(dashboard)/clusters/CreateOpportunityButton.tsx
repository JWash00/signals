"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createOpportunityFromCluster } from "./actions";

export default function CreateOpportunityButton({ clusterId }: { clusterId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const { opportunityId } = await createOpportunityFromCluster(clusterId);
        window.location.href = `/opportunities/${opportunityId}`;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create opportunity");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", flexShrink: 0 }}>
      <Button onClick={handleClick} disabled={isPending} loading={isPending} size="sm" variant="secondary">
        {isPending ? "Creating..." : "Create Opportunity"}
      </Button>

      {error && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-error-text)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
