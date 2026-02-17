// ============================================================
// SIGNALFORGE — Scribe Agent (Daily Briefing + Dossier)
//
// Generates and delivers:
// 1. Daily briefing (top opportunities, score movers, alerts, stats)
// 2. Tier A dossiers (deep-dive reports on best opportunities)
//
// Delivery channels:
// - Slack webhook (primary)
// - Email via Resend (secondary)
// - Console output (always)
//
// Usage:
//   node agents/scribe.js                  # full daily briefing
//   node agents/scribe.js --dossier <id>   # generate dossier for specific opportunity
//
// ============================================================

import { config, validateConfig, getSupabase, log } from '../lib/config.js';

validateConfig(['supabase.url', 'supabase.serviceRoleKey']);

// ─── Configuration ───────────────────────────────────────────

const BRIEFING_MAX_OPPORTUNITIES = 5;
const BRIEFING_MAX_MOVERS = 5;
const BRIEFING_MAX_ALERTS = 10;
const DOSSIER_MAX_QUOTES = 8;

// ─── Fetch Briefing Data ─────────────────────────────────────

async function fetchBriefingData() {
  const sb = getSupabase();

  // Top new opportunities (created in last 48h)
  const { data: newOpps } = await sb
    .from('opportunities')
    .select(`
      id, title, description, score_total, tier, status,
      score_pain, score_velocity, score_wtp, score_competition, score_feasibility,
      competitor_count, primary_gap, mvp_build_days, positioning, differentiator,
      pricing_recommendation, distribution_channels,
      cluster_id,
      created_at
    `)
    .not('status', 'in', '("killed","launched")')
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('score_total', { ascending: false })
    .limit(BRIEFING_MAX_OPPORTUNITIES);

  // Top scoring active opportunities overall
  const { data: topOpps } = await sb
    .from('opportunities')
    .select(`
      id, title, score_total, tier, status,
      competitor_count, primary_gap, mvp_build_days,
      cluster_id, updated_at
    `)
    .not('status', 'in', '("killed","launched")')
    .in('tier', ['A', 'B'])
    .order('score_total', { ascending: false })
    .limit(BRIEFING_MAX_OPPORTUNITIES);

  // Score movers (opportunities with score_history)
  const { data: allOpps } = await sb
    .from('opportunities')
    .select('id, title, score_total, tier, score_history')
    .not('status', 'in', '("killed","launched")')
    .not('score_history', 'is', null);

  // Calculate movers from score_history
  const movers = (allOpps || [])
    .map(opp => {
      const history = Array.isArray(opp.score_history) ? opp.score_history : [];
      if (history.length < 2) return null;
      const latest = history[history.length - 1];
      const previous = history[history.length - 2];
      const change = (latest?.total || opp.score_total) - (previous?.total || opp.score_total);
      if (Math.abs(change) < 2) return null;
      return { ...opp, change: Math.round(change * 10) / 10, previous_score: previous?.total };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, BRIEFING_MAX_MOVERS);

  // Undelivered alerts
  const { data: alerts } = await sb
    .from('alerts')
    .select('id, alert_type, severity, title, message, metadata, created_at')
    .eq('delivered_email', false)
    .order('created_at', { ascending: false })
    .limit(BRIEFING_MAX_ALERTS);

  // 7-day stats
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { count: signalsIngested } = await sb
    .from('raw_signals')
    .select('id', { count: 'exact', head: true })
    .gte('ingested_at', sevenDaysAgo);

  const { count: signalsClassified } = await sb
    .from('raw_signals')
    .select('id', { count: 'exact', head: true })
    .gte('ingested_at', sevenDaysAgo)
    .eq('is_processed', true)
    .eq('is_noise', false);

  const { count: clustersUpdated } = await sb
    .from('pain_clusters')
    .select('id', { count: 'exact', head: true })
    .gte('updated_at', sevenDaysAgo);

  const { count: tierACount } = await sb
    .from('opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('tier', 'A')
    .not('status', 'eq', 'killed');

  const { count: tierBCount } = await sb
    .from('opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('tier', 'B')
    .not('status', 'eq', 'killed');

  // Trending clusters (accelerating velocity, not yet opportunities)
  const { data: trending } = await sb
    .from('pain_clusters')
    .select('id, title, signal_count, velocity_7d, velocity_trend, avg_intensity, platforms, wtp_ratio')
    .eq('velocity_trend', 'accelerating')
    .gte('signal_count', 5)
    .order('velocity_7d', { ascending: false })
    .limit(3);

  // Fetch cluster details for top opportunities (for quotes)
  const clusterIds = [...new Set([
    ...(newOpps || []).map(o => o.cluster_id),
    ...(topOpps || []).map(o => o.cluster_id),
  ].filter(Boolean))];

  let clusterMap = {};
  if (clusterIds.length > 0) {
    const { data: clusters } = await sb
      .from('pain_clusters')
      .select('id, title, signal_count, velocity_7d, velocity_trend, platforms, top_quotes, wtp_ratio, avg_intensity')
      .in('id', clusterIds);

    for (const c of (clusters || [])) {
      clusterMap[c.id] = c;
    }
  }

  return {
    newOpps: newOpps || [],
    topOpps: topOpps || [],
    movers,
    alerts: alerts || [],
    trending: trending || [],
    clusterMap,
    stats: {
      signals_ingested: signalsIngested || 0,
      signals_classified: signalsClassified || 0,
      clusters_updated: clustersUpdated || 0,
      tier_a_count: tierACount || 0,
      tier_b_count: tierBCount || 0,
    },
  };
}

// ─── Format Briefing (Console + Plain Text) ──────────────────

function formatBriefingConsole(data) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let output = '';

  output += `\n═══════════════════════════════════════════════════════════════\n`;
  output += `  SIGNALFORGE DAILY BRIEFING — ${dateStr}\n`;
  output += `═══════════════════════════════════════════════════════════════\n`;

  // ── New Opportunities ──
  if (data.newOpps.length > 0) {
    output += `\n▶ NEW OPPORTUNITIES (last 48h)\n`;
    output += `─────────────────────────────────────────────────────────────\n`;
    for (const opp of data.newOpps) {
      const cluster = data.clusterMap[opp.cluster_id] || {};
      const icon = opp.tier === 'A' ? '🔥' : opp.tier === 'B' ? '⚡' : '📊';
      const quote = cluster.top_quotes?.[0];
      const quoteText = typeof quote === 'string' ? quote : quote?.text;

      output += `${icon} "${opp.title}" — Score: ${opp.score_total}/100 (Tier ${opp.tier})\n`;
      output += `   Pain: ${opp.score_pain} | Velocity: ${opp.score_velocity} | WTP: ${opp.score_wtp} | Competition: ${opp.score_competition} | Feasibility: ${opp.score_feasibility}\n`;
      output += `   Signals: ${cluster.signal_count || '?'} across ${(cluster.platforms || []).length} platforms\n`;
      if (opp.primary_gap) output += `   Gap: ${opp.primary_gap}\n`;
      if (opp.positioning) output += `   MVP: ${opp.positioning}\n`;
      if (opp.competitor_count) output += `   Competitors: ${opp.competitor_count}\n`;
      if (quoteText) output += `   Top quote: "${quoteText.slice(0, 150)}..."\n`;
      output += `\n`;
    }
  } else {
    output += `\n▶ No new opportunities in the last 48 hours.\n\n`;
  }

  // ── Top Active Opportunities ──
  if (data.topOpps.length > 0) {
    output += `▶ TOP ACTIVE OPPORTUNITIES\n`;
    output += `─────────────────────────────────────────────────────────────\n`;
    for (const opp of data.topOpps) {
      const icon = opp.tier === 'A' ? '🔥' : '⚡';
      output += `   ${icon} ${opp.score_total.toFixed(1).padStart(5)} [${opp.tier}] ${opp.title}\n`;
    }
    output += `\n`;
  }

  // ── Score Movers ──
  if (data.movers.length > 0) {
    output += `▶ SCORE MOVERS\n`;
    output += `─────────────────────────────────────────────────────────────\n`;
    for (const m of data.movers) {
      const arrow = m.change > 0 ? '↑' : '↓';
      const sign = m.change > 0 ? '+' : '';
      output += `   ${arrow} "${m.title}" — ${m.previous_score?.toFixed(1)} → ${m.score_total.toFixed(1)} (${sign}${m.change})\n`;
    }
    output += `\n`;
  }

  // ── Trending Clusters (Emerging) ──
  if (data.trending.length > 0) {
    output += `▶ EMERGING TRENDS (accelerating clusters not yet scored)\n`;
    output += `─────────────────────────────────────────────────────────────\n`;
    for (const t of data.trending) {
      output += `   🌱 "${t.title}" — ${t.signal_count} signals, ${t.velocity_7d}/week, intensity: ${t.avg_intensity?.toFixed(1)}/10\n`;
    }
    output += `\n`;
  }

  // ── Alerts ──
  if (data.alerts.length > 0) {
    output += `▶ ALERTS\n`;
    output += `─────────────────────────────────────────────────────────────\n`;
    for (const a of data.alerts) {
      const icon = a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : 'ℹ️';
      output += `   ${icon} [${a.alert_type}] ${a.title}\n`;
      output += `      ${a.message}\n`;
    }
    output += `\n`;
  }

  // ── Stats ──
  output += `▶ PIPELINE STATS (7-day)\n`;
  output += `─────────────────────────────────────────────────────────────\n`;
  output += `   Signals ingested:  ${data.stats.signals_ingested}\n`;
  output += `   Signals classified: ${data.stats.signals_classified}\n`;
  output += `   Clusters updated:  ${data.stats.clusters_updated}\n`;
  output += `   Tier A opportunities: ${data.stats.tier_a_count}\n`;
  output += `   Tier B opportunities: ${data.stats.tier_b_count}\n`;

  output += `\n═══════════════════════════════════════════════════════════════\n`;

  return output;
}

// ─── Format Briefing for Slack ───────────────────────────────

function formatBriefingSlack(data) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const blocks = [];

  // Header
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `📡 SignalForge Briefing — ${dateStr}` },
  });

  // Top opportunities
  if (data.newOpps.length > 0 || data.topOpps.length > 0) {
    const opps = data.newOpps.length > 0 ? data.newOpps : data.topOpps;
    let oppText = '';

    for (const opp of opps.slice(0, 3)) {
      const cluster = data.clusterMap[opp.cluster_id] || {};
      const icon = opp.tier === 'A' ? '🔥' : opp.tier === 'B' ? '⚡' : '📊';
      oppText += `${icon} *${opp.title}* — ${opp.score_total}/100 (Tier ${opp.tier})\n`;
      oppText += `${cluster.signal_count || '?'} signals · ${opp.competitor_count || '?'} competitors`;
      if (opp.primary_gap) oppText += ` · Gap: ${opp.primary_gap}`;
      oppText += `\n\n`;
    }

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: oppText.trim() },
    });
  } else {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '_No new opportunities. Pipeline is running._' },
    });
  }

  // Movers
  if (data.movers.length > 0) {
    blocks.push({ type: 'divider' });
    let moverText = '*Score Movers*\n';
    for (const m of data.movers.slice(0, 3)) {
      const arrow = m.change > 0 ? '📈' : '📉';
      const sign = m.change > 0 ? '+' : '';
      moverText += `${arrow} ${m.title}: ${sign}${m.change} (now ${m.score_total.toFixed(1)})\n`;
    }
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: moverText },
    });
  }

  // Critical alerts only
  const criticalAlerts = data.alerts.filter(a => a.severity === 'critical');
  if (criticalAlerts.length > 0) {
    blocks.push({ type: 'divider' });
    let alertText = '*🔴 Critical Alerts*\n';
    for (const a of criticalAlerts.slice(0, 3)) {
      alertText += `• ${a.title}: ${a.message}\n`;
    }
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: alertText },
    });
  }

  // Stats footer
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `📊 7d: ${data.stats.signals_ingested} signals · ${data.stats.clusters_updated} clusters · ${data.stats.tier_a_count}A + ${data.stats.tier_b_count}B opportunities`,
    }],
  });

  return { blocks };
}

