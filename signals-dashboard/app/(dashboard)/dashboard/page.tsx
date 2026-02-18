import { requireUser } from "@/lib/auth/requireUser";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScoreCard } from "@/components/pmf/ScoreCard";
import { DashboardTable } from "./DashboardTable";
import type { Verdict } from "@/lib/pmf/types";

// ── Pricing (same as /usage page) ──────────────────────────
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
};

// ── Helpers ────────────────────────────────────────────────
function verdictVariant(v: string | null) {
  switch (v) {
    case "BUILD": return "success" as const;
    case "INVEST": return "info" as const;
    case "MONITOR": return "warning" as const;
    case "PASS": return "default" as const;
    default: return "default" as const;
  }
}

function verdictColor(v: string): string {
  switch (v) {
    case "BUILD": return "var(--color-success)";
    case "INVEST": return "var(--color-info)";
    case "MONITOR": return "var(--color-warning)";
    case "PASS": return "var(--color-text-tertiary)";
    default: return "var(--color-text-tertiary)";
  }
}

type StatusKey = "scored" | "investigating" | "validating" | "confirmed" | "killed" | "building" | "launched";

function statusVariant(s: string) {
  switch (s as StatusKey) {
    case "scored": return "default" as const;
    case "investigating": return "info" as const;
    case "validating": return "warning" as const;
    case "confirmed": return "success" as const;
    case "killed": return "error" as const;
    case "building": return "accent" as const;
    case "launched": return "success" as const;
    default: return "default" as const;
  }
}

