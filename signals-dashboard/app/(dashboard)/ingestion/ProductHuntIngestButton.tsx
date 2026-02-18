"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  runProductHuntLive,
  runProductHuntBackfill,
} from "./actions";

function ResultMessage({ inserted, skipped }: { inserted: number; skipped: number }) {
  if (inserted === 0 && skipped === 0) {
    return (
      <p className="text-sm text-amber-600">
        No posts found in this window. Try increasing the window.
      </p>
    );
  }
  if (inserted === 0 && skipped > 0) {
    return (
      <p className="text-sm text-gray-500">
        Everything in this window was already saved. ({skipped} duplicates)
      </p>
    );
  }
  return (
    <p className="text-sm text-gray-700">
      Inserted: <span className="font-semibold">{inserted}</span>, Skipped:{" "}
      <span className="font-semibold">{skipped}</span>
    </p>
  );
}

export function ProductHuntIngestButton() {
  const router = useRouter();

  // Live state
  const [liveResult, setLiveResult] = useState<{
    inserted: number;
    skipped: number;
    windowHours: number;
  } | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [livePending, startLiveTransition] = useTransition();

  // Backfill state
  const [backfillResult, setBackfillResult] = useState<{
    inserted: number;
    skipped: number;
    windowDays: number;
    pagesRun: number;
    pageSize: number;
  } | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [backfillPending, startBackfillTransition] = useTransition();

  function handleLive() {
    setLiveError(null);
    setLiveResult(null);
    startLiveTransition(async () => {
      const res = await runProductHuntLive();
      if (!res.ok) {
        setLiveError(res.error);
      } else {
        setLiveResult({
          inserted: res.inserted,
          skipped: res.skipped,
          windowHours: res.windowHours,
        });
        router.refresh();
      }
    });
  }

  function handleBackfill() {
    setBackfillError(null);
    setBackfillResult(null);
    startBackfillTransition(async () => {
      const res = await runProductHuntBackfill();
      if (!res.ok) {
        setBackfillError(res.error);
      } else {
        setBackfillResult({
          inserted: res.inserted,
          skipped: res.skipped,
          windowDays: res.windowDays,
          pagesRun: res.pagesRun,
          pageSize: res.pageSize,
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Live */}
      <div className="space-y-2">
        <Button onClick={handleLive} disabled={livePending || backfillPending}>
          {livePending ? "Ingesting..." : "Ingest Product Hunt (Live)"}
        </Button>
        <p className="text-xs text-gray-400">
          Window: last{" "}
          {liveResult?.windowHours ?? process.env.NEXT_PUBLIC_PH_LIVE_HOURS ?? "24"}{" "}
          hours
        </p>
        {liveResult && (
          <ResultMessage
            inserted={liveResult.inserted}
            skipped={liveResult.skipped}
          />
        )}
        {liveError && <p className="text-sm text-red-600">{liveError}</p>}
      </div>

      {/* Backfill */}
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <Button onClick={handleBackfill} disabled={livePending || backfillPending}>
          {backfillPending ? "Backfilling..." : "Backfill Product Hunt (Historical)"}
        </Button>
        <p className="text-xs text-gray-400">
          Window: last{" "}
          {backfillResult?.windowDays ?? "30"} days, Pages:{" "}
          {backfillResult?.pagesRun ?? "5"}, Page size:{" "}
          {backfillResult?.pageSize ?? "20"}
        </p>
        {backfillResult && (
          <ResultMessage
            inserted={backfillResult.inserted}
            skipped={backfillResult.skipped}
          />
        )}
        {backfillError && <p className="text-sm text-red-600">{backfillError}</p>}
      </div>
    </div>
  );
}
