"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { runRedditIngestion } from "./actions";

export function RedditIngestButton() {
  const [result, setResult] = useState<{
    inserted: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await runRedditIngestion();
      if (!res.ok) {
        setError(res.error);
      } else {
        setResult({ inserted: res.inserted, skipped: res.skipped });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleClick} disabled={isPending}>
        {isPending ? "Ingesting..." : "Ingest Reddit Now"}
      </Button>

      {result && (
        <p className="text-sm text-gray-700">
          Inserted: <span className="font-semibold">{result.inserted}</span>,
          Skipped: <span className="font-semibold">{result.skipped}</span>
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
