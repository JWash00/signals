import { requireUser } from "@/lib/auth/requireUser";
import { Table } from "@/components/ui/Table";

interface ClusterRow {
  pain_cluster_id: string;
  signal_count: number | null;
  opportunity_count: number | null;
  last_signal_at: string | null;
}

export default async function ClustersPage() {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("cluster_pipeline_v1")
    .select("*")
    .order("signal_count", { ascending: false })
    .order("last_signal_at", { ascending: false });

  const rows: ClusterRow[] = data ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Clusters</h1>
      {error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">
          {error.message}
        </p>
      )}
      <Table<ClusterRow>
        columns={[
          { header: "Cluster ID", accessor: "pain_cluster_id" },
          {
            header: "Signals",
            accessor: (r) => r.signal_count ?? 0,
          },
          {
            header: "Opportunities",
            accessor: (r) => r.opportunity_count ?? 0,
          },
          {
            header: "Last Signal",
            accessor: (r) =>
              r.last_signal_at
                ? new Date(r.last_signal_at).toLocaleDateString()
                : "—",
          },
        ]}
        data={rows}
        emptyMessage="No clusters found"
      />
    </div>
  );
}
