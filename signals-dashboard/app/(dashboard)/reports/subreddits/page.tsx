"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface SubredditRow {
  subreddit: string;
  big_ideas: number;
  sample_big_idea_ids: string[];
  sample_big_idea_titles: string[];
}

interface Report {
  generated_at: string;
  rows: SubredditRow[];
}

export default function SubredditReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/subreddits");
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to load report");
      } else {
        setReport({ generated_at: json.generated_at, rows: json.rows });
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

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={h1Style}>Which subreddits create Big Ideas?</h1>
        <p style={subtextStyle}>Loading report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={h1Style}>Which subreddits create Big Ideas?</h1>
        <div style={errorBoxStyle}>{error ?? "Unknown error"}</div>
        <button onClick={fetchReport} style={buttonStyle}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={h1Style}>Which subreddits create Big Ideas?</h1>
        <p style={subtextStyle}>
          This shows where your best Big Ideas come from.
          Only Reddit sources are counted.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <button onClick={fetchReport} style={buttonStyle}>
            Refresh
          </button>
          <span style={{ fontSize: 12, color: "#999" }}>
            Generated {new Date(report.generated_at).toLocaleString()}
          </span>
        </div>
      </div>

      {report.rows.length === 0 ? (
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            border: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-elevated)",
            fontSize: 14,
            color: "var(--color-text-tertiary)",
          }}
        >
          No subreddit data yet. Big Ideas need approved Reddit New Finds to show up here.
        </div>
      ) : (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            overflow: "hidden",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 1fr",
              padding: "10px 16px",
              background: "var(--color-bg-elevated)",
              borderBottom: "1px solid var(--color-border)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--color-text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <span>Subreddit</span>
            <span style={{ textAlign: "center" }}>Big Ideas</span>
            <span>Examples</span>
          </div>

          {/* Table rows */}
          {report.rows.map((row) => (
            <div
              key={row.subreddit}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 1fr",
                padding: "12px 16px",
                borderBottom: "1px solid var(--color-border-subtle)",
                fontSize: 14,
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                r/{row.subreddit}
              </span>
              <span
                style={{
                  textAlign: "center",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--color-text-primary)",
                }}
              >
                {row.big_ideas}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {row.sample_big_idea_titles.map((title, i) => (
                  <Link
                    key={row.sample_big_idea_ids[i]}
                    href={`/opportunities/${row.sample_big_idea_ids[i]}`}
                    style={{
                      fontSize: 12,
                      color: "var(--color-accent)",
                      textDecoration: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────

const h1Style: React.CSSProperties = {
  fontSize: "var(--text-2xl)",
  fontWeight: 700,
  color: "var(--color-text-primary)",
  margin: 0,
};

const subtextStyle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-text-tertiary)",
  marginTop: 4,
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-elevated)",
  color: "var(--color-text-primary)",
  fontSize: "var(--text-sm)",
  fontWeight: 500,
  cursor: "pointer",
};

const errorBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: "var(--radius-md)",
  background: "var(--color-error-bg)",
  color: "var(--color-error-text)",
  border: "1px solid var(--color-error-border)",
  fontSize: "var(--text-sm)",
};
