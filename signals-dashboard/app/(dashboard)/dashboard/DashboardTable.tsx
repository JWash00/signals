"use client";

import Link from "next/link";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

interface PipelineRow {
  opportunity_id: string;
  title: string;
  status: string;
  score_total: number | null;
  verdict: string | null;
  confidence: number | null;
}

function verdictVariant(v: string | null) {
  switch (v) {
    case "BUILD":
      return "success" as const;
    case "INVEST":
      return "info" as const;
    case "MONITOR":
      return "warning" as const;
    case "PASS":
      return "default" as const;
    default:
      return "default" as const;
  }
}

export function DashboardTable({ data }: { data: PipelineRow[] }) {
  return (
    <Table<PipelineRow>
      data={data}
      searchable
      searchPlaceholder="Search opportunities..."
      searchAccessor={(r) =>
        `${r.title ?? ""} ${r.status ?? ""} ${r.verdict ?? ""}`
      }
      columns={[
        {
          header: "Title",
          sortable: true,
          sortKey: (r) => r.title ?? "",
          accessor: (r) => (
            <Link
              href={`/opportunities/${r.opportunity_id}`}
              style={{
                color: "var(--color-accent)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              {r.title ?? ""}
            </Link>
          ),
        },
        {
          header: "Score",
          sortable: true,
          sortKey: (r) => r.score_total ?? 0,
          accessor: (r) => (
            <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {r.score_total != null ? r.score_total.toFixed(1) : "\u2014"}
            </span>
          ),
        },
        {
          header: "Verdict",
          sortable: true,
          sortKey: (r) => r.verdict ?? "",
          accessor: (r) =>
            r.verdict ? (
              <Badge variant={verdictVariant(r.verdict)}>{r.verdict}</Badge>
            ) : (
              <span style={{ color: "var(--color-text-tertiary)" }}>{"\u2014"}</span>
            ),
        },
        {
          header: "Confidence",
          sortable: true,
          sortKey: (r) => r.confidence ?? 0,
          accessor: (r) =>
            r.confidence != null ? (
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {(r.confidence * 100).toFixed(0)}%
              </span>
            ) : (
              <span style={{ color: "var(--color-text-tertiary)" }}>{"\u2014"}</span>
            ),
        },
        {
          header: "Status",
          sortable: true,
          sortKey: (r) => r.status ?? "",
          accessor: (r) =>
            r.status ? (
              <Badge variant="default">{r.status}</Badge>
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
  );
}
