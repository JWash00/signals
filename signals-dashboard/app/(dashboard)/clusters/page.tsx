import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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
  return text.length > max ? text.slice(0, max) + "…" : text;
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

  // Counts + list in parallel
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
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Clusters</h1>
      <p style={{ opacity: 0.75, marginBottom: 16 }}>
        Create clusters from approved signals, then create opportunities from clusters.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {TABS.map((t) => {
          const isActive = t === selectedTab;
          return (
            <Link
              key={t}
              href={`/clusters?tab=${t}`}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: isActive ? "1px solid #1a1a1a" : "1px solid #e5e5e5",
                background: isActive ? "#1a1a1a" : "white",
                color: isActive ? "white" : "#1a1a1a",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tabLabels[t]}
              <span
                style={{
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 9999,
                  background: isActive ? "rgba(255,255,255,0.2)" : "#f0f0f0",
                  color: isActive ? "white" : "#666",
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
        <div style={{ padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {selectedTab === "approved" ? "No approved signals" : "No clusters yet"}
          </div>
          <div style={{ opacity: 0.75 }}>Nothing here yet.</div>
        </div>
      ) : selectedTab === "approved" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((s: Record<string, unknown>) => (
            <div
              key={s.id as string}
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>{String(s.source ?? "")}</span>
                    {s.created_at ? (
                      <span> · {new Date(s.created_at as string).toLocaleString()}</span>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                    {String(s.title ?? "") || "(no title)"}
                  </div>

                  <div style={{ fontSize: 14, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                    {truncate(String(s.content ?? ""), 320) || "(no content)"}
                  </div>
                </div>

                <CreateClusterButton signalId={s.id as string} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75, marginBottom: 6 }}>
                    engagement_proxy
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid #f0f0f0",
                      background: "#fafafa",
                      overflowX: "auto",
                      fontSize: 12,
                    }}
                  >
                    {prettyJSON(s.engagement_proxy)}
                  </pre>
                </div>

                <details>
                  <summary style={{ cursor: "pointer", fontWeight: 700, opacity: 0.8 }}>
                    metadata (collapsed)
                  </summary>
                  <pre
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid #f0f0f0",
                      background: "#fafafa",
                      overflowX: "auto",
                      fontSize: 12,
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
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((c: Record<string, unknown>) => (
            <div
              key={c.id as string}
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                padding: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                  {String(c.title ?? "(no title)")}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                  {String(c.pain_category ?? "")}
                </div>
                <div style={{ fontSize: 14, opacity: 0.9 }}>
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
