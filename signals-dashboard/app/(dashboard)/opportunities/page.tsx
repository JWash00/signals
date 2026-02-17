import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createOpportunity } from "./actions";

interface PipelineRow {
  opportunity_id: string;
  title: string;
  status: string;
  score_total: number | null;
  verdict: string | null;
}

export default async function OpportunitiesPage() {
  const { supabase } = await requireUser();

  const { data: rows, error } = await supabase
    .from("pipeline_v1")
    .select("*")
    .order("score_total", { ascending: false, nullsFirst: false });

  const { data: clusters } = await supabase
    .from("pmf_clusters")
    .select("cluster_id, cluster");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Opportunities</h1>

      {error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">
          {error.message}
        </p>
      )}

      <Table<PipelineRow>
        columns={[
          {
            header: "Title",
            accessor: (r) => (
              <Link
                href={`/opportunities/${r.opportunity_id}`}
                className="text-blue-600 hover:underline"
              >
                {r.title}
              </Link>
            ),
          },
          { header: "Status", accessor: "status" },
          {
            header: "Score",
            accessor: (r) =>
              r.score_total != null ? r.score_total.toFixed(1) : "—",
          },
          { header: "Verdict", accessor: (r) => r.verdict ?? "—" },
        ]}
        data={(rows as PipelineRow[]) ?? []}
        emptyMessage="No opportunities yet"
      />

      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Create Opportunity
        </h2>
        <form action={createOpportunity} className="flex flex-col gap-4">
          <Input id="title" name="title" label="Title" required placeholder="Opportunity title" />
          <div className="flex flex-col gap-1">
            <label htmlFor="cluster_id" className="text-sm font-medium text-gray-700">
              Cluster
            </label>
            <select
              id="cluster_id"
              name="cluster_id"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Select cluster —</option>
              {(clusters ?? []).map((c: { cluster_id: string; cluster: unknown }) => (
                <option key={c.cluster_id} value={c.cluster_id}>
                  {c.cluster_id}
                  {typeof c.cluster === "object" && c.cluster !== null && "title" in (c.cluster as Record<string, unknown>)
                    ? ` — ${(c.cluster as Record<string, string>).title}`
                    : ""}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="status" value="new" />
          <Button type="submit">Create Opportunity</Button>
        </form>
      </div>
    </div>
  );
}
