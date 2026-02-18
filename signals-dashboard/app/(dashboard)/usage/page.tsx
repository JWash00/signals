import { requireUser } from "@/lib/auth/requireUser";
import { Card } from "@/components/ui/Card";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
};

function computeCost(
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (!model || !(model in MODEL_PRICING)) return null;
  const pricing = MODEL_PRICING[model];
  const inputCost = ((inputTokens ?? 0) / 1_000_000) * pricing.input;
  const outputCost = ((outputTokens ?? 0) / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export default async function UsagePage() {
  const { user, supabase } = await requireUser();

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // ── Queries in parallel ────────────────────────────────────────
  const [todayRes, weekRes, eventsRes] = await Promise.all([
    // Today totals (include model + per-token columns for cost)
    supabase
      .from("ai_usage_events")
      .select("total_tokens, model, input_tokens, output_tokens")
      .eq("owner_id", user.id)
      .gte("created_at", todayStart),

    // Last 7 days totals
    supabase
      .from("ai_usage_events")
      .select("total_tokens, model, input_tokens, output_tokens")
      .eq("owner_id", user.id)
      .gte("created_at", sevenDaysAgo),

    // Event list
    supabase
      .from("ai_usage_events")
      .select(
        "id, event, model, input_tokens, output_tokens, total_tokens, opportunity_id, created_at",
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const todayRows = todayRes.data ?? [];
  const weekRows = weekRes.data ?? [];
  const events = eventsRes.data ?? [];

  const todayTokens = todayRows.reduce(
    (sum, r) => sum + (r.total_tokens ?? 0),
    0,
  );
  const weekTokens = weekRows.reduce(
    (sum, r) => sum + (r.total_tokens ?? 0),
    0,
  );
  const todayRuns = todayRows.length;
  const weekRuns = weekRows.length;

  // ── Cost totals ────────────────────────────────────────────────
  const todayCost = todayRows.reduce((sum, r) => {
    const c = computeCost(r.model, r.input_tokens, r.output_tokens);
    return sum + (c ?? 0);
  }, 0);

  const weekCost = weekRows.reduce((sum, r) => {
    const c = computeCost(r.model, r.input_tokens, r.output_tokens);
    return sum + (c ?? 0);
  }, 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <h1
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          margin: 0,
        }}
      >
        AI Usage
      </h1>

      {/* Summary boxes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-4)",
        }}
      >
        <Card title="Today">
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
            <span
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: 700,
                color: "var(--color-text-primary)",
              }}
            >
              {todayTokens.toLocaleString()}
            </span>
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-tertiary)",
              }}
            >
              tokens
            </span>
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--color-accent)",
                marginLeft: "var(--space-1)",
              }}
            >
              ${todayCost.toFixed(2)}
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              marginTop: "var(--space-1)",
            }}
          >
            {todayRuns} {todayRuns === 1 ? "run" : "runs"}
          </div>
        </Card>

        <Card title="Last 7 Days">
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
            <span
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: 700,
                color: "var(--color-text-primary)",
              }}
            >
              {weekTokens.toLocaleString()}
            </span>
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-tertiary)",
              }}
            >
              tokens
            </span>
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--color-accent)",
                marginLeft: "var(--space-1)",
              }}
            >
              ${weekCost.toFixed(2)}
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              marginTop: "var(--space-1)",
            }}
          >
            {weekRuns} {weekRuns === 1 ? "run" : "runs"}
          </div>
        </Card>
      </div>

      {/* Events table */}
      <Card title="Recent Events">
        {events.length === 0 ? (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-tertiary)",
              margin: 0,
            }}
          >
            No AI usage yet.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--text-sm)",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Time",
                    "Event",
                    "Model",
                    "Input",
                    "Output",
                    "Total",
                    "Cost",
                    "Opportunity",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign:
                          h === "Input" || h === "Output" || h === "Total" || h === "Cost"
                            ? "right"
                            : "left",
                        padding: "var(--space-2) var(--space-3)",
                        borderBottom: "1px solid var(--color-border)",
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                        color: "var(--color-text-tertiary)",
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const cost = computeCost(ev.model, ev.input_tokens, ev.output_tokens);
                  return (
                    <tr key={ev.id}>
                      <td
                        style={{
                          padding: "var(--space-2) var(--space-3)",
                          borderBottom: "1px solid var(--color-border-subtle)",
                          whiteSpace: "nowrap",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {new Date(ev.created_at).toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "var(--space-2) var(--space-3)",
                          borderBottom: "1px solid var(--color-border-subtle)",
                          color: "var(--color-text-primary)",
                          fontWeight: 500,
                        }}
                      >
                        {ev.event}
                      </td>
                      <td
                        style={{
                          padding: "var(--space-2) var(--space-3)",
                          borderBottom: "1px solid var(--color-border-subtle)",
                          color: "var(--color-text-secondary)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-xs)",
                        }}
                      >
                        {ev.model}
                      </td>
                      <td
                        style={{
                          padding: "var(--space-2) var(--space-3)",
                          borderBottom: "1px solid var(--color-border-subtle)",
                          textAlign: "right",
                          color: "var(--color-text-secondary)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {ev.input_tokens?.toLocaleString() ?? "\u2014"}
                      </td>
                      <td
                        style={{
                          padding: "var(--space-2) var(--space-3)",
                          borderBottom: "1px solid var(--color-border-subtle)",
                          textAlign: "right",
                          color: "var(--color-text-secondary)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {ev.output_tokens?.toLocaleString() ?? "\u2014"}
                      </td>
                      <td
                        style={{
                          padding: "var(--space-2) var(--space-3)",
                          borderBottom: "1px solid var(--color-border-subtle)",
                          textAlign: "right",
                          color: "var(--color-text-primary)",
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {ev.total_tokens?.toLocaleString() ?? "\u2014"}
                      </td>
                      <td
                        style={{
                          padding: "var(--space-2) var(--space-3)",
                          borderBottom: "1px solid var(--color-border-subtle)",
                          textAlign: "right",
                          color: "var(--color-accent)",
                          fontWeight: 500,
                          fontVariantNumeric: "tabular-nums",
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-xs)",
                        }}
                      >
                        {cost != null ? `$${cost.toFixed(4)}` : "$\u2014"}
                      </td>
                      <td
                        style={{
                          padding: "var(--space-2) var(--space-3)",
                          borderBottom: "1px solid var(--color-border-subtle)",
                          color: "var(--color-text-tertiary)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-xs)",
                        }}
                      >
                        {ev.opportunity_id
                          ? ev.opportunity_id.slice(0, 8) + "..."
                          : "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
