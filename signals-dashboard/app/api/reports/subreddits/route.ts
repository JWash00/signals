import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { subredditFromRedditUrl } from "@/lib/sources/redditSubredditFromUrl";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    // 1. Get all clusters for this owner
    const { data: clusters, error: clErr } = await supabase
      .from("pain_clusters")
      .select("id")
      .eq("owner_id", user.id);

    if (clErr) throw new Error(`Fetch clusters: ${clErr.message}`);

    const clusterIds = (clusters ?? []).map((c) => c.id as string);

    if (clusterIds.length === 0) {
      return NextResponse.json({
        ok: true,
        generated_at: new Date().toISOString(),
        rows: [],
      });
    }

    // 2. Get opportunities for those clusters (limit 500, last 30 days)
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: opps, error: oppErr } = await supabase
      .from("opportunities")
      .select("id, cluster_id, title, created_at")
      .in("cluster_id", clusterIds)
      .gte("created_at", thirtyDaysAgo)
      .limit(500);

    if (oppErr) throw new Error(`Fetch opportunities: ${oppErr.message}`);

    const opportunities = opps ?? [];

    if (opportunities.length === 0) {
      return NextResponse.json({
        ok: true,
        generated_at: new Date().toISOString(),
        rows: [],
      });
    }

    // 3. Get approved reddit signals for those clusters
    const oppClusterIds = [
      ...new Set(opportunities.map((o) => o.cluster_id as string)),
    ];

    const { data: signals, error: sigErr } = await supabase
      .from("raw_signals")
      .select("id, cluster_id, source, source_url, metadata")
      .eq("owner_id", user.id)
      .eq("source", "reddit")
      .eq("status", "approved")
      .in("cluster_id", oppClusterIds);

    if (sigErr) throw new Error(`Fetch signals: ${sigErr.message}`);

    const redditSignals = signals ?? [];

    // 4. For each opportunity, find its subreddits
    //    Build cluster_id → subreddit counts
    const clusterSubreddits = new Map<string, Map<string, number>>();

    for (const sig of redditSignals) {
      const cid = sig.cluster_id as string;
      const meta = (sig.metadata ?? {}) as Record<string, unknown>;
      const sub =
        (meta.subreddit as string) ??
        subredditFromRedditUrl(sig.source_url) ??
        null;

      if (!sub) continue;

      if (!clusterSubreddits.has(cid)) {
        clusterSubreddits.set(cid, new Map());
      }
      const counts = clusterSubreddits.get(cid)!;
      counts.set(sub, (counts.get(sub) ?? 0) + 1);
    }

    // 5. For each opportunity, pick the "main subreddit" (most common)
    const subredditBigIdeas = new Map<
      string,
      { count: number; sampleIds: string[]; sampleTitles: string[] }
    >();

    for (const opp of opportunities) {
      const cid = opp.cluster_id as string;
      const subCounts = clusterSubreddits.get(cid);
      if (!subCounts || subCounts.size === 0) continue;

      // Pick the subreddit with the highest count
      let mainSub = "";
      let maxCount = 0;
      for (const [sub, count] of subCounts) {
        if (count > maxCount) {
          mainSub = sub;
          maxCount = count;
        }
      }

      if (!mainSub) continue;

      if (!subredditBigIdeas.has(mainSub)) {
        subredditBigIdeas.set(mainSub, {
          count: 0,
          sampleIds: [],
          sampleTitles: [],
        });
      }
      const entry = subredditBigIdeas.get(mainSub)!;
      entry.count++;
      if (entry.sampleIds.length < 3) {
        entry.sampleIds.push(opp.id as string);
        entry.sampleTitles.push((opp.title as string) || "(untitled)");
      }
    }

    // 6. Build response rows sorted by count desc
    const rows = Array.from(subredditBigIdeas.entries())
      .map(([sub, data]) => ({
        subreddit: sub,
        big_ideas: data.count,
        sample_big_idea_ids: data.sampleIds,
        sample_big_idea_titles: data.sampleTitles,
      }))
      .sort((a, b) => b.big_ideas - a.big_ideas);

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      rows,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[reports/subreddits] Error:", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
