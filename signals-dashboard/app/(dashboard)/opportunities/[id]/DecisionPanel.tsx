"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { setOpportunityStatus } from "./actions";

const STATUSES = [
  "investigating",
  "validating",
  "confirmed",
  "building",
  "launched",
  "killed",
] as const;

type Status = (typeof STATUSES)[number];

interface Props {
  opportunityId: string;
  currentStatus: string | null;
  killReasonInitial?: string | null;
}

export default function DecisionPanel({
  opportunityId,
  currentStatus,
  killReasonInitial,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [clickedStatus, setClickedStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showKillInput, setShowKillInput] = useState(false);
  const [killReason, setKillReason] = useState(killReasonInitial ?? "");

  function handleClick(status: Status) {
    if (status === "killed") {
      setShowKillInput(true);
      return;
    }
    submit(status);
  }

  function submit(status: Status, reason?: string) {
    setError(null);
    setSaved(false);
    setClickedStatus(status);
    setShowKillInput(false);
    startTransition(async () => {
      try {
        await setOpportunityStatus({
          opportunityId,
          status,
          killReason: reason,
        });
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update status");
      } finally {
        setClickedStatus(null);
      }
    });
  }

  function confirmKill() {
    submit("killed", killReason || undefined);
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-4)",
        background: "var(--color-bg-elevated)",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: "var(--text-base)",
          color: "var(--color-text-primary)",
          marginBottom: "var(--space-1)",
        }}
      >
        Decision
      </div>
      <div
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-tertiary)",
          marginBottom: "var(--space-3)",
        }}
      >
        Current status:{" "}
        <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>
          {currentStatus ?? "\u2014"}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {STATUSES.map((s) => {
          const isActive = currentStatus === s;
          const isClicked = clickedStatus === s;
          const isKilled = s === "killed";
          return (
            <button
              key={s}
              onClick={() => handleClick(s)}
              disabled={isPending}
              style={{
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: isActive
                  ? "2px solid var(--color-accent)"
                  : isKilled
                    ? "1px solid var(--color-error-border)"
                    : "1px solid var(--color-border)",
                background: isActive
                  ? "var(--color-accent-subtle)"
                  : isKilled
                    ? "var(--color-error-bg)"
                    : "var(--color-bg-elevated)",
                color: isActive
                  ? "var(--color-accent)"
                  : isKilled
                    ? "var(--color-error-text)"
                    : "var(--color-text-primary)",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
                transition: "all var(--duration-fast) var(--ease-default)",
              }}
            >
              {isClicked && isPending ? "Saving..." : s}
            </button>
          );
        })}
      </div>

      {/* Kill reason input */}
      {showKillInput && (
        <div
          className="animate-fade-in"
          style={{
            marginTop: "var(--space-3)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <textarea
            value={killReason}
            onChange={(e) => setKillReason(e.target.value)}
            placeholder="Kill reason (optional)"
            rows={2}
            style={{
              width: "100%",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-error-border)",
              fontSize: "var(--text-sm)",
              fontFamily: "inherit",
              outline: "none",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button onClick={confirmKill} disabled={isPending} variant="danger" size="sm">
              {isPending ? "Saving..." : "Confirm Kill"}
            </Button>
            <Button onClick={() => setShowKillInput(false)} disabled={isPending} variant="secondary" size="sm">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {saved && (
        <div
          className="animate-fade-in"
          style={{
            marginTop: "var(--space-2)",
            fontSize: "var(--text-sm)",
            color: "var(--color-success-text)",
            fontWeight: 600,
          }}
        >
          Saved
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: "var(--space-2)",
            fontSize: "var(--text-sm)",
            color: "var(--color-error-text)",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
