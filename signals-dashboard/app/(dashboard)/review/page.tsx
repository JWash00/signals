import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ReviewDecisionButtons from "./ReviewDecisionButtons";

const STATUSES = ["new", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];

function isValidStatus(v: unknown): v is Status {
  return typeof v === "string" && STATUSES.includes(v as Status);
}

function prettyJSON(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function truncate(text: string, max = 260) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

interface ReviewPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;
  const selectedStatus: Status = isValidStatus(params.status) ? params.status : "new";

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) redirect("/login");

  // Fetch counts for all 3 tabs and the filtered list in parallel
  const [countNew, countApproved, countRejected, listResult] = await Promise.all([
    supabase
      .from("raw_signals")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "new"),
    supabase
      .from("raw_signals")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "approved"),
    supabase
      .from("raw_signals")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "rejected"),
    supabase
      .from("raw_signals")
      .select("id, owner_id, source, title, content, engagement_proxy, metadata, status, created_at")
      .eq("owner_id", user.id)
      .eq("status", selectedStatus)
      .order("created_at", { ascending: false }),
  ]);

  if (listResult.error) throw listResult.error;

  const signals = listResult.data ?? [];
  const counts: Record<Status, number> = {
    new: countNew.count ?? 0,
    approved: countApproved.count ?? 0,
    rejected: countRejected.count ?? 0,
  };

  const tabLabels: Record<Status, string> = {
    new: "New",
    approved: "Approved",
    rejected: "Rejected",
  };

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Review Queue</h1>
      <p style={{ opacity: 0.75, marginBottom: 16 }}>
        Approve or reject raw signals. No editing. One click per decision.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {STATUSES.map((s) => {
          const isActive = s === selectedStatus;
          return (
            <Link
              key={s}
              href={`/review?status=${s}`}
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
              {tabLabels[s]}
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
                {counts[s]}
              </span>
            </Link>
          );
        })}
      </div>

      {/* List */}
      {signals.length === 0 ? (
        <div style={{ padding: 16, border: "1px solid #e5e5e5", borderRadius: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No {selectedStatus} signals</div>
          <div style={{ opacity: 0.75 }}>Nothing here yet.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {signals.map((s) => (
            <div
              key={s.id}
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
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700 }}>{s.source}</span>
                    {(s.source === "product_hunt" || s.source === "producthunt") && s.metadata?.ph_mode && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: s.metadata.ph_mode === "TODAY" ? "#f59e0b" : s.metadata.ph_mode === "BACKFILL" ? "#8b5cf6" : "#3b82f6",
                          color: "#fff",
                          whiteSpace: "nowrap",
                        }}
                      >
                        PH {"\u00b7"} {s.metadata.ph_mode === "LIVE" ? `Live ${s.metadata.ph_window ?? ""}` : s.metadata.ph_mode === "TODAY" ? "Today\u2019s Winners" : `Backfill ${s.metadata.ph_window ?? ""}`}
                      </span>
                    )}
                    {s.created_at ? <span> · {new Date(s.created_at).toLocaleString()}</span> : null}
                  </div>

                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                    {s.title || "(no title)"}
                  </div>

                  <div style={{ fontSize: 14, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                    {truncate(s.content || "", 320) || "(no content)"}
                  </div>
                </div>

                <ReviewDecisionButtons id={s.id} currentStatus={selectedStatus} />
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
      )}
    </div>
  );
}
