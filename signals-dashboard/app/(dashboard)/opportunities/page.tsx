import { requireUser } from "@/lib/auth/requireUser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OpportunitiesTable } from "./OpportunitiesTable";
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <div>
        <h1
          style={{
            fontSize: "var(--text-2xl)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          Opportunities
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-tertiary)",
            marginTop: "var(--space-1)",
          }}
        >
          All opportunities ranked by score
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "var(--space-3)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-error-bg)",
            color: "var(--color-error-text)",
            border: "1px solid var(--color-error-border)",
            fontSize: "var(--text-sm)",
          }}
        >
          {error.message}
        </div>
      )}

      <Card title="All Opportunities" padding={false}>
        <OpportunitiesTable data={(rows as PipelineRow[]) ?? []} />
      </Card>

      <Card title="Create Opportunity">
        <form action={createOpportunity} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input id="title" name="title" label="Title" required placeholder="Opportunity title" />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <label
              htmlFor="cluster_id"
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                color: "var(--color-text-secondary)",
              }}
            >
              Cluster
            </label>
            <select
              id="cluster_id"
              name="cluster_id"
              style={{
                padding: "var(--space-2) var(--space-3)",
                fontSize: "var(--text-base)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-elevated)",
                color: "var(--color-text-primary)",
              }}
            >
              <option value="">{"\u2014"} Select cluster {"\u2014"}</option>
              {(clusters ?? []).map((c: { cluster_id: string; cluster: unknown }) => (
                <option key={c.cluster_id} value={c.cluster_id}>
                  {c.cluster_id}
                  {typeof c.cluster === "object" && c.cluster !== null && "title" in (c.cluster as Record<string, unknown>)
                    ? ` \u2014 ${(c.cluster as Record<string, string>).title}`
                    : ""}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="status" value="new" />
          <Button type="submit">Create Opportunity</Button>
        </form>
      </Card>
    </div>
  );
}
