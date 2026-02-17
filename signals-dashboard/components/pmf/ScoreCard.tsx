import type { Verdict } from "@/lib/pmf/types";

const verdictColors: Record<Verdict, string> = {
  BUILD: "bg-green-100 text-green-800 border-green-300",
  INVEST: "bg-blue-100 text-blue-800 border-blue-300",
  MONITOR: "bg-yellow-100 text-yellow-800 border-yellow-300",
  PASS: "bg-gray-100 text-gray-800 border-gray-300",
};

interface ScoreCardProps {
  score: number;
  verdict: Verdict;
  confidence: number;
}

export function ScoreCard({ score, verdict, confidence }: ScoreCardProps) {
  return (
    <div className="flex items-center gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="text-center">
        <div className="text-3xl font-bold text-gray-900">
          {score.toFixed(1)}
        </div>
        <div className="text-xs text-gray-500 uppercase">Score</div>
      </div>
      <div
        className={`rounded-md border px-4 py-2 text-sm font-semibold ${verdictColors[verdict] ?? verdictColors.PASS}`}
      >
        {verdict}
      </div>
      <div className="text-center">
        <div className="text-lg font-medium text-gray-700">
          {(confidence * 100).toFixed(0)}%
        </div>
        <div className="text-xs text-gray-500 uppercase">Confidence</div>
      </div>
    </div>
  );
}
