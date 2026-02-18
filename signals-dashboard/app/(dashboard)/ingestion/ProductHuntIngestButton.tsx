"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  runProductHuntLive,
  runProductHuntTodaysWinners,
  runProductHuntBackfill,
} from "./actions";

function ResultMessage({
  fetched,
  inserted,
  skipped,
  invalid,
  note,
}: {
  fetched: number;
  inserted: number;
  skipped: number;
  invalid: number;
  note?: string;
}) {
  return (
    <div className="space-y-1">
      {fetched === 0 ? (
        <p className="text-sm text-amber-600">
          No posts found in this window.
        </p>
      ) : (
        <p className="text-sm text-gray-700">
          Fetched from Product Hunt:{" "}
          <span className="font-semibold">{fetched}</span>
          {" · "}New to Signals (inserted):{" "}
          <span className="font-semibold">{inserted}</span>
          {" · "}Already saved (duplicates):{" "}
          <span className="font-semibold">{skipped}</span>
          {invalid > 0 && (
            <>
              {" · "}
              <span className="text-red-600">
                Skipped invalid: <span className="font-semibold">{invalid}</span>
              </span>
            </>
          )}
        </p>
      )}
      {note && <p className="text-xs text-gray-400 italic">{note}</p>}
    </div>
  );
}

export function ProductHuntIngestButton() {
  const router = useRouter();

  // Shared pending check — disable all buttons while any is running
  const [livePending, startLiveTransition] = useTransition();
  const [todayPending, startTodayTransition] = useTransition();
  const [backfillPending, startBackfillTransition] = useTransition();
  const anyPending = livePending || todayPending || backfillPending;

  // Live state
  const [liveResult, setLiveResult] = useState<{
    fetched: number;
    inserted: number;
    skipped: number;
    invalid: number;
    windowLabel: string;
  } | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Today state
  const [todayResult, setTodayResult] = useState<{
    fetched: number;
    inserted: number;
    skipped: number;
    invalid: number;
    windowLabel: string;
    note?: string;
  } | null>(null);
  const [todayError, setTodayError] = useState<string | null>(null);

  // Backfill state
  const [backfillResult, setBackfillResult] = useState<{
    fetched: number;
    inserted: number;
    skipped: number;
    invalid: number;
    windowLabel: string;
    pagesRun: number;
    backfillComplete: boolean;
  } | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  function handleLive() {
    setLiveError(null);
    setLiveResult(null);
    startLiveTransition(async () => {
      const res = await runProductHuntLive();
      if (!res.ok) {
        setLiveError(res.error);
      } else {
        setLiveResult(res);
        router.refresh();
      }
    });
  }

  function handleToday() {
    setTodayError(null);
    setTodayResult(null);
    startTodayTransition(async () => {
      const res = await runProductHuntTodaysWinners();
      if (!res.ok) {
        setTodayError(res.error);
      } else {
        setTodayResult(res);
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
        setBackfillResult(res);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Live */}
      <div className="space-y-2">
        <Button onClick={handleLive} disabled={anyPending}>
          {livePending ? "Ingesting..." : "Ingest Product Hunt (Live)"}
        </Button>
        <p className="text-xs text-gray-400">
          Pulls newest posts since last run (or last{" "}
          {liveResult?.windowLabel ?? "24h"} on first run).
        </p>
        {liveResult && (
          <ResultMessage
            fetched={liveResult.fetched}
            inserted={liveResult.inserted}
            skipped={liveResult.skipped}
            invalid={liveResult.invalid}
          />
        )}
        {liveError && <p className="text-sm text-red-600">{liveError}</p>}
      </div>

      {/* Today (newest since midnight UTC) */}
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <Button onClick={handleToday} disabled={anyPending}>
          {todayPending
            ? "Ingesting..."
            : "Ingest Product Hunt (Today)"}
        </Button>
        <p className="text-xs text-gray-400">
          Pulls today&apos;s posts since midnight UTC.
        </p>
        {todayResult && (
          <ResultMessage
            fetched={todayResult.fetched}
            inserted={todayResult.inserted}
            skipped={todayResult.skipped}
            invalid={todayResult.invalid}
            note={todayResult.note}
          />
        )}
        {todayError && <p className="text-sm text-red-600">{todayError}</p>}
      </div>

      {/* Backfill */}
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <Button onClick={handleBackfill} disabled={anyPending}>
          {backfillPending
            ? "Backfilling..."
            : "Backfill Product Hunt (Historical)"}
        </Button>
        <p className="text-xs text-gray-400">
          Pages through the last {backfillResult?.windowLabel ?? "30d"}.
          Resumes from where it left off.
          {backfillResult
            ? ` Ran ${backfillResult.pagesRun} page(s).`
            : ""}
          {backfillResult?.backfillComplete
            ? " Backfill complete!"
            : ""}
        </p>
        {backfillResult && (
          <ResultMessage
            fetched={backfillResult.fetched}
            inserted={backfillResult.inserted}
            skipped={backfillResult.skipped}
            invalid={backfillResult.invalid}
          />
        )}
        {backfillError && (
          <p className="text-sm text-red-600">{backfillError}</p>
        )}
      </div>
    </div>
  );
}
