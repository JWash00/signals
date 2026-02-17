import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import CreateClusterButton from "./CreateClusterButton";
import CreateOpportunityButton from "./CreateOpportunityButton";

const TABS = ["approved", "clusters"] as const;
type Tab = (typeof TABS)[number];

function isValidTab(v: unknown): v is Tab {
  return typeof v === "string" && TABS.includes(v as Tab);
}

function prettyJSON(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function truncate(text: string, max = 320) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "\u2026" : text;
}

interface ClustersPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ClustersPage({ searchParams }: ClustersPageProps) {
  const params = await searchParams;
  const selectedTab: Tab = isValidTab(params.tab) ? params.tab : "approved";

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) redirect("/login");

  const [countApproved, countClusters, listResult] = await Promise.all([
    supabase
      .from("raw_signals")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "approved"),
    supabase
      .from("pain_clusters")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
    selectedTab === "approved"
      ? supabase
          .from("raw_signals")
          .select("id, source, title, content, engagement_proxy, metadata, created_at")
          .eq("owner_id", user.id)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
      : supabase
          .from("pain_clusters")
          .select("id, title, pain_category, description, created_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false }),
  ]);

  if (listResult.error) throw listResult.error;

  const counts = {
    approved: countApproved.count ?? 0,
    clusters: countClusters.count ?? 0,
  };

  const tabLabels: Record<Tab, string> = {
    approved: "Approved Signals",
    clusters: "Clusters",
  };

  const items = listResult.data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div>
        <h1
          style={{
            fontSize: "var(--text-2xl)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          Clusters
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-tertiary)",
            marginTop: "var(--space-1)",
          }}
        >
          Create clusters from approved signals, then create opportunities from clusters.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-1)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {TABS.map((t) => {
          const isActive = t === selectedTab;
          return (
            <Link
              key={t}
              href={`/clusters?tab=${t}`}
              style={{
                padding: "var(--space-2) var(--space-4)",
                fontSize: "var(--text-sm)",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--color-accent)" : "var(--color-text-secondary)",
                textDecoration: "none",
                borderBottom: isActive
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                marginBottom: -1,
                transition: "all var(--duration-fast) var(--ease-default)",
              }}
            >
              {tabLabels[t]}
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "0 6px",
                  borderRadius: "var(--radius-full)",
                  background: isActive ? "var(--color-accent-subtle)" : "var(--color-bg-sunken)",
                  color: isActive ? "var(--color-accent)" : "var(--color-text-tertiary)",
                  fontWeight: 600,
                }}
              >
                {counts[t]}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <div
          style={{
            padding: "var(--space-10) var(--space-5)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-bg-elevated)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: "var(--color-text-primary)",
              marginBottom: "var(--space-2)",
            }}
          >
            {selectedTab === "approved" ? "No approved signals" : "No clusters yet"}
          </div>
          <div style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-sm)" }}>
            Nothing here yet.
          </div>
        </div>
      ) : selectedTab === "approved" ? (
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {items.map((s: Record<string, unknown>) => (
            <div
              key={s.id as string}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-4)",
                background: "var(--color-bg-elevated)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                transition: "box-shadow var(--duration-fast) var(--ease-default)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-tertiary)",
                      marginBottom: "var(--space-1)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <Badge variant="default">{String(s.source ?? "")}</Badge>
                    {s.created_at && (
                      <span>{new Date(s.created_at as string).toLocaleDateString()}</span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: "var(--text-lg)",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    {String(s.title ?? "") || "(no title)"}
                  </div>

                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text-secondary)",
                      whiteSpace: "pre-wrap",
                      lineHeight: "var(--leading-relaxed)",
                    }}
                  >
                    {truncate(String(s.content ?? ""), 320) || "(no content)"}
                  </div>
                </div>

                <CreateClusterButton signalId={s.id as string} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div>
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
                    engagement_proxy
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border-subtle)",
                      background: "var(--color-bg-sunken)",
                      overflowX: "auto",
                      fontSize: "var(--text-xs)",
                      fontFamily: "var(--font-mono), monospace",
                    }}
                  >
                    {prettyJSON(s.engagement_proxy)}
                  </pre>
                </div>

                <details>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    metadata
                  </summary>
                  <pre
                    style={{
                      marginTop: "var(--space-2)",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border-subtle)",
                      background: "var(--color-bg-sunken)",
                      overflowX: "auto",
                      fontSize: "var(--text-xs)",
                      fontFamily: "var(--font-mono), monospace",
                    }}
                  >
                    {prettyJSON(s.metadata)}
                  </pre>
                </details>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {items.map((c: Record<string, unknown>) => (
            <div
              key={c.id as string}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-4)",
                background: "var(--color-bg-elevated)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "var(--space-3)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--text-lg)",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  {String(c.title ?? "(no title)")}
                </div>
                <div style={{ marginBottom: "var(--space-2)" }}>
                  <Badge variant="accent">{String(c.pain_category ?? "")}</Badge>
                </div>
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {truncate(String(c.description ?? ""), 220) || "(no description)"}
                </div>
              </div>

              <CreateOpportunityButton clusterId={c.id as string} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
