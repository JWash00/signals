import { requireUser } from "@/lib/auth/requireUser";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { ScoreCard } from "@/components/pmf/ScoreCard";
import type { Verdict } from "@/lib/pmf/types";

export default async function DashboardPage() {
  const { supabase } = await requireUser();

  const { data: rows, error } = await supabase
    .from("pipeline_v1")
    .select("*")
    .order("score_total", { ascending: false })
    .limit(25);

  if (error) {
    return (
      <div className="rounded bg-red-50 p-4 text-red-600">{error.message}</div>
    );
  }

  const top = rows?.[0];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-gray-900">Pipeline Overview</h1>

      {top && top.score_total != null && (
        <ScoreCard
          score={top.score_total as number}
          verdict={top.verdict as Verdict}
          confidence={(top.confidence as number) ?? 0}
        />
      )}

      <Card title="Top 25 Opportunities">
        {rows && rows.length > 0 ? (
          <Table
            data={rows}
            columns={[
              { header: "Title", accessor: (r) => String(r.title ?? "") },
              { header: "Score", accessor: (r) => String(r.score_total ?? "") },
              { header: "Verdict", accessor: (r) => String(r.verdict ?? "") },
              { header: "Confidence", accessor: (r) => String(r.confidence ?? "") },
              { header: "Status", accessor: (r) => String(r.status ?? "") },
            ]}
          />
        ) : (
          <p className="text-sm text-gray-500">
            No scored opportunities yet. Create an opportunity and run an analysis.
          </p>
        )}
      </Card>
    </div>
  );
}