// ─── Deliver to Slack ────────────────────────────────────────

async function sendToSlack(slackPayload) {
  if (!config.slack.webhookUrl) {
    log('scribe', 'Slack webhook not configured — skipping Slack delivery');
    return false;
  }

  try {
    const res = await fetch(config.slack.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!res.ok) {
      log('scribe', `Slack delivery failed: ${res.status} ${res.statusText}`);
      return false;
    }

    log('scribe', '✓ Briefing delivered to Slack');
    return true;
  } catch (err) {
    log('scribe', `Slack delivery error: ${err.message}`);
    return false;
  }
}

// ─── Deliver via Email (Resend) ──────────────────────────────

async function sendEmail(briefingText) {
  const resendKey = process.env.RESEND_API_KEY;
  const emailTo = process.env.BRIEFING_EMAIL_TO;
  const emailFrom = process.env.BRIEFING_EMAIL_FROM || 'SignalForge <signalforge@resend.dev>';

  if (!resendKey || !emailTo) {
    log('scribe', 'Email not configured — skipping email delivery');
    return false;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Convert plain text to basic HTML
  const htmlBody = briefingText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/═/g, '─')
    .replace(/\n/g, '<br>')
    .replace(/─{3,}/g, '<hr>')
    .replace(/▶/g, '<strong>▶</strong>');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: emailFrom,
        to: emailTo,
        subject: `📡 SignalForge Briefing — ${dateStr}`,
        html: `<div style="font-family: monospace; font-size: 13px; line-height: 1.6; max-width: 700px; padding: 20px; background: #1a1a2e; color: #e0e0e0;">${htmlBody}</div>`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      log('scribe', `Email delivery failed: ${res.status} — ${err}`);
      return false;
    }

    log('scribe', `✓ Briefing emailed to ${emailTo}`);
    return true;
  } catch (err) {
    log('scribe', `Email delivery error: ${err.message}`);
    return false;
  }
}

