"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", flexShrink: 0 }}>
      <Button onClick={handleClick} disabled={isPending} loading={isPending} size="sm">
        {isPending ? "Saving..." : "Create Cluster"}
      </Button>

      {success && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-success-text)", fontWeight: 600 }}>
          Cluster created
        </div>
      )}

      {error && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-error-text)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
