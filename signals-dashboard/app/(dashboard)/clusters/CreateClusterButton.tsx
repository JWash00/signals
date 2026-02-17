"use client";

import { useState, useTransition } from "react";
import { createClusterFromSignal } from "./actions";

export default function CreateClusterButton({ signalId }: { signalId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleClick() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await createClusterFromSignal(signalId);
        setSuccess(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create cluster");
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
        {isPending ? "Saving..." : "Create Cluster"}
      </button>

      {success && (
        <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
          Cluster created
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: "#dc2626" }}>
          {error}
        </div>
      )}
    </div>
  );
}