// ─── Mark Alerts as Delivered ────────────────────────────────

async function markAlertsDelivered(alertIds, channel) {
  if (alertIds.length === 0) return;
  const sb = getSupabase();
  const field = channel === 'slack' ? 'delivered_slack' : 'delivered_email';

  const { error } = await sb
    .from('alerts')
    .update({ [field]: true })
    .in('id', alertIds);

  if (error) log('scribe', `Failed to mark alerts as delivered: ${error.message}`);
}

// ─── Generate Dossier for a Specific Opportunity ─────────────

async function generateDossier(opportunityId) {
  const sb = getSupabase();

  // Fetch opportunity
  const { data: opp, error: oppError } = await sb
    .from('opportunities')
    .select('*')
    .eq('id', opportunityId)
    .single();

  if (oppError || !opp) {
    log('scribe', `Opportunity not found: ${opportunityId}`);
    return null;
  }

  // Fetch cluster
  const { data: cluster } = await sb
    .from('pain_clusters')
    .select('*')
    .eq('id', opp.cluster_id)
    .single();

  // Fetch competitors
  const { data: competitors } = await sb
    .from('competitors')
    .select('*')
    .eq('cluster_id', opp.cluster_id)
    .order('monthly_traffic', { ascending: false });

  // Fetch recent signals for this cluster
  const { data: signals } = await sb
    .from('raw_signals')
    .select('raw_text, source, source_url, upvotes, comments, engagement_score, published_at, wtp, budget_mentioned, tools_mentioned')
    .eq('cluster_id', opp.cluster_id)
    .eq('is_noise', false)
    .order('engagement_score', { ascending: false })
    .limit(20);

  // Build the dossier
  const quotes = cluster?.top_quotes || [];
  const now = new Date();

  let dossier = '';

  dossier += `OPPORTUNITY DOSSIER #${opp.id.slice(0, 8)}\n`;
  dossier += `═══════════════════════════════════════════════════════════════\n`;
  dossier += `Title: ${opp.title}\n`;
  dossier += `Score: ${opp.score_total}/100 | Tier: ${opp.tier} | Status: ${opp.status}\n`;
  dossier += `Generated: ${now.toISOString().slice(0, 10)}\n`;
  dossier += `\n`;

  // Section 1: The Pain
  dossier += `1. THE PAIN (in their words)\n`;
  dossier += `─────────────────────────────────────────────────────────────\n`;
  for (const q of quotes.slice(0, DOSSIER_MAX_QUOTES)) {
    const text = typeof q === 'string' ? q : q?.text;
    const source = typeof q === 'object' ? q?.source : 'unknown';
    const engagement = typeof q === 'object' ? q?.engagement : '?';
    if (text) {
      dossier += `"${text.slice(0, 250)}"\n`;
      dossier += ` — ${source}, ${engagement} engagement\n\n`;
    }
  }
  dossier += `Evidence: ${cluster?.signal_count || '?'} signals | ${(cluster?.platforms || []).length} platforms | ${cluster?.velocity_7d || '?'} signals/week\n`;
  dossier += `Intensity: ${cluster?.avg_intensity?.toFixed(1) || '?'}/10 | Velocity: ${cluster?.velocity_trend || '?'}\n`;
  dossier += `WTP ratio: ${((cluster?.wtp_ratio || 0) * 100).toFixed(1)}% of signals show willingness to pay\n`;
  dossier += `\n`;

  // Section 2: The Market
  dossier += `2. THE MARKET\n`;
  dossier += `─────────────────────────────────────────────────────────────\n`;
  dossier += `TAM Estimate: ${opp.tam_estimate || 'Not yet estimated'}\n`;
  dossier += `Beachhead: ${opp.beachhead_market || cluster?.title || 'TBD'}\n`;
  dossier += `Pricing Anchor: ${opp.pricing_recommendation ? JSON.stringify(opp.pricing_recommendation) : 'TBD'}\n`;
  dossier += `\n`;

  // Section 3: The Competition
  dossier += `3. THE COMPETITION (${(competitors || []).length} profiled)\n`;
  dossier += `─────────────────────────────────────────────────────────────\n`;
  if (competitors && competitors.length > 0) {
    for (const c of competitors) {
      dossier += `• ${c.name} — ${c.g2_rating || '?'}★ G2 | ${c.monthly_traffic || '?'}/mo traffic | ${c.estimated_mrr || '?'} MRR\n`;
      dossier += `  Pricing: ${JSON.stringify(c.pricing || {})}\n`;
      dossier += `  Complaints: ${(c.top_complaints || []).join(', ') || 'None recorded'}\n`;
      dossier += `  Missing: ${(c.missing_features || []).join(', ') || 'None recorded'}\n`;
      dossier += `  Vulnerability: ${c.vulnerability_assessment || 'Not assessed'}\n\n`;
    }
  } else {
    dossier += `No competitors profiled yet. Run competitor intel agent.\n\n`;
  }
  dossier += `PRIMARY GAP: ${opp.primary_gap || 'Not identified'}\n`;
  dossier += `\n`;

  // Section 4: The Opportunity
  dossier += `4. THE OPPORTUNITY\n`;
  dossier += `─────────────────────────────────────────────────────────────\n`;
  dossier += `Position: ${opp.positioning || 'TBD'}\n`;
  dossier += `Differentiator: ${opp.differentiator || 'TBD'}\n`;
  dossier += `MVP: ${opp.mvp_description || 'TBD'}\n`;
  dossier += `Build time: ~${opp.mvp_build_days || '?'} days\n`;
  dossier += `Distribution: ${(opp.distribution_channels || []).join(', ') || 'TBD'}\n`;
  dossier += `\n`;

  // Section 5: Score Breakdown
  dossier += `5. SCORE BREAKDOWN\n`;
  dossier += `─────────────────────────────────────────────────────────────\n`;
  dossier += `Total:       ${opp.score_total}/100 (Tier ${opp.tier})\n`;
  dossier += `Pain:        ${opp.score_pain}/25\n`;
  dossier += `Velocity:    ${opp.score_velocity}/20\n`;
  dossier += `WTP:         ${opp.score_wtp}/25\n`;
  dossier += `Competition: ${opp.score_competition}/15\n`;
  dossier += `Feasibility: ${opp.score_feasibility}/15\n`;
  dossier += `\n`;

  // Section 6: Score History
  const history = Array.isArray(opp.score_history) ? opp.score_history : [];
  if (history.length > 1) {
    dossier += `6. SCORE HISTORY\n`;
    dossier += `─────────────────────────────────────────────────────────────\n`;
    for (const h of history.slice(-5)) {
      const date = h.date ? new Date(h.date).toISOString().slice(0, 10) : '?';
      dossier += `  ${date}: ${h.total?.toFixed(1)} (base: ${h.base_total?.toFixed(1)}, mod: ${h.strategic_modifier > 0 ? '+' : ''}${h.strategic_modifier}) — ${h.verdict || '?'}\n`;
    }
    dossier += `\n`;
  }

  // Section 7: Verdict
  dossier += `7. VERDICT\n`;
  dossier += `─────────────────────────────────────────────────────────────\n`;
  const latestHistory = history[history.length - 1];
  dossier += `Strategic Verdict: ${latestHistory?.verdict || opp.status}\n`;
  dossier += `Moats: ${latestHistory?.moat_count || '?'} defensible\n`;
  dossier += `Guidelines: ${latestHistory?.guidelines_passed || '?'}/3 passed\n`;
  dossier += `\n`;
  dossier += `NEXT ACTION: ${opp.tier === 'A' ? 'Begin validation immediately. Generate landing page. Allocate $200 ad budget.' : opp.tier === 'B' ? 'Gather more signals. Re-score in 7 days.' : 'Monitor passively.'}\n`;
  dossier += `═══════════════════════════════════════════════════════════════\n`;

  // Save dossier to opportunity
  await sb
    .from('opportunities')
    .update({
      dossier_markdown: dossier,
      dossier_generated_at: now.toISOString(),
    })
    .eq('id', opp.id);

  return dossier;
}