function severityVariant(s: string) {
  switch (s) {
    case "critical": return "error" as const;
    case "warning": return "warning" as const;
    case "info": return "info" as const;
    default: return "default" as const;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function computeEventCost(
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (!model || !(model in MODEL_PRICING)) return null;
  const p = MODEL_PRICING[model];
  return ((inputTokens ?? 0) / 1_000_000) * p.input +
         ((outputTokens ?? 0) / 1_000_000) * p.output;
}

// ── Pipeline row type for the table ─────────────────────────
interface PipelineRow {
  opportunity_id: string;
  title: string;
  status: string;
  score_total: number | null;
  verdict: string | null;
  confidence: number | null;
}

// ── Page ───────────────────────────────────────────────────
export default async function DashboardPage() {
  const { user, supabase } = await requireUser();

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();

  // ── Parallel queries ─────────────────────────────────────
  const [pipelineResult, opportunitiesResult, aiUsageResult, alertsResult] =
    await Promise.all([
      // 1. Pipeline top 25 (existing)
      supabase
        .from("pipeline_v1")
        .select("*")
        .order("score_total", { ascending: false })
        .limit(25),

      // 2. All opportunities for status/verdict distribution
      supabase
        .from("opportunities")
        .select("id, status, score_total, verdict"),

      // 3. AI usage today
      supabase
        .from("ai_usage_events")
        .select("model, input_tokens, output_tokens, total_tokens")
        .eq("owner_id", user.id)
        .gte("created_at", todayStart),

      // 4. Recent alerts
      supabase
        .from("alerts")
        .select("id, alert_type, severity, title, message, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  // ── Primary data (error = full page error) ───────────────
  if (pipelineResult.error) {
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
        {pipelineResult.error.message}
      </div>
    );
  }

  const rows = (pipelineResult.data ?? []) as PipelineRow[];

  // ── Secondary data (graceful degradation) ────────────────
  const allOpportunities = opportunitiesResult.data ?? [];
  const aiEvents = aiUsageResult.data ?? [];
  const recentAlerts = alertsResult.data ?? [];

  // ── KPI computations ────────────────────────────────────
  const totalCount = allOpportunities.length;
  const scoredCount = allOpportunities.filter((r) => r.score_total != null).length;
  const buildCount = allOpportunities.filter((r) => r.verdict === "BUILD").length;
  const avgScore =
    scoredCount > 0
      ? allOpportunities
          .filter((r) => r.score_total != null)
          .reduce((sum, r) => sum + (r.score_total as number), 0) / scoredCount
      : 0;

  // ── Status distribution ──────────────────────────────────
  const statusMap = new Map<string, number>();
  for (const opp of allOpportunities) {
    const s = (opp.status as string) ?? "unknown";
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  }
  const statusEntries = Array.from(statusMap.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  // ── Verdict distribution ─────────────────────────────────
  const verdictOrder = ["BUILD", "INVEST", "MONITOR", "PASS"] as const;
  const verdictMap = new Map<string, number>();
  for (const opp of allOpportunities) {
    if (opp.verdict) {
      const v = opp.verdict as string;
      verdictMap.set(v, (verdictMap.get(v) ?? 0) + 1);
    }
  }
  const verdictTotal = Array.from(verdictMap.values()).reduce((a, b) => a + b, 0);
  const verdictSegments = verdictOrder.map((v) => ({
    verdict: v,
    count: verdictMap.get(v) ?? 0,
    percent: verdictTotal > 0 ? ((verdictMap.get(v) ?? 0) / verdictTotal) * 100 : 0,
  }));

  // ── AI usage summary ────────────────────────────────────
  const aiTotalTokens = aiEvents.reduce(
    (sum, r) => sum + (r.total_tokens ?? 0),
    0,
  );
  const aiEventCount = aiEvents.length;
  const aiTotalCost = aiEvents.reduce((sum, r) => {
    const c = computeEventCost(r.model, r.input_tokens, r.output_tokens);
    return sum + (c ?? 0);
  }, 0);

  // ── Top opportunity ──────────────────────────────────────
  const top = rows[0];

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

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div
        className="stagger"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}
      >
        <KPICard
          label="Total Opportunities"
          value={totalCount}
          subtitle={`${scoredCount} scored`}
        />
        <KPICard
          label="Avg PMF Score"
          value={scoredCount > 0 ? avgScore.toFixed(1) : "\u2014"}
          subtitle={scoredCount > 0 ? `across ${scoredCount} scored` : "No scores yet"}
        />
        <KPICard
          label="BUILD Verdict"
          value={buildCount}
          accent
          subtitle={scoredCount > 0 ? `${((buildCount / scoredCount) * 100).toFixed(0)}% of scored` : "No verdicts yet"}
        />
      </div>

      {/* ── Top ScoreCard ─────────────────────────────────── */}
      {top && top.score_total != null && (
        <ScoreCard
          score={top.score_total as number}
          verdict={top.verdict as Verdict}
          confidence={(top.confidence as number) ?? 0}
        />
      )}

      {/* ── Status + Verdict Distribution ─────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-4)" }}>
        {/* Pipeline Status */}
        <Card title="Pipeline Status">
          {statusEntries.length === 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)", margin: 0 }}>
              No opportunities yet
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
              {statusEntries.map(([status, count]) => (
                <div
                  key={status}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                  }}
                >
                  <Badge variant={statusVariant(status)}>{status}</Badge>
                  <span
                    style={{
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Verdict Breakdown */}
        <Card title="Verdict Breakdown">
          {verdictTotal === 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)", margin: 0 }}>
              No verdicts yet
            </p>
          ) : (
            <>
              {/* Stacked bar */}
              <div
                style={{
                  display: "flex",
                  height: 24,
                  borderRadius: "var(--radius-full)",
                  overflow: "hidden",
                  background: "var(--color-bg-sunken)",
                  marginBottom: "var(--space-3)",
                }}
              >
                {verdictSegments.map(
                  (seg) =>
                    seg.count > 0 && (
                      <div
                        key={seg.verdict}
                        style={{
                          width: `${seg.percent}%`,
                          background: verdictColor(seg.verdict),
                          minWidth: 4,
                        }}
                      />
                    ),
                )}
              </div>
              {/* Legend */}
              <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
                {verdictSegments.map((seg) => (
                  <div
                    key={seg.verdict}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <Badge variant={verdictVariant(seg.verdict)}>{seg.verdict}</Badge>
                    <span
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "var(--text-sm)",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {seg.count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── AI Usage + Recent Alerts ──────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-4)" }}>
        {/* AI Usage Today */}
        <Card title="AI Usage Today">
          {aiEventCount === 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)", margin: 0 }}>
              No AI usage recorded today
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
              <div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: "var(--color-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  Tokens
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xl)",
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {aiTotalTokens.toLocaleString()}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: "var(--color-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  Events
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xl)",
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {aiEventCount}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: "var(--color-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  Est. Cost
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xl)",
                    fontWeight: 700,
                    color: "var(--color-accent)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  ${aiTotalCost.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Recent Alerts */}
        <Card title="Recent Alerts">
          {recentAlerts.length === 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)", margin: 0 }}>
              No recent alerts
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {recentAlerts.map((alert, idx) => (
                <div
                  key={alert.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-2) 0",
                    borderBottom:
                      idx < recentAlerts.length - 1
                        ? "1px solid var(--color-border-subtle)"
                        : "none",
                  }}
                >
                  <Badge variant={severityVariant(alert.severity as string)} size="sm">
                    {alert.severity as string}
                  </Badge>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {alert.title as string}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-tertiary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {timeAgo(alert.created_at as string)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Opportunities Table ───────────────────────────── */}
      <Card title="Top 25 Opportunities" padding={false}>
        <DashboardTable data={rows} />
      </Card>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────
function KPICard({
  label,
  value,
  accent = false,
  subtitle,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  subtitle?: string;
}) {
  return (
    <div
      className="kpi-card"
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
      {subtitle && (
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-tertiary)",
            marginTop: "var(--space-1)",
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
