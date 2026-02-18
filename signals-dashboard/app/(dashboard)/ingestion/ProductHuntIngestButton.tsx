"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  runProductHuntLive,
  runProductHuntTodaysWinners,
  runProductHuntBackfill,
} from "./actions";

// ── Shared result display ──────────────────────────────────

function Counts({
  fetched,
  inserted,
  duplicates,
  invalid,
}: {
  fetched: number;
  inserted: number;
  duplicates: number;
  invalid: number;
}) {
  if (fetched === 0) {
    return (
      <p className="text-sm text-amber-600">No posts found in this window.</p>
    );
  }
  return (
    <p className="text-sm text-gray-700">
      Fetched: <span className="font-semibold">{fetched}</span>
      {" · "}Inserted: <span className="font-semibold">{inserted}</span>
      {" · "}Duplicates: <span className="font-semibold">{duplicates}</span>
      {invalid > 0 && (
        <>
          {" · "}
          <span className="text-red-600">
            Invalid: <span className="font-semibold">{invalid}</span>
          </span>
        </>
      )}
    </p>
  );
}

function CursorInfo({
  before,
  after,
}: {
  before: string | null;
  after: string | null;
}) {
  const changed = before !== after;
  return (
    <div className="text-xs font-mono text-gray-400 space-y-0.5">
      <p>
        Cursor before:{" "}
        <span className="text-gray-600">{before ?? "(none)"}</span>
      </p>
      <p>
        Cursor after:{" "}
        <span className={changed ? "text-green-600" : "text-amber-600"}>
          {after ?? "(none)"}
        </span>
        {!changed && before !== null && (
          <span className="ml-1 text-amber-600">(unchanged)</span>
        )}
      </p>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────

interface LiveResult {
  fetched: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  cursorBefore: string | null;
  cursorAfter: string | null;
  lastSuccessAt: string | null;
  postedAfter: string;
  hasNextPage: boolean;
}

interface TodayResult {
  fetched: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  note?: string;
}

interface BackfillResult {
  fetched: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  cursorBefore: string | null;
  cursorAfter: string | null;
  pagesRun: number;
  backfillComplete: boolean;
}

// ── Component ──────────────────────────────────────────────

export function ProductHuntIngestButton() {
  const router = useRouter();

  const [livePending, startLiveTransition] = useTransition();
  const [todayPending, startTodayTransition] = useTransition();
  const [backfillPending, startBackfillTransition] = useTransition();
  const anyPending = livePending || todayPending || backfillPending;

  const [liveResult, setLiveResult] = useState<LiveResult | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const [todayResult, setTodayResult] = useState<TodayResult | null>(null);
  const [todayError, setTodayError] = useState<string | null>(null);

  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(
    null,
  );
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
      {/* ── Live ── */}
      <div className="space-y-2">
        <Button onClick={handleLive} disabled={anyPending}>
          {livePending ? "Ingesting..." : "Ingest Product Hunt (Live)"}
        </Button>
        <p className="text-xs text-gray-400">
          Pulls newest posts since last run (or last 24h on first run).
          Advances cursor each run.
        </p>
        {liveResult && (
          <div className="space-y-1 rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              Window starts at:{" "}
              <span className="font-mono text-gray-700">
                {liveResult.postedAfter}
              </span>
            </p>
            {liveResult.lastSuccessAt && (
              <p className="text-xs text-gray-500">
                Last success:{" "}
                <span className="font-mono text-gray-700">
                  {liveResult.lastSuccessAt}
                </span>
              </p>
            )}
            <Counts
              fetched={liveResult.fetched}
              inserted={liveResult.inserted}
              duplicates={liveResult.duplicates}
              invalid={liveResult.invalid}
            />
            <CursorInfo
              before={liveResult.cursorBefore}
              after={liveResult.cursorAfter}
            />
            {liveResult.hasNextPage && (
              <p className="text-xs text-amber-600">
                More pages available — run again to continue.
              </p>
            )}
          </div>
        )}
        {liveError && <p className="text-sm text-red-600">{liveError}</p>}
      </div>

      {/* ── Today ── */}
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <Button onClick={handleToday} disabled={anyPending}>
          {todayPending ? "Ingesting..." : "Ingest Product Hunt (Today)"}
        </Button>
        <p className="text-xs text-gray-400">
          Pulls today&apos;s posts since midnight UTC.
        </p>
        {todayResult && (
          <div className="space-y-1 rounded border border-gray-100 bg-gray-50 p-3">
            <Counts
              fetched={todayResult.fetched}
              inserted={todayResult.inserted}
              duplicates={todayResult.duplicates}
              invalid={todayResult.invalid}
            />
            {todayResult.note && (
              <p className="text-xs text-gray-400 italic">
                {todayResult.note}
              </p>
            )}
          </div>
        )}
        {todayError && <p className="text-sm text-red-600">{todayError}</p>}
      </div>

      {/* ── Backfill ── */}
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <Button onClick={handleBackfill} disabled={anyPending}>
          {backfillPending
            ? "Backfilling..."
            : "Backfill Product Hunt (Slow)"}
        </Button>
        <p className="text-xs text-gray-400">
          Pages through the last 30d. Resumes from where it left off.
        </p>
        {backfillResult && (
          <div className="space-y-1 rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              Pages run: {backfillResult.pagesRun}
              {backfillResult.backfillComplete && (
                <span className="ml-2 text-green-600 font-medium">
                  Backfill complete
                </span>
              )}
            </p>
            <Counts
              fetched={backfillResult.fetched}
              inserted={backfillResult.inserted}
              duplicates={backfillResult.duplicates}
              invalid={backfillResult.invalid}
            />
            <CursorInfo
              before={backfillResult.cursorBefore}
              after={backfillResult.cursorAfter}
            />
          </div>
        )}
        {backfillError && (
          <p className="text-sm text-red-600">{backfillError}</p>
        )}
      </div>
    </div>
  );
}
