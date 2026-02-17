// ============================================================
// SIGNALFORGE — Scorer Agent
//
// The brain. Takes pain clusters with enough signals + competitor
// data and produces scored, strategically evaluated opportunities.
//
// Pipeline:
// 1. Find clusters ready for scoring (≥10 signals + competitors)
// 2. Calculate base 5-dimension score (Pain, Velocity, WTP, Competition, Feasibility)
// 3. Call Claude API for strategic evaluation (moats, loops, guidelines)
// 4. Apply strategic modifier to base score
// 5. Write/update opportunity with final adjusted score + verdict
// 6. Generate alerts for Tier A/B opportunities
//
// Usage: node agents/scorer.js
// ============================================================

import { config, validateConfig, getSupabase, log, logIngestionRun } from '../lib/config.js';
import { evaluateOpportunity } from '../lib/frameworks.js';

validateConfig(['supabase.url', 'supabase.serviceRoleKey', 'anthropic.apiKey']);

// ─── Scoring Configuration ───────────────────────────────────

const SCORING_WEIGHTS = {
  pain:        25,  // max 25 points
  velocity:    20,  // max 20 points
  wtp:         25,  // max 25 points
  competition: 15,  // max 15 points
  feasibility: 15,  // max 15 points
};

// Minimum thresholds for a cluster to be scored
const MIN_SIGNALS = 10;
const MIN_PLATFORMS = 2;
const RESCORE_INTERVAL_DAYS = 7; // don't re-score more often than weekly

// ─── Normalization Helper ────────────────────────────────────

