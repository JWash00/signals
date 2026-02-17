import { requireUser } from "@/lib/auth/requireUser";
import { Table } from "@/components/ui/Table";

interface PipelineRow {
  title: string;
  status: string;
  score_total: number | null;
  verdict: string | null;
  confidence: number | null;
  competitor_count: number | null;
  score_created_at: string | null;
}

export default async function DashboardPage() {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("pipeline_v1")
    .select("*")
    .order("score_total", { ascending: false, nullsFirst: false })
    .order("opportunity_created_at", { ascending: false })
    .limit(25);

  const rows: PipelineRow[] = data ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Pipeline Dashboard</h1>
      {error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">
          {error.message}
        </p>
      )}
      <Table<PipelineRow>
        columns={[
          { header: "Title", accessor: "title" },
          { header: "Status", accessor: "status" },
          {
            header: "Score",
            accessor: (r) =>
              r.score_total != null ? r.score_total.toFixed(1) : "—",
          },
          { header: "Verdict", accessor: (r) => r.verdict ?? "—" },
          {
            header: "Confidence",
            accessor: (r) =>
              r.confidence != null
                ? `${(r.confidence * 100).toFixed(0)}%`
                : "—",
          },
          {
            header: "Competitors",
            accessor: (r) => r.competitor_count ?? 0,
          },
          {
            header: "Scored At",
            accessor: (r) =>
              r.score_created_at
                ? new Date(r.score_created_at).toLocaleDateString()
                : "—",
          },
        ]}
        data={rows}
        emptyMessage="No pipeline data yet"
      />
    </div>
  );
}
