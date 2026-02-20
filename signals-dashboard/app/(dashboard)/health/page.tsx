"use client";

import { useEffect, useState, useCallback } from "react";
import { PASS_RULES } from "@/lib/filters/passRules";
import { labelForSource } from "@/lib/ui/sourceLabels";

// ── Types matching the v2 RPC response ───────────────────────

interface IngestionRow {
  source: string;
  mode: string;
  last_success_at: string | null;
  updated_at: string;
}

interface SourceCount {
  source: string;
  count: number;
}

interface RedditDup {
  source_id: string | null;
  count: number;
}

interface Flag {
  level: "bad" | "ok";
  code: string;
  message: string;
}

interface MissingEnvItem {
  label: string;
  requiredFor: string;
}

interface HealthReport {
  generated_at: string;
  owner_id: string;
  robots_running: {
    ingestion_state: IngestionRow[];
  };
  collected: {
    new_finds_total_by_source: SourceCount[];
    new_finds_last_24h_by_source: SourceCount[];
  };
  honesty_checks: {
    reddit_missing_id_count: number;
    reddit_duplicates: RedditDup[];
  };
  decide_counts: {
    new: number;
    approved: number;
    rejected: number;
  };
  pain_groups: {
    total: number;
  };
  big_ideas: {
    total: number;
    scored: number;
    decided: number;
    avg_score: number | null;
  };
  flags: Flag[];
}

// ── Helpers ──────────────────────────────────────────────────

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

// ── Page ─────────────────────────────────────────────────────

