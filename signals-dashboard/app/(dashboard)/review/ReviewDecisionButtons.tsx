"use client";

import { useState, useTransition } from "react";
import { setSignalStatus } from "./actions";

interface Props {
  id: string;
  currentStatus: "new" | "approved" | "rejected";
}

export default function ReviewDecisionButtons({ id, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(status: "approved" | "rejected" | "new") {
    setError(null);
    startTransition(async () => {
      try {
        await setSignalStatus(id, status);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update status");
      }
    });
  }

  const showApprove = currentStatus === "new" || currentStatus === "rejected";
  const showReject = currentStatus === "new" || currentStatus === "approved";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
      {showApprove && (
        <button
          onClick={() => act("approved")}
          disabled={isPending}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #1a1a1a",
            background: "#1a1a1a",
            color: "white",
            cursor: isPending ? "not-allowed" : "pointer",
            fontWeight: 700,
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? "Saving..." : "Approve"}
        </button>
      )}

      {showReject && (
        <button
          onClick={() => act("rejected")}
          disabled={isPending}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e5e5e5",
            background: "white",
            cursor: isPending ? "not-allowed" : "pointer",
            fontWeight: 700,
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? "Saving..." : "Reject"}
        </button>
      )}

      {error && (
        <div style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>
          {error}
        </div>
      )}
    </div>
  );
}
