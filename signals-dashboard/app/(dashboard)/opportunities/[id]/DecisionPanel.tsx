"use client";

import { useState, useTransition } from "react";
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
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Decision</div>
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
        Current status:{" "}
        <span style={{ fontWeight: 700 }}>{currentStatus ?? "—"}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
                padding: "8px 14px",
                borderRadius: 8,
                border: isActive
                  ? "2px solid #1a1a1a"
                  : isKilled
                    ? "1px solid #fca5a5"
                    : "1px solid #e5e5e5",
                background: isActive
                  ? "#1a1a1a"
                  : isKilled
                    ? "#fef2f2"
                    : "white",
                color: isActive ? "white" : isKilled ? "#991b1b" : "#1a1a1a",
                fontWeight: 700,
                fontSize: 13,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isClicked && isPending ? "Saving..." : s}
            </button>
          );
        })}
      </div>

      {/* Kill reason input */}
      {showKillInput && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            value={killReason}
            onChange={(e) => setKillReason(e.target.value)}
            placeholder="Kill reason (optional)"
            rows={2}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #fca5a5",
              fontSize: 13,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={confirmKill}
              disabled={isPending}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #991b1b",
                background: "#991b1b",
                color: "white",
                fontWeight: 700,
                fontSize: 13,
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "Saving..." : "Confirm Kill"}
            </button>
            <button
              onClick={() => setShowKillInput(false)}
              disabled={isPending}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #e5e5e5",
                background: "white",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {saved && (
        <div style={{ marginTop: 8, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
          Saved
        </div>
      )}

      {error && (
        <div style={{ marginTop: 8, fontSize: 13, color: "#dc2626" }}>
          {error}
        </div>
      )}
    </div>
  );
}
