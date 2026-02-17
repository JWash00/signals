import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { ScoreCard } from "@/components/pmf/ScoreCard";
import type { Verdict } from "@/lib/pmf/types";

function verdictVariant(v: string | null) {
  switch (v) {
    case "BUILD": return "success" as const;
    case "INVEST": return "info" as const;
    case "MONITOR": return "warning" as const;
    case "PASS": return "default" as const;
    default: return "default" as const;
  }
}

export default async function DashboardPage() {
  const { supabase } = await requireUser();

  const { data: rows, error } = await supabase
    .from("pipeline_v1")
    .select("*")
    .order("score_total", { ascending: false })
    .limit(25);

  if (error) {
    return (
      <div
        style={{
          padding: "var(--space-4)",
          borderRadius: "var(--radius-md)",
          background: "var(--color-error-bg)",
          color: "var(--color-error-text)",
          border: "1px solid var(--color-error-border)",
          fontSize: "var(--text-sm)",
        }}
      >
        {error.message}
      </div>
    );
  }

  const top = rows?.[0];
  const totalCount = rows?.length ?? 0;
  const scoredCount = rows?.filter((r) => r.score_total != null).length ?? 0;
  const buildCount = rows?.filter((r) => r.verdict === "BUILD").length ?? 0;

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
          Pipeline Overview
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-tertiary)",
            marginTop: "var(--space-1)",
          }}
        >
          Top opportunities ranked by PMF score
        </p>
      </div>

      {/* KPI Cards */}
      <div
        className="stagger"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}
      >
        <KPICard label="Total Opportunities" value={totalCount} />
        <KPICard label="Scored" value={scoredCount} />
        <KPICard label="BUILD Verdict" value={buildCount} accent />
      </div>

      {/* Top ScoreCard */}
      {top && top.score_total != null && (
        <ScoreCard
          score={top.score_total as number}
          verdict={top.verdict as Verdict}
          confidence={(top.confidence as number) ?? 0}
        />
      )}

      {/* Table */}
      <Card title="Top 25 Opportunities" padding={false}>
        <Table
          data={rows ?? []}
          searchable
          searchPlaceholder="Search opportunities..."
          searchAccessor={(r) =>
            `${String(r.title ?? "")} ${String(r.status ?? "")} ${String(r.verdict ?? "")}`
          }
          columns={[
            {
              header: "Title",
              sortable: true,
              sortKey: (r) => String(r.title ?? ""),
              accessor: (r) => (
                <Link
                  href={`/opportunities/${r.opportunity_id}`}
                  style={{
                    color: "var(--color-accent)",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  {String(r.title ?? "")}
                </Link>
              ),
            },
            {
              header: "Score",
              sortable: true,
              sortKey: (r) => (r.score_total as number) ?? 0,
              accessor: (r) => (
                <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {r.score_total != null ? Number(r.score_total).toFixed(1) : "\u2014"}
                </span>
              ),
            },
            {
              header: "Verdict",
              sortable: true,
              sortKey: (r) => String(r.verdict ?? ""),
              accessor: (r) =>
                r.verdict ? (
                  <Badge variant={verdictVariant(r.verdict as string)}>
                    {String(r.verdict)}
                  </Badge>
                ) : (
                  <span style={{ color: "var(--color-text-tertiary)" }}>{"\u2014"}</span>
                ),
            },
            {
              header: "Confidence",
              sortable: true,
              sortKey: (r) => (r.confidence as number) ?? 0,
              accessor: (r) =>
                r.confidence != null ? (
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {(Number(r.confidence) * 100).toFixed(0)}%
                  </span>
                ) : (
                  <span style={{ color: "var(--color-text-tertiary)" }}>{"\u2014"}</span>
                ),
            },
            {
              header: "Status",
              sortable: true,
              sortKey: (r) => String(r.status ?? ""),
              accessor: (r) =>
                r.status ? (
                  <Badge variant="default">{String(r.status)}</Badge>
                ) : (
                  <span style={{ color: "var(--color-text-tertiary)" }}>{"\u2014"}</span>
                ),
            },
          ]}
          emptyMessage="No scored opportunities yet"
          emptyAction={
            <Link
              href="/opportunities"
              style={{
                color: "var(--color-accent)",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
              }}
            >
              Create an opportunity to get started
            </Link>
          }
        />
      </Card>
    </div>
  );
}

function KPICard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: "var(--space-5)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-elevated)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "var(--space-2)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "var(--text-3xl)",
          fontWeight: 700,
          color: accent ? "var(--color-accent)" : "var(--color-text-primary)",
          lineHeight: "var(--leading-tight)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
