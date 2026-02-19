"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────
interface IngestionRow {
  source: string;
  mode: string;
  last_success_at: string | null;
  updated_at: string;
}

interface SourceCount {
  source: string;
  total: number;
}

interface SourceCount24h {
  source: string;
  rows_last_24h: number;
}

interface RedditDup {
  source_id: string | null;
  cnt: number;
}

interface StatusRow {
  status: string;
  cnt: number;
}

interface Flag {
  code: string;
  severity: "error" | "warn";
  message: string;
}

interface HealthReport {
  generated_at: string;
  owner_id: string;
  ingestion_state: IngestionRow[];
  raw_counts: SourceCount[];
  raw_counts_last_24h: SourceCount24h[];
  reddit_null_source_id_count: number;
  reddit_duplicates: RedditDup[];
  opportunities: {
    total: number;
    with_score: number;
    with_verdict: number;
    by_status: StatusRow[];
  };
  flags: Flag[];
}

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Page ──────────────────────────────────────────────────────
export default function HealthPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health/report");
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to load report");
      } else {
        setReport(json.report);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <h1 style={h1Style}>System Health</h1>
        <p style={subtextStyle}>Loading report...</p>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (error || !report) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <h1 style={h1Style}>System Health</h1>
        <div style={errorBoxStyle}>{error ?? "Unknown error"}</div>
        <button onClick={fetchReport} style={buttonStyle}>
          Retry
        </button>
      </div>
    );
  }

  const hasErrors = report.flags.some((f) => f.severity === "error");
  const hasWarnings = report.flags.some((f) => f.severity === "warn");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      {/* Header */}
      <div>
        <h1 style={h1Style}>System Health</h1>
        <p style={subtextStyle}>
          This tells you if Signals is honest and working.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            marginTop: "var(--space-3)",
          }}
        >
          <button onClick={fetchReport} style={buttonStyle}>
            Refresh Report
          </button>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)" }}>
            Generated {timeAgo(report.generated_at)}
          </span>
        </div>
      </div>

      {/* ── Flags (top if any) ──────────────────────────────── */}
      {report.flags.length > 0 && (
        <Section
          title="Warnings / Problems"
          description={
            hasErrors
              ? "Something needs your attention right now."
              : "A few things to keep an eye on."
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {report.flags.map((flag) => (
              <div
                key={flag.code}
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${flag.severity === "error" ? "var(--color-error-border)" : "var(--color-warning-border)"}`,
                  background:
                    flag.severity === "error"
                      ? "var(--color-error-bg)"
                      : "var(--color-warning-bg)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-primary)",
                }}
              >
                <strong>
                  {flag.severity === "error" ? "ERROR" : "WARNING"}:
                </strong>{" "}
                {flag.message}
                <span
                  style={{
                    display: "block",
                    marginTop: "var(--space-1)",
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  Code: {flag.code}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.flags.length === 0 && (
        <div
          style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-success-border)",
            background: "var(--color-success-bg)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-primary)",
          }}
        >
          All clear — no problems detected.
        </div>
      )}

      {/* ── 1. Are the robots running? ─────────────────────── */}
      <Section
        title="Are the robots running?"
        description="This shows when each data source last ran successfully."
      >
        {report.ingestion_state.length === 0 ? (
          <p style={emptyStyle}>No ingestion state found.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Mode</th>
                <th style={thStyle}>Last Success</th>
                <th style={thStyle}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {report.ingestion_state.map((row, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{row.source}</td>
                  <td style={tdStyle}>{row.mode}</td>
                  <td style={tdStyle}>{timeAgo(row.last_success_at)}</td>
                  <td style={tdStyle}>{timeAgo(row.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── 2. Did we collect anything in the last 24h? ────── */}
      <Section
        title="Did we collect anything in the last 24 hours?"
        description="How many new signals came in from each source recently."
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <div>
            <h4 style={subheadStyle}>Total (all time)</h4>
            {report.raw_counts.length === 0 ? (
              <p style={emptyStyle}>No signals yet.</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Source</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {report.raw_counts.map((row) => (
                    <tr key={row.source}>
                      <td style={tdStyle}>{row.source}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {row.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div>
            <h4 style={subheadStyle}>Last 24 hours</h4>
            {report.raw_counts_last_24h.length === 0 ? (
              <p style={emptyStyle}>Nothing in the last 24 hours.</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Source</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {report.raw_counts_last_24h.map((row) => (
                    <tr key={row.source}>
                      <td style={tdStyle}>{row.source}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {row.rows_last_24h.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Section>

      {/* ── 3. Are we duplicating things? ──────────────────── */}
      <Section
        title="Are we accidentally duplicating things?"
        description="Checks Reddit signals for missing IDs or duplicated entries."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={metricRowStyle}>
            <span>Reddit rows missing source_id:</span>
            <strong
              style={{
                color:
                  report.reddit_null_source_id_count > 0
                    ? "var(--color-error)"
                    : "var(--color-success)",
              }}
            >
              {report.reddit_null_source_id_count}
            </strong>
          </div>
          <div style={metricRowStyle}>
            <span>Duplicate source_id groups:</span>
            <strong
              style={{
                color:
                  report.reddit_duplicates.length > 0
                    ? "var(--color-error)"
                    : "var(--color-success)",
              }}
            >
              {report.reddit_duplicates.length}
            </strong>
          </div>
          {report.reddit_duplicates.length > 0 && (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>source_id</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {report.reddit_duplicates.slice(0, 10).map((dup, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{dup.source_id ?? "(null)"}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{dup.cnt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      {/* ── 4. Is the pipeline moving forward? ─────────────── */}
      <Section
        title="Is the pipeline moving forward?"
        description="Shows whether signals are turning into scored opportunities."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--space-4)",
            marginBottom: "var(--space-4)",
          }}
        >
          <MetricBox label="Opportunities" value={report.opportunities.total} />
          <MetricBox label="With Score" value={report.opportunities.with_score} />
          <MetricBox label="With Verdict" value={report.opportunities.with_verdict} />
        </div>
        {report.opportunities.by_status.length > 0 && (
          <>
            <h4 style={subheadStyle}>By Status</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
              {report.opportunities.by_status.map((row) => (
                <div
                  key={row.status}
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-bg-elevated)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <strong>{row.status}</strong>
                  <span style={{ marginLeft: "var(--space-2)", fontVariantNumeric: "tabular-nums" }}>
                    {row.cnt}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

// ── Reusable pieces ───────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "var(--space-5)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-elevated)",
      }}
    >
      <h2
        style={{
          fontSize: "var(--text-lg)",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          margin: 0,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-tertiary)",
          marginTop: "var(--space-1)",
          marginBottom: "var(--space-4)",
        }}
      >
        {description}
      </p>
      {children}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          fontVariantNumeric: "tabular-nums",
          marginTop: "var(--space-1)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────

const h1Style: React.CSSProperties = {
  fontSize: "var(--text-2xl)",
  fontWeight: 700,
  color: "var(--color-text-primary)",
  margin: 0,
};

const subtextStyle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-text-tertiary)",
  marginTop: "var(--space-1)",
};

const buttonStyle: React.CSSProperties = {
  padding: "var(--space-2) var(--space-4)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-elevated)",
  color: "var(--color-text-primary)",
  fontSize: "var(--text-sm)",
  fontWeight: 500,
  cursor: "pointer",
};

const errorBoxStyle: React.CSSProperties = {
  padding: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-error-bg)",
  color: "var(--color-error-text)",
  border: "1px solid var(--color-error-border)",
  fontSize: "var(--text-sm)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "var(--text-sm)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--space-2) var(--space-3)",
  fontWeight: 600,
  color: "var(--color-text-tertiary)",
  fontSize: "var(--text-xs)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "1px solid var(--color-border)",
};

const tdStyle: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  color: "var(--color-text-primary)",
  borderBottom: "1px solid var(--color-border-subtle)",
};

const emptyStyle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-text-tertiary)",
  margin: 0,
};

const subheadStyle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-text-secondary)",
  margin: "0 0 var(--space-2) 0",
};

const metricRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "var(--text-sm)",
  color: "var(--color-text-primary)",
};
