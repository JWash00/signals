import { requireUser } from "@/lib/auth/requireUser";
import { Card } from "@/components/ui/Card";
import { OpportunitiesTable } from "./OpportunitiesTable";

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
          Big Ideas
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-tertiary)",
            marginTop: "var(--space-1)",
          }}
        >
          All Big Ideas ranked by score. Created automatically from Pain Groups.
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

      <Card title="All Big Ideas" padding={false}>
        <OpportunitiesTable data={(rows as PipelineRow[]) ?? []} />
      </Card>
    </div>
  );
}
