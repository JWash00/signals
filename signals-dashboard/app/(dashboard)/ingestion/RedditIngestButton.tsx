"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { runRedditIngestion } from "./actions";

interface SubredditResult {
  subreddit: string;
  fetched: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  cursorBefore: string | null;
  cursorAfter: string | null;
}

export function RedditIngestButton() {
  const [results, setResults] = useState<SubredditResult[] | null>(null);
  const [totals, setTotals] = useState<{
    inserted: number;
    duplicates: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    setError(null);
    setResults(null);
    setTotals(null);
    startTransition(async () => {
      const res = await runRedditIngestion();
      if (!res.ok) {
        setError(res.error);
      } else {
        setResults(res.results);
        setTotals({ inserted: res.inserted, duplicates: res.duplicates });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleClick} disabled={isPending}>
        {isPending ? "Ingesting..." : "Ingest Reddit Now"}
      </Button>

      {results && totals && (
        <div className="space-y-3">
          {results.map((r) => {
            const cursorChanged = r.cursorBefore !== r.cursorAfter;
            return (
              <div
                key={r.subreddit}
                className="rounded border border-gray-100 bg-gray-50 p-3 space-y-1"
              >
                <p className="text-sm font-medium text-gray-800">
                  r/{r.subreddit}
                </p>
                <p className="text-sm text-gray-700">
                  Fetched: <span className="font-semibold">{r.fetched}</span>
                  {" · "}Inserted:{" "}
                  <span className="font-semibold">{r.inserted}</span>
                  {" · "}Duplicates:{" "}
                  <span className="font-semibold">{r.duplicates}</span>
                  {r.invalid > 0 && (
                    <>
                      {" · "}
                      <span className="text-red-600">
                        Invalid:{" "}
                        <span className="font-semibold">{r.invalid}</span>
                      </span>
                    </>
                  )}
                </p>
                <div className="text-xs font-mono text-gray-400 space-y-0.5">
                  <p>
                    Cursor before:{" "}
                    <span className="text-gray-600">
                      {r.cursorBefore ?? "(none)"}
                    </span>
                  </p>
                  <p>
                    Cursor after:{" "}
                    <span
                      className={
                        cursorChanged ? "text-green-600" : "text-amber-600"
                      }
                    >
                      {r.cursorAfter ?? "(none)"}
                    </span>
                    {!cursorChanged && r.cursorBefore !== null && (
                      <span className="ml-1 text-amber-600">(unchanged)</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
          <p className="text-sm font-medium text-gray-800 pt-1">
            Total — Inserted:{" "}
            <span className="font-semibold">{totals.inserted}</span>,
            Duplicates:{" "}
            <span className="font-semibold">{totals.duplicates}</span>
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