export default function HealthPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [missingEnv, setMissingEnv] = useState<MissingEnvItem[]>([]);
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
        setMissingEnv(json.missing_env ?? []);
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

  // ── Loading ─────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <h1 style={h1Style}>System Health</h1>
        <p style={subtextStyle}>Loading report...</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────
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

  const badFlags = report.flags.filter((f) => f.level === "bad");
  const okFlags = report.flags.filter((f) => f.level === "ok");
  const ingestion = report.robots_running.ingestion_state;
  const total24h = report.collected.new_finds_last_24h_by_source;
  const totalAll = report.collected.new_finds_total_by_source;
  const honesty = report.honesty_checks;
  const decide = report.decide_counts;
  const bigIdeas = report.big_ideas;
  const painGroups = report.pain_groups;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      {/* Header */}
      <div>
        <h1 style={h1Style}>System Health</h1>
        <p style={subtextStyle}>
          This tells you if Signals is being honest and working.
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

      {/* ── Top banner ───────────────────────────────────────── */}
      {missingEnv.length > 0 ? (
        <div
          style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-error-border)",
            background: "var(--color-error-bg)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-primary)",
          }}
        >
          Setup is missing things. Some robots cannot run.
        </div>
      ) : report.flags.length > 0 ? (
        <div
          style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-warning-border)",
            background: "var(--color-warning-bg)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-primary)",
          }}
        >
          The system noticed some things worth checking.
        </div>
      ) : (
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

      {/* ── 0) Is setup complete? ──────────────────────────────── */}
      <Section
        title="Is setup complete?"
        description="If something is missing here, a robot cannot run."
      >
        {missingEnv.length === 0 ? (
          <p style={{ ...emptyStyle, color: "var(--color-success)" }}>
            Setup looks complete.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {missingEnv.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-error-border)",
                  background: "var(--color-error-bg)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-primary)",
                }}
              >
                <strong>Missing:</strong> {item.label} — Needed for: {item.requiredFor}
              </div>
            ))}
            {missingEnv.some((e) => e.requiredFor === "Indie Hackers") && (
              <div
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-warning-border)",
                  background: "var(--color-warning-bg)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-primary)",
                }}
              >
                Indie Hackers is OFF (missing Apify settings).
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── 5) Problems ──────────────────────────────────────── */}
      {report.flags.length > 0 && (
        <Section
          title="Any problems?"
          description="Things the system noticed."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {badFlags.map((flag) => (
              <FlagRow key={flag.code} level="bad" message={flag.message} />
            ))}
            {okFlags.map((flag) => (
              <FlagRow key={flag.code} level="ok" message={flag.message} />
            ))}
          </div>
        </Section>
      )}

      {/* ── 1) Are the robots running? ───────────────────────── */}
      <Section
        title="Are the robots running?"
        description="This shows when each data source last ran."
      >
        {ingestion.length === 0 ? (
          <p style={emptyStyle}>No data sources set up yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {ingestion.map((row, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border-subtle)",
                  fontSize: "var(--text-sm)",
                }}
              >
                <div>
                  <strong style={{ color: "var(--color-text-primary)" }}>
                    {labelForSource(row.source)}
                  </strong>
                  <span style={{ color: "var(--color-text-tertiary)", marginLeft: "var(--space-2)" }}>
                    ({row.mode})
                  </span>
                </div>
                <span style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-xs)" }}>
                  updated {timeAgo(row.updated_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── 2) Did we collect anything? ──────────────────────── */}
      <Section
        title="Did we collect anything in the last 24 hours?"
        description="How many New Finds came in from each source."
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <div>
            <h4 style={subheadStyle}>All time</h4>
            {totalAll.length === 0 ? (
              <p style={emptyStyle}>No New Finds yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                {totalAll.map((row) => (
                  <CountRow key={row.source} label={labelForSource(row.source)} count={row.count} />
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 style={subheadStyle}>Last 24 hours</h4>
            {total24h.length === 0 ? (
              <p style={emptyStyle}>Nothing new today (that can be okay).</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                {total24h.map((row) => (
                  <CountRow key={row.source} label={labelForSource(row.source)} count={row.count} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── 3) Are we repeating ourselves? ───────────────────── */}
      <Section
        title="Are we repeating ourselves by accident?"
        description="Checks if Reddit New Finds are missing IDs or showing up twice."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={metricRowStyle}>
            <span>Reddit New Finds missing an ID:</span>
            <strong
              style={{
                color:
                  honesty.reddit_missing_id_count > 0
                    ? "var(--color-error)"
                    : "var(--color-success)",
              }}
            >
              {honesty.reddit_missing_id_count}
            </strong>
          </div>
          <div style={metricRowStyle}>
            <span>Reddit duplicates found:</span>
            <strong
              style={{
                color:
                  honesty.reddit_duplicates.length > 0
                    ? "var(--color-error)"
                    : "var(--color-success)",
              }}
            >
              {honesty.reddit_duplicates.length}
            </strong>
          </div>
          {honesty.reddit_duplicates.length > 0 && (
            <div
              style={{
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-error-bg)",
                border: "1px solid var(--color-error-border)",
                fontSize: "var(--text-sm)",
              }}
            >
              <strong>Heads up:</strong> Some Reddit New Finds appeared more than once.
              This means the system may be counting the same thing twice.
            </div>
          )}
        </div>
      </Section>

      {/* ── 4) Is the system turning New Finds into Big Ideas? ── */}
      <Section
        title="Is the system making Big Ideas?"
        description="Shows whether New Finds are turning into scored Big Ideas."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--space-4)",
            marginBottom: "var(--space-4)",
          }}
        >
          <MetricBox label="Big Ideas" value={bigIdeas.total} />
          <MetricBox label="Scored" value={bigIdeas.scored} />
          <MetricBox label="Decided" value={bigIdeas.decided} />
        </div>
        {bigIdeas.avg_score != null && (
          <div style={{ ...metricRowStyle, marginBottom: "var(--space-3)" }}>
            <span>Average score:</span>
            <strong style={{ color: "var(--color-text-primary)" }}>
              {bigIdeas.avg_score.toFixed(1)}
            </strong>
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--space-4)",
            marginBottom: "var(--space-4)",
          }}
        >
          <MetricBox label="Pain Groups" value={painGroups.total} />
          <MetricBox label="New Finds (new)" value={decide.new} />
          <MetricBox label="Approved" value={decide.approved} />
        </div>
        {decide.rejected > 0 && (
          <div style={metricRowStyle}>
            <span>Rejected:</span>
            <strong style={{ color: "var(--color-text-tertiary)" }}>{decide.rejected}</strong>
          </div>
        )}
      </Section>

      {/* ── 6) What counts as a real signal? ──────────────────── */}
      <Section
        title="What counts as a real signal?"
        description="These are the rules the system uses to decide if an approved New Find is worth turning into a Big Idea."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {PASS_RULES.map((rule) => (
            <div
              key={rule.id}
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border-subtle)",
                fontSize: "var(--text-sm)",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "var(--space-1)" }}>
                {rule.title}
              </div>
              <div style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>
                {rule.description}
              </div>
              <div style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-xs)" }}>
                Examples: {rule.examples.slice(0, 2).map((ex, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    &ldquo;{ex}&rdquo;
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Reusable pieces ──────────────────────────────────────────

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

function FlagRow({ level, message }: { level: "bad" | "ok"; message: string }) {
  const isBad = level === "bad";
  return (
    <div
      style={{
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${isBad ? "var(--color-error-border)" : "var(--color-warning-border)"}`,
        background: isBad ? "var(--color-error-bg)" : "var(--color-warning-bg)",
        fontSize: "var(--text-sm)",
        color: "var(--color-text-primary)",
      }}
    >
      <strong>{isBad ? "BAD" : "OK"}:</strong> {message}
    </div>
  );
}

function CountRow({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "var(--space-2) var(--space-3)",
        fontSize: "var(--text-sm)",
      }}
    >
      <span style={{ color: "var(--color-text-primary)" }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: "var(--color-text-primary)",
        }}
      >
        {count.toLocaleString()}
      </span>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────

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
