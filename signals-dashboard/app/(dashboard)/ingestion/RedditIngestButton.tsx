"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { runRedditIngestion } from "./actions";

interface SubredditResult {
  subreddit: string;
  inserted: number;
  skipped: number;
}

export function RedditIngestButton() {
  const [results, setResults] = useState<SubredditResult[] | null>(null);
  const [totals, setTotals] = useState<{
    inserted: number;
    skipped: number;
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
        setTotals({ inserted: res.inserted, skipped: res.skipped });
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
        <div className="space-y-1 text-sm text-gray-700">
          {results.map((r) => (
            <p key={r.subreddit}>
              r/{r.subreddit} — Inserted:{" "}
              <span className="font-semibold">{r.inserted}</span>, Skipped:{" "}
              <span className="font-semibold">{r.skipped}</span>
            </p>
          ))}
          <p className="pt-1 font-medium">
            Total — Inserted:{" "}
            <span className="font-semibold">{totals.inserted}</span>, Skipped:{" "}
            <span className="font-semibold">{totals.skipped}</span>
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