function normalize(value, min, max) {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// ─── Base Score Calculation ──────────────────────────────────
// Five dimensions, each producing a 0-1 normalized score,
// then multiplied by their weight.

function calculateBaseScore(cluster, competitors, trendsData = null) {

  // ── PAIN INTENSITY (25 points) ──
  // How badly do people need this solved?
  const painScore = (
    normalize(cluster.signal_count, 10, 500)     * 0.25 +  // volume
    normalize(cluster.avg_intensity, 1, 10)       * 0.25 +  // how intense
    normalize(cluster.avg_engagement, 10, 1000)   * 0.15 +  // engagement per signal
    normalize(cluster.velocity_7d, 0.5, 20)       * 0.20 +  // signals per week
    normalize(cluster.platform_count, 1, 6)       * 0.15     // cross-platform validation
  ) * SCORING_WEIGHTS.pain;

  // ── MARKET VELOCITY (20 points) ──
  // Is this problem growing or shrinking?
  const velocityTrendMultiplier =
    cluster.velocity_trend === 'accelerating' ? 1.0 :
    cluster.velocity_trend === 'stable' ? 0.5 : 0.1;

  const velocityRatio = cluster.velocity_7d > 0 && cluster.velocity_30d > 0
    ? cluster.velocity_7d / cluster.velocity_30d
    : 0.5;

  const velocityScore = (
    velocityTrendMultiplier * 0.40 +                          // trend direction
    normalize(velocityRatio, 0.5, 3.0) * 0.35 +              // acceleration ratio
    normalize(cluster.signal_count, 10, 500) * 0.25           // overall volume as proxy
  ) * SCORING_WEIGHTS.velocity;

  // ── WILLINGNESS TO PAY (25 points) ──
  // Will they pay, and how much?
  const avgCompetitorPrice = competitors.length > 0
    ? competitors.reduce((sum, c) => {
        const pricing = c.pricing || {};
        const entry = parseFloat((pricing.entry || '0').replace(/[^0-9.]/g, ''));
        return sum + (entry || 0);
      }, 0) / competitors.length
    : 0;

  const wtpScore = (
    normalize(cluster.wtp_ratio, 0, 0.5)              * 0.30 +  // % with WTP language
    normalize(avgCompetitorPrice, 0, 200)              * 0.25 +  // competitor pricing anchor
    normalize(cluster.avg_budget_mentioned || 0, 0, 200) * 0.25 +  // stated budgets
    (cluster.max_budget_mentioned > 0 ? 0.2 : 0)               // bonus: any budget stated
  ) * SCORING_WEIGHTS.wtp;

  // ── COMPETITIVE SATURATION (15 points — inverted) ──
  // Less competition = higher score
  const avgCompRating = competitors.length > 0
    ? competitors.reduce((sum, c) => sum + (c.g2_rating || 3.5), 0) / competitors.length
    : 3.5;

  const totalMissingFeatures = competitors.reduce(
    (sum, c) => sum + (c.missing_features?.length || 0), 0
  );

  const competitionScore = (
    (1 - normalize(competitors.length, 0, 10))         * 0.30 +  // fewer = better
    (1 - normalize(avgCompRating, 1, 5))               * 0.25 +  // lower rated = more vulnerable
    normalize(totalMissingFeatures, 0, 20)             * 0.25 +  // more gaps = more opportunity
    (competitors.some(c =>
      (c.vulnerability_assessment || '').toLowerCase().includes('high')
    ) ? 0.20 : 0)                                                // vulnerable incumbent bonus
  ) * SCORING_WEIGHTS.competition;

  // ── EXECUTION FEASIBILITY (15 points) ──
  // Can a small team build an MVP in <90 days?
  // This is partially estimated from the pain category and partially
  // from competitor complexity signals.
  const categoryFeasibility = {
    'workflow_friction': 0.8,      // usually automatable
    'missing_feature': 0.7,        // depends on feature complexity
    'cost_complaint': 0.9,         // build cheaper version
    'integration_gap': 0.6,        // API work, medium complexity
    'reliability_issue': 0.5,      // infrastructure-heavy
    'complexity_complaint': 0.8,   // simplify = usually feasible
    'support_failure': 0.7,        // service layer, medium
    'scaling_limitation': 0.4,     // hard engineering problems
    'security_concern': 0.3,       // compliance + security = slow
    'onboarding_friction': 0.8,    // UX-focused, usually fast
    'performance_issue': 0.5,      // infrastructure-heavy
    'data_portability': 0.7,       // import/export, medium
    'uncategorized': 0.5,
  };

  const baseFeasibility = categoryFeasibility[cluster.pain_category] || 0.5;

  // If competitors have simple products (low traffic = simple), feasibility goes up
  const avgTraffic = competitors.length > 0
    ? competitors.reduce((sum, c) => sum + (c.monthly_traffic || 0), 0) / competitors.length
    : 10000;

  const feasibilityScore = (
    baseFeasibility * 0.50 +                                     // category-based estimate
    (1 - normalize(avgTraffic, 0, 500000)) * 0.25 +             // simpler products = more feasible
    (competitors.some(c =>
      (c.missing_features || []).length <= 3
    ) ? 0.15 : 0) +                                              // small feature gap = fast MVP
    0.10                                                          // base feasibility floor
  ) * SCORING_WEIGHTS.feasibility;

  const total = painScore + velocityScore + wtpScore + competitionScore + feasibilityScore;

  return {
    total: Math.round(total * 10) / 10,
    pain: Math.round(painScore * 10) / 10,
    velocity: Math.round(velocityScore * 10) / 10,
    wtp: Math.round(wtpScore * 10) / 10,
    competition: Math.round(competitionScore * 10) / 10,
    feasibility: Math.round(feasibilityScore * 10) / 10,
  };
}

// ─── Claude Strategic Evaluation ─────────────────────────────
// For Tier A/B opportunities, get a deeper LLM analysis of
// moats, loops, and competitive positioning.

async function getStrategicEvaluation(cluster, competitors, baseScore) {
  const competitorSummary = competitors.map(c => ({
    name: c.name,
    pricing: c.pricing,
    g2_rating: c.g2_rating,
    monthly_traffic: c.monthly_traffic,
    top_complaints: c.top_complaints,
    missing_features: c.missing_features,
    estimated_mrr: c.estimated_mrr,
    vulnerability: c.vulnerability_assessment,
  }));

  const prompt = `Evaluate this SaaS opportunity for defensibility and growth potential.

## Opportunity
Title: ${cluster.title}
Description: ${cluster.description || 'N/A'}
Pain Category: ${cluster.pain_category}
Signal Count: ${cluster.signal_count} across ${cluster.platform_count} platforms
Average Intensity: ${cluster.avg_intensity}/10
WTP Ratio: ${(cluster.wtp_ratio * 100).toFixed(1)}% of signals show willingness to pay
Velocity: ${cluster.velocity_7d} signals/week (trend: ${cluster.velocity_trend})
Base Score: ${baseScore.total}/100

## Top User Quotes
${(cluster.top_quotes || []).slice(0, 5).map(q =>
  `- "${typeof q === 'string' ? q : q.text}" (${typeof q === 'object' ? q.source : 'unknown'}, ${typeof q === 'object' ? q.engagement : '?'} engagement)`
).join('\n')}

## Competitors (${competitors.length})
${competitorSummary.map(c =>
  `- ${c.name}: ${c.g2_rating || '?'}★ on G2, ${c.monthly_traffic || '?'}/mo traffic, pricing: ${JSON.stringify(c.pricing || {})}, complaints: ${(c.top_complaints || []).join('; ')}, missing: ${(c.missing_features || []).join('; ')}`
).join('\n')}

## Evaluate

### 1. MOAT ANALYSIS (score each 0-10)
A. COUNTER-POSITIONING: If the top competitor copies my approach, does it cannibalize their revenue?
B. STICKY HABITS: After 90 days of use, what does a user lose by leaving?
C. PROPRIETARY DATA: Does usage generate data that improves the product?

### 2. FEEDBACK LOOPS (score each 0-10)
A. BALANCE: Is there a clear advantage aligned with acute pain?
B. SPEED TO REVENUE: Can MVP ship in <30 days?
C. SIGNAL TO INNOVATION: Does user behavior drive product improvement?

### 3. COMPETITIVE GUIDELINES (pass/fail)
A. PROVEN MODEL: At least 1 competitor generates revenue?
B. MAX 4 COMPETITORS: 4 or fewer established players?
C. MVP FROM COMPLAINTS: Can MVP features come from competitor complaints?

Return ONLY valid JSON:
{
  "moats": {
    "counter_positioning": {"score": 0, "reasoning": "..."},
    "sticky_habits": {"score": 0, "reasoning": "..."},
    "proprietary_data": {"score": 0, "reasoning": "..."}
  },
  "feedback_loops": {
    "balance": {"score": 0, "reasoning": "..."},
    "speed_to_revenue": {"score": 0, "reasoning": "..."},
    "signal_to_innovation": {"score": 0, "reasoning": "..."}
  },
  "guidelines": {
    "proven_model": {"passed": true, "evidence": "..."},
    "max_competitors": {"passed": true, "count": 0},
    "mvp_from_complaints": {"top_features": ["..."], "reasoning": "..."}
  },
  "strategic_verdict": "GO or INVESTIGATE or WATCH or KILL",
  "reasoning": "2-3 sentences",
  "biggest_risk": "single biggest reason this could fail",
  "suggested_mvp": "one-sentence MVP description",
  "estimated_mvp_days": 30,
  "suggested_pricing": {"entry": "$X/mo", "mid": "$Y/mo", "pro": "$Z/mo"},
  "distribution_channels": ["channel1", "channel2"]
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.anthropic.model,
        max_tokens: 2000,
        system: 'You are a ruthless startup strategist. Evaluate SaaS opportunities for defensibility, growth potential, and execution feasibility. Be opinionated. Return ONLY valid JSON, no explanation, no markdown, no backticks.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);

  } catch (err) {
    log('scorer', `Strategic evaluation failed: ${err.message}`);
    return null;
  }
}

// ─── Calculate Strategic Modifier ────────────────────────────
// Takes the LLM strategic evaluation and computes a score modifier

function calculateStrategicModifier(stratEval) {
  if (!stratEval) return { modifier: 0, verdict: 'INSUFFICIENT DATA' };

  // Moat modifier: avg of 3 moat scores, normalized to -3 to +7
  const moatScores = [
    stratEval.moats?.counter_positioning?.score || 0,
    stratEval.moats?.sticky_habits?.score || 0,
    stratEval.moats?.proprietary_data?.score || 0,
  ];
  const avgMoat = moatScores.reduce((a, b) => a + b, 0) / 3;
  const moatModifier = (avgMoat / 10 - 0.3) * 10;  // maps 0-10 to -3 to +7

  // Loop modifier: avg of 3 loop scores, normalized to -3 to +7
  const loopScores = [
    stratEval.feedback_loops?.balance?.score || 0,
    stratEval.feedback_loops?.speed_to_revenue?.score || 0,
    stratEval.feedback_loops?.signal_to_innovation?.score || 0,
  ];
  const avgLoop = loopScores.reduce((a, b) => a + b, 0) / 3;
  const loopModifier = (avgLoop / 10 - 0.3) * 10;

  // Guideline modifier: -10 if guidelines fail, 0 otherwise
  const guidelinesPassed = [
    stratEval.guidelines?.proven_model?.passed,
    stratEval.guidelines?.max_competitors?.passed,
    stratEval.guidelines?.mvp_from_complaints?.top_features?.length >= 2,
  ].filter(Boolean).length;
  const guidelineModifier = guidelinesPassed >= 2 ? 0 : -10;

  const totalModifier = Math.round((moatModifier + loopModifier + guidelineModifier) * 10) / 10;

  // Count real moats (score >= 5)
  const moatCount = moatScores.filter(s => s >= 5).length;

  return {
    modifier: totalModifier,
    moat_modifier: Math.round(moatModifier * 10) / 10,
    loop_modifier: Math.round(loopModifier * 10) / 10,
    guideline_modifier: guidelineModifier,
    moat_count: moatCount,
    guidelines_passed: guidelinesPassed,
    verdict: stratEval.strategic_verdict || 'UNKNOWN',
  };
}

// ─── Determine Tier ──────────────────────────────────────────

function getTier(score) {
  if (score >= config.thresholds.tierA) return 'A';
  if (score >= config.thresholds.tierB) return 'B';
  if (score >= config.thresholds.tierC) return 'C';
  return 'D';
}

// ─── Write Opportunity to Database ───────────────────────────

async function upsertOpportunity(cluster, competitors, baseScore, stratEval, strategicMod) {
  const sb = getSupabase();
  const adjustedScore = Math.max(0, Math.min(100, baseScore.total + strategicMod.modifier));
  const tier = getTier(adjustedScore);

  // Build the opportunity record
  const opportunity = {
    cluster_id: cluster.id,
    title: cluster.title,
    description: cluster.description || `Pain cluster: ${cluster.pain_category}`,

    // Base scores
    score_total: adjustedScore,
    score_pain: baseScore.pain,
    score_velocity: baseScore.velocity,
    score_wtp: baseScore.wtp,
    score_competition: baseScore.competition,
    score_feasibility: baseScore.feasibility,
    tier: tier,
    status: 'scored',

    // Market sizing
    tam_estimate: stratEval?.tam_estimate || null,
    positioning: stratEval?.suggested_mvp || null,

    // Competitor summary
    competitor_count: competitors.length,
    strongest_competitor: competitors.sort((a, b) =>
      (b.monthly_traffic || 0) - (a.monthly_traffic || 0)
    )[0]?.name || null,
    weakest_competitor: competitors.sort((a, b) =>
      (a.g2_rating || 5) - (b.g2_rating || 5)
    )[0]?.name || null,
    primary_gap: stratEval?.guidelines?.mvp_from_complaints?.top_features?.[0] || null,

    // Strategic evaluation results
    mvp_description: stratEval?.suggested_mvp || null,
    mvp_build_days: stratEval?.estimated_mvp_days || null,
    pricing_recommendation: stratEval?.suggested_pricing || null,
    distribution_channels: stratEval?.distribution_channels || [],
    differentiator: stratEval?.reasoning || null,

    // Score history entry
    score_history: [{
      date: new Date().toISOString(),
      total: adjustedScore,
      base_total: baseScore.total,
      strategic_modifier: strategicMod.modifier,
      pain: baseScore.pain,
      velocity: baseScore.velocity,
      wtp: baseScore.wtp,
      competition: baseScore.competition,
      feasibility: baseScore.feasibility,
      moat_count: strategicMod.moat_count,
      guidelines_passed: strategicMod.guidelines_passed,
      verdict: strategicMod.verdict,
    }],
  };

  // Check if opportunity already exists for this cluster
  const { data: existing } = await sb
    .from('opportunities')
    .select('id, score_total, score_history, status')
    .eq('cluster_id', cluster.id)
    .not('status', 'in', '("killed","launched")')
    .limit(1)
    .single();

  if (existing) {
    // Update existing — append to score history
    const history = Array.isArray(existing.score_history) ? existing.score_history : [];
    history.push(opportunity.score_history[0]);

    const { error } = await sb
      .from('opportunities')
      .update({
        ...opportunity,
        score_history: history,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) {
      log('scorer', `Failed to update opportunity: ${error.message}`);
      return null;
    }

    log('scorer', `  Updated: "${cluster.title}" — ${existing.score_total} → ${adjustedScore} (${tier})`);
    return { id: existing.id, action: 'updated', previousScore: existing.score_total };

  } else {
    // Insert new opportunity
    const { data: created, error } = await sb
      .from('opportunities')
      .insert(opportunity)
      .select('id')
      .single();

    if (error) {
      log('scorer', `Failed to create opportunity: ${error.message}`);
      return null;
    }

    log('scorer', `  Created: "${cluster.title}" — Score: ${adjustedScore} (${tier})`);

    // Generate alert for new Tier A/B opportunities
    if (tier === 'A' || tier === 'B') {
      await sb.from('alerts').insert({
        opportunity_id: created.id,
        cluster_id: cluster.id,
        alert_type: 'new_opportunity',
        severity: tier === 'A' ? 'critical' : 'warning',
        title: `New Tier ${tier}: ${cluster.title}`,
        message: `Score: ${adjustedScore}/100 | ${cluster.signal_count} signals across ${cluster.platform_count} platforms | Verdict: ${strategicMod.verdict}`,
        metadata: {
          score: adjustedScore,
          base_score: baseScore.total,
          strategic_modifier: strategicMod.modifier,
          moat_count: strategicMod.moat_count,
          verdict: strategicMod.verdict,
          biggest_risk: stratEval?.biggest_risk || 'Unknown',
        },
      });
    }

    return { id: created.id, action: 'created' };
  }
}

// ─── Main Scoring Pipeline ───────────────────────────────────

async function runScorer() {
  const startTime = Date.now();
  log('scorer', '═══ Starting scoring pipeline ═══');

  const sb = getSupabase();

  // 1. Find clusters ready for scoring
  //    Criteria: ≥ MIN_SIGNALS signals, ≥ MIN_PLATFORMS platforms,
  //    and either no existing opportunity or last scored > RESCORE_INTERVAL_DAYS ago
  const { data: clusters, error: clusterError } = await sb
    .from('pain_clusters')
    .select('*')
    .gte('signal_count', MIN_SIGNALS)
    .gte('platform_count', MIN_PLATFORMS)
    .order('velocity_7d', { ascending: false });

  if (clusterError) {
    log('scorer', `Failed to fetch clusters: ${clusterError.message}`);
    return;
  }

  if (!clusters || clusters.length === 0) {
    log('scorer', 'No clusters ready for scoring (need ≥10 signals across ≥2 platforms).');
    return;
  }

  log('scorer', `Found ${clusters.length} clusters ready for scoring`);

  let scored = 0;
  let skipped = 0;
  let errors = 0;

  for (const cluster of clusters) {
    try {
      // Check if recently scored
      const { data: existingOpp } = await sb
        .from('opportunities')
        .select('id, updated_at, status')
        .eq('cluster_id', cluster.id)
        .not('status', 'in', '("killed","launched")')
        .limit(1)
        .single();

      if (existingOpp) {
        const daysSinceScored = (Date.now() - new Date(existingOpp.updated_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceScored < RESCORE_INTERVAL_DAYS) {
          log('scorer', `  Skipping "${cluster.title}" — scored ${daysSinceScored.toFixed(1)} days ago`);
          skipped++;
          continue;
        }
      }

      log('scorer', `\n  Scoring: "${cluster.title}" (${cluster.signal_count} signals, ${cluster.platform_count} platforms)`);

      // 2. Fetch competitors for this cluster
      const { data: competitors } = await sb
        .from('competitors')
        .select('*')
        .eq('cluster_id', cluster.id);

      const comps = competitors || [];
      log('scorer', `    Competitors: ${comps.length} found`);

      // 3. Calculate base 5-dimension score
      const baseScore = calculateBaseScore(cluster, comps);
      log('scorer', `    Base score: ${baseScore.total}/100 (P:${baseScore.pain} V:${baseScore.velocity} W:${baseScore.wtp} C:${baseScore.competition} F:${baseScore.feasibility})`);

      // 4. Strategic evaluation via Claude (only for promising opportunities)
      let stratEval = null;
      let strategicMod = { modifier: 0, moat_count: 0, guidelines_passed: 0, verdict: 'NOT_EVALUATED' };

      if (baseScore.total >= config.thresholds.tierC) {
        log('scorer', `    Running strategic evaluation (base score ≥ ${config.thresholds.tierC})...`);
        stratEval = await getStrategicEvaluation(cluster, comps, baseScore);

        if (stratEval) {
          strategicMod = calculateStrategicModifier(stratEval);
          log('scorer', `    Strategic modifier: ${strategicMod.modifier > 0 ? '+' : ''}${strategicMod.modifier} (moats: ${strategicMod.moat_count}, guidelines: ${strategicMod.guidelines_passed}/3, verdict: ${strategicMod.verdict})`);
        } else {
          log('scorer', `    Strategic evaluation failed — using base score only`);
        }
      } else {
        log('scorer', `    Skipping strategic evaluation (base score ${baseScore.total} < ${config.thresholds.tierC})`);
      }

      // 5. Also run the local frameworks evaluation
      const localEval = evaluateOpportunity({
        ...cluster,
        competitors: comps,
        score_total: baseScore.total,
        description: cluster.description || cluster.title,
        mvp_description: stratEval?.suggested_mvp || '',
        mvp_build_days: stratEval?.estimated_mvp_days || 60,
      });

      // Log local framework results
      log('scorer', `    Local frameworks: moats=${localEval.moat_analysis.summary.moat_count}, verdict="${localEval.strategic_verdict}"`);

      // 6. Write to database
      const result = await upsertOpportunity(cluster, comps, baseScore, stratEval, strategicMod);
      if (result) {
        scored++;
      } else {
        errors++;
      }

      // Rate limit between clusters (Claude API calls)
      if (stratEval) {
        await new Promise(r => setTimeout(r, 1000));
      }

    } catch (err) {
      log('scorer', `  ERROR scoring "${cluster.title}": ${err.message}`);
      errors++;
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  log('scorer', `\n═══ Scoring complete ═══`);
  log('scorer', `  Scored: ${scored} | Skipped: ${skipped} | Errors: ${errors} | Time: ${duration.toFixed(1)}s`);

  // Log the run
  await logIngestionRun('scorer', null, {
    found: clusters.length,
    new: scored,
    noise: skipped,
    status: errors > 0 ? 'completed_with_errors' : 'completed',
    durationSeconds: duration,
    errors: [],
  });

  // Print summary of top opportunities
  const { data: topOpps } = await sb
    .from('opportunities')
    .select('title, score_total, tier, status')
    .not('status', 'in', '("killed")')
    .order('score_total', { ascending: false })
    .limit(10);

  if (topOpps && topOpps.length > 0) {
    log('scorer', `\n  ┌─────────────────────────────────────────────────┐`);
    log('scorer', `  │           TOP OPPORTUNITIES                     │`);
    log('scorer', `  ├─────────────────────────────────────────────────┤`);
    for (const opp of topOpps) {
      const icon = opp.tier === 'A' ? '🔥' : opp.tier === 'B' ? '⚡' : opp.tier === 'C' ? '📊' : '  ';
      log('scorer', `  │ ${icon} ${opp.score_total.toFixed(1).padStart(5)} │ [${opp.tier}] ${opp.title.slice(0, 35).padEnd(35)} │`);
    }
    log('scorer', `  └─────────────────────────────────────────────────┘`);
  }
}

// ─── Run ─────────────────────────────────────────────────────

runScorer().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
