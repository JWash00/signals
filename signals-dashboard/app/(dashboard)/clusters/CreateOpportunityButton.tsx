"use client";

import { useState, useTransition } from "react";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
      <button
        onClick={handleClick}
        disabled={isPending}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #1a1a1a",
          background: "#1a1a1a",
          color: "white",
          cursor: isPending ? "not-allowed" : "pointer",
          fontWeight: 700,
          fontSize: 13,
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {isPending ? "Creating..." : "Create Opportunity"}
      </button>

      {error && (
        <div style={{ fontSize: 12, color: "#dc2626" }}>
          {error}
        </div>
      )}
    </div>
  );
}