// ─── Main Pipeline ───────────────────────────────────────────

async function runScribe() {
  const startTime = Date.now();
  const args = process.argv.slice(2);

  // Check for dossier mode
  if (args[0] === '--dossier' && args[1]) {
    log('scribe', `═══ Generating dossier for ${args[1]} ═══`);
    const dossier = await generateDossier(args[1]);
    if (dossier) {
      console.log(dossier);
      log('scribe', '✓ Dossier generated and saved to database');
    }
    return;
  }

  // Daily briefing mode
  log('scribe', '═══ Generating daily briefing ═══');

  // 1. Fetch all data
  const data = await fetchBriefingData();

  // 2. Format for console
  const consoleOutput = formatBriefingConsole(data);
  console.log(consoleOutput);

  // 3. Deliver to Slack
  const slackPayload = formatBriefingSlack(data);
  const slackSent = await sendToSlack(slackPayload);
  if (slackSent) {
    await markAlertsDelivered(data.alerts.map(a => a.id), 'slack');
  }

  // 4. Deliver via email
  const emailSent = await sendEmail(consoleOutput);
  if (emailSent) {
    await markAlertsDelivered(data.alerts.map(a => a.id), 'email');
  }

  // 5. Auto-generate dossiers for new Tier A opportunities
  const newTierA = data.newOpps.filter(o => o.tier === 'A');
  for (const opp of newTierA) {
    log('scribe', `  Auto-generating dossier for Tier A: "${opp.title}"`);
    const dossier = await generateDossier(opp.id);
    if (dossier) {
      log('scribe', `  ✓ Dossier saved for "${opp.title}"`);
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  log('scribe', `\n═══ Briefing complete (${duration.toFixed(1)}s) ═══`);
  log('scribe', `  Slack: ${slackSent ? '✓' : '✗'} | Email: ${emailSent ? '✓' : '✗'} | Dossiers: ${newTierA.length}`);
}

// ─── Run ─────────────────────────────────────────────────────

runScribe().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
