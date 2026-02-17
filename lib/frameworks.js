// ============================================================
// SIGNALFORGE — Strategic Evaluation Frameworks
//
// Three integrated systems:
// 1. MOAT ANALYSIS — Can I defend this business once I build it?
// 2. FEEDBACK LOOPS — Does the business model compound over time?
// 3. COMPETITIVE GUIDELINES — Should I even enter this market?
//
// Every Tier A/B opportunity runs through these before reaching
// the daily briefing. An opportunity can score 90/100 on pain
// but if it fails the moat check, it gets downgraded.
// ============================================================

// ─── MOAT FRAMEWORK ─────────────────────────────────────────
//
// Three moats that matter. You need at least ONE to proceed.
// Zero moats = commodity product = race to the bottom = kill it.
//
// MOAT 1: COUNTER-POSITIONING
//   Attack the competitor's core business model, not their features.
//   Netflix vs Blockbuster: Blockbuster couldn't match Netflix without
//   destroying their own late-fee revenue model.
//   Question: "If the incumbent copies me, does it hurt their existing business?"
//
// MOAT 2: STICKY HABITS / HIGH SWITCHING COST
//   Make leaving painful. Users store data, build workflows, form habits.
//   Google, ChatGPT, Notion — the more you use them, the harder it is to leave.
//   Question: "After 90 days of use, what would a user lose by switching away?"
//
// MOAT 3: PROPRIETARY DATA & LEARNING LOOPS
//   Every user interaction makes the product smarter. Cursor tracks keystrokes
//   to improve code suggestions. Tesla uses driving data to improve autopilot.
//   Question: "Does usage generate data that makes the product better for everyone?"
//

export function evaluateMoats(opportunity) {
  const moats = {
    counter_positioning: {
      score: 0,        // 0-10
      signal: '',
      question: 'If the top competitor copies my approach, does it cannibalize their existing revenue model?',
      examples: [],
    },
    sticky_habits: {
      score: 0,        // 0-10
      signal: '',
      question: 'After 90 days of use, what would a user lose by switching away?',
      examples: [],
    },
    proprietary_data: {
      score: 0,        // 0-10
      signal: '',
      question: 'Does each user interaction generate data that improves the product for all users?',
      examples: [],
    },
  };

  // ── Counter-Positioning Signals ──
  // Look for: incumbents with business model conflicts
  const counterSignals = [];

  if (opportunity.competitors) {
    for (const comp of opportunity.competitors) {
      // Competitor charges per-seat but pain is about automation (fewer seats needed)
      // Competitor revenue depends on manual process that your product eliminates
      // Competitor has enterprise pricing but pain is from SMBs who can't afford it
      const complaints = comp.top_complaints || [];
      const pricing = comp.pricing || {};

      // Check if competitor's pricing model conflicts with solving the pain
      if (complaints.some(c =>
        c.toLowerCase().includes('expensive') ||
        c.toLowerCase().includes('pricing') ||
        c.toLowerCase().includes('per seat') ||
        c.toLowerCase().includes('enterprise only')
      )) {
        counterSignals.push(`${comp.name}: pricing model creates opening for simpler/cheaper approach`);
      }

      // Check if competitor is locked into legacy architecture
      if (complaints.some(c =>
        c.toLowerCase().includes('outdated') ||
        c.toLowerCase().includes('legacy') ||
        c.toLowerCase().includes('slow to update') ||
        c.toLowerCase().includes('no api')
      )) {
        counterSignals.push(`${comp.name}: legacy architecture prevents them from rebuilding`);
      }
    }
  }

  moats.counter_positioning.examples = counterSignals;
  moats.counter_positioning.score = Math.min(10, counterSignals.length * 3);
  moats.counter_positioning.signal = counterSignals.length > 0
    ? 'Competitors have structural weaknesses that prevent them from copying your approach'
    : 'No clear counter-positioning angle detected — competitors can copy freely';

  // ── Sticky Habits / Switching Cost Signals ──
  const stickySignals = [];
  const painCategory = opportunity.pain_category || '';
  const description = (opportunity.description || '').toLowerCase();
  const mvpDescription = (opportunity.mvp_description || '').toLowerCase();

  // Data storage = switching cost
  if (description.includes('data') || description.includes('history') ||
      description.includes('records') || description.includes('database') ||
      mvpDescription.includes('import') || mvpDescription.includes('store')) {
    stickySignals.push('Users store data in the product — creates migration cost');
  }

  // Workflow integration = switching cost
  if (painCategory === 'integration_gap' || description.includes('workflow') ||
      description.includes('automat') || mvpDescription.includes('integrat')) {
    stickySignals.push('Product embeds into existing workflows — disruption cost to switch');
  }

  // Team/collaboration features = switching cost
  if (description.includes('team') || description.includes('collaborat') ||
      description.includes('share') || description.includes('multi-user')) {
    stickySignals.push('Multi-user product — requires team-wide migration to switch');
  }

  // Habit-forming daily use
  if (description.includes('daily') || description.includes('every day') ||
      description.includes('routine') || description.includes('monitor')) {
    stickySignals.push('Daily-use product — habit formation increases switching cost');
  }

  moats.sticky_habits.examples = stickySignals;
  moats.sticky_habits.score = Math.min(10, stickySignals.length * 2.5);
  moats.sticky_habits.signal = stickySignals.length >= 2
    ? 'Multiple switching cost vectors — users will stick once onboarded'
    : stickySignals.length === 1
      ? 'Some switching cost — but may need to engineer more stickiness into MVP'
      : 'Low switching cost — users can easily replace this. Dangerous.';

  // ── Proprietary Data & Learning Loops ──
  const dataSignals = [];

  // Does usage generate valuable data?
  if (description.includes('track') || description.includes('analytic') ||
      description.includes('pattern') || description.includes('predict') ||
      description.includes('recommend') || description.includes('learn')) {
    dataSignals.push('Product can learn from usage patterns to improve recommendations');
  }

  // Network effects
  if (description.includes('marketplace') || description.includes('community') ||
      description.includes('network') || description.includes('platform')) {
    dataSignals.push('Network effects — more users = more value for each user');
  }

  // Aggregated insights
  if (description.includes('benchmark') || description.includes('industry') ||
      description.includes('aggregate') || description.includes('compare')) {
    dataSignals.push('Aggregated user data creates benchmarks competitors cannot replicate');
  }

  // Can you get proprietary data through partnerships?
  if (description.includes('api') || description.includes('partner') ||
      description.includes('exclusive') || description.includes('first-party')) {
    dataSignals.push('Potential for proprietary data via partnerships or API integrations');
  }

  moats.proprietary_data.examples = dataSignals;
  moats.proprietary_data.score = Math.min(10, dataSignals.length * 3);
  moats.proprietary_data.signal = dataSignals.length >= 2
    ? 'Strong data flywheel potential — usage makes the product smarter over time'
    : dataSignals.length === 1
      ? 'Some data advantage possible — design the MVP to capture learning loops'
      : 'No clear data moat — consider how to engineer one before building';

  // ── Overall Moat Assessment ──
  const moatScores = [
    moats.counter_positioning.score,
    moats.sticky_habits.score,
    moats.proprietary_data.score,
  ];
  const maxMoat = Math.max(...moatScores);
  const totalMoatScore = moatScores.reduce((a, b) => a + b, 0);
  const moatCount = moatScores.filter(s => s >= 4).length;

  return {
    moats,
    summary: {
      total_score: totalMoatScore,           // 0-30
      normalized_score: totalMoatScore / 30,  // 0-1 for use in scoring
      moat_count: moatCount,                  // how many moats score >= 4
      strongest_moat: moatScores.indexOf(maxMoat) === 0
        ? 'counter_positioning'
        : moatScores.indexOf(maxMoat) === 1
          ? 'sticky_habits'
          : 'proprietary_data',
      verdict: moatCount >= 2 ? 'STRONG — Multiple defensible moats'
        : moatCount === 1 ? 'MODERATE — One moat, engineer more before scaling'
        : 'WEAK — No clear moat. High risk of commoditization. Consider killing.',
      proceed: moatCount >= 1,  // need at least one moat to proceed
    },
  };
}


// ─── FEEDBACK LOOP FRAMEWORK ─────────────────────────────────
//
// Four loops from the AI Wealth Creation framework.
// These assess whether the BUSINESS MODEL compounds over time.
//
// LOOP 1: BALANCE LOOP
//   Does this opportunity sit at the intersection of MY asymmetric
//   advantage and REAL customer pain? If I don't have an edge here,
//   someone smarter will outexecute me.
//
// LOOP 2: SPEED TO REVENUE LOOP
//   Can I ship an MVP in <30 days and start charging? The faster I
//   ship, the faster I learn, the faster I compound.
//
// LOOP 3: SIGNAL TO INNOVATION LOOP
//   Does user behavior in this product generate signals I can use
//   to improve the product? YouTube's recommendation engine is the
//   ultimate example. Quibi's fixed vision is the anti-example.
//
// LOOP 4: SWEAT EQUITY LOOP
//   Am I willing to obsess over this for 12-18 months? If not,
//   the idea isn't worth pursuing regardless of the score.
//

export function evaluateFeedbackLoops(opportunity, founderContext = {}) {
  const loops = {};

  // ── Loop 1: Balance Loop ──
  // Asymmetric advantage × Acute customer pain
  const hasFounderAdvantage = founderContext.advantages?.length > 0;
  const painIntensity = opportunity.avg_intensity || 0;
  const hasExplicitWTP = (opportunity.wtp_ratio || 0) > 0.1;

  loops.balance = {
    name: 'Balance Loop',
    description: 'Asymmetric advantage aligned with acute customer pain',
    score: 0,
    assessment: '',
    action_items: [],
  };

  if (hasFounderAdvantage && painIntensity >= 7 && hasExplicitWTP) {
    loops.balance.score = 10;
    loops.balance.assessment = 'Strong alignment between your advantage and validated pain with WTP';
  } else if (painIntensity >= 7 && hasExplicitWTP) {
    loops.balance.score = 6;
    loops.balance.assessment = 'Strong pain + WTP but no clear founder advantage yet';
    loops.balance.action_items.push('Define your asymmetric advantage for this space');
    loops.balance.action_items.push('Ask: What do I know about this problem that others do not?');
  } else if (painIntensity >= 5) {
    loops.balance.score = 4;
    loops.balance.assessment = 'Moderate pain detected — validate WTP before proceeding';
    loops.balance.action_items.push('Test willingness to pay with landing page or survey');
  } else {
    loops.balance.score = 2;
    loops.balance.assessment = 'Weak pain signal — this may not be worth pursuing';
    loops.balance.action_items.push('Gather more evidence before investing time');
  }

  // ── Loop 2: Speed to Revenue Loop ──
  // Can you ship and charge in <30 days?
  const mvpDays = opportunity.mvp_build_days || 999;
  const hasCompetitorPricing = opportunity.competitors?.some(c => c.pricing);

  loops.speed_to_revenue = {
    name: 'Speed to Revenue Loop',
    description: 'Ship fast, learn fast, charge fast',
    score: 0,
    assessment: '',
    action_items: [],
  };

  if (mvpDays <= 30) {
    loops.speed_to_revenue.score = 10;
    loops.speed_to_revenue.assessment = `MVP in ${mvpDays} days — you can be charging within a month`;
  } else if (mvpDays <= 60) {
    loops.speed_to_revenue.score = 7;
    loops.speed_to_revenue.assessment = `MVP in ${mvpDays} days — aggressive but doable`;
    loops.speed_to_revenue.action_items.push('Cut scope. What is the smallest version users will pay for?');
  } else if (mvpDays <= 90) {
    loops.speed_to_revenue.score = 4;
    loops.speed_to_revenue.assessment = `MVP in ${mvpDays} days — slow. Risk of being outpaced.`;
    loops.speed_to_revenue.action_items.push('Reduce to 30-day MVP. Ship a manual-behind-the-scenes version first.');
  } else {
    loops.speed_to_revenue.score = 1;
    loops.speed_to_revenue.assessment = 'Too complex for fast iteration. Consider a simpler wedge.';
    loops.speed_to_revenue.action_items.push('Find a smaller sub-problem you can solve in 2 weeks');
  }

  if (hasCompetitorPricing) {
    loops.speed_to_revenue.action_items.push('Pricing validated by competitors — match or undercut on Day 1');
  }

  // ── Loop 3: Signal to Innovation Loop ──
  // Does user behavior feed back into product improvement?
  const hasDataLoop = opportunity.moat_assessment?.moats?.proprietary_data?.score >= 4;

  loops.signal_to_innovation = {
    name: 'Signal to Innovation Loop',
    description: 'User behavior drives continuous product improvement',
    score: 0,
    assessment: '',
    action_items: [],
  };

  if (hasDataLoop) {
    loops.signal_to_innovation.score = 9;
    loops.signal_to_innovation.assessment = 'Built-in signal loop — usage data improves the product';
  } else {
    // Check if we can ENGINEER a signal loop
    const canTrackUsage = (opportunity.description || '').toLowerCase().match(
      /dashboard|analytic|report|track|monitor|usage|metric/
    );

    if (canTrackUsage) {
      loops.signal_to_innovation.score = 6;
      loops.signal_to_innovation.assessment = 'Signal loop possible — design analytics/tracking into MVP';
      loops.signal_to_innovation.action_items.push('Add usage tracking from Day 1');
      loops.signal_to_innovation.action_items.push('Build a feedback mechanism: thumbs up/down, feature requests, NPS');
    } else {
      loops.signal_to_innovation.score = 3;
      loops.signal_to_innovation.assessment = 'Weak signal loop — you will be guessing what to build next';
      loops.signal_to_innovation.action_items.push('Engineer a data collection mechanism into the product');
      loops.signal_to_innovation.action_items.push('At minimum: track feature usage, session length, drop-off points');
    }
  }

  // ── Loop 4: Sweat Equity Loop ──
  // This is a founder-facing question, not a data question
  loops.sweat_equity = {
    name: 'Sweat Equity Loop',
    description: 'Founder persistence and deep involvement',
    score: null,  // Cannot be auto-scored — requires founder input
    assessment: 'MANUAL CHECK REQUIRED',
    action_items: [
      'Ask yourself: Am I willing to obsess over this for 12-18 months?',
      'Ask yourself: Would I use this product myself?',
      'Ask yourself: Can I stay motivated when growth stalls at month 6?',
      'If any answer is "no" — kill the idea regardless of the score.',
    ],
  };

  // ── Overall Loop Assessment ──
  const scorableLoops = [loops.balance, loops.speed_to_revenue, loops.signal_to_innovation];
  const avgLoopScore = scorableLoops.reduce((a, l) => a + l.score, 0) / scorableLoops.length;

  return {
    loops,
    summary: {
      avg_score: Math.round(avgLoopScore * 10) / 10,
      normalized_score: avgLoopScore / 10,  // 0-1 for use in scoring
      strongest_loop: scorableLoops.reduce((a, b) => a.score > b.score ? a : b).name,
      weakest_loop: scorableLoops.reduce((a, b) => a.score < b.score ? a : b).name,
      all_action_items: [
        ...loops.balance.action_items,
        ...loops.speed_to_revenue.action_items,
        ...loops.signal_to_innovation.action_items,
        ...loops.sweat_equity.action_items,
      ],
    },
  };
}


// ─── COMPETITIVE GUIDELINES ──────────────────────────────────
//
// Three hard rules. Violate any one = kill or deprioritize.
//
// RULE 1: PROVEN MODEL
//   The idea must have been done before by at least 1 competitor
//   that generates revenue. We don't pioneer markets. We improve them.
//
// RULE 2: MAX 4 COMPETITORS
//   If there are 5+ funded/established competitors, the market is
//   saturated. Find a different angle or a different market.
//
// RULE 3: MVP FROM COMPETITOR INTELLIGENCE
//   Your MVP feature set comes from what competitor users want most
//   (from their complaints). Build THEIR users' wish list, not yours.
//

export function evaluateCompetitiveGuidelines(opportunity) {
  const guidelines = {};
  const competitors = opportunity.competitors || [];

  // ── Rule 1: Proven Model ──
  const hasRevenueCompetitor = competitors.some(c =>
    c.estimated_mrr && c.estimated_mrr !== '$0' && c.estimated_mrr !== 'unknown'
  );
  const hasPayingCustomers = competitors.some(c =>
    (c.g2_review_count || 0) > 10 || (c.monthly_traffic || 0) > 5000
  );

  guidelines.proven_model = {
    rule: 'Idea must have at least 1 revenue-generating competitor',
    passed: hasRevenueCompetitor || hasPayingCustomers,
    evidence: hasRevenueCompetitor
      ? `${competitors.filter(c => c.estimated_mrr).map(c => `${c.name}: ${c.estimated_mrr}`).join(', ')}`
      : hasPayingCustomers
        ? 'Competitors have significant traffic/reviews indicating revenue'
        : 'NO revenue-generating competitor found — unproven market',
    verdict: (hasRevenueCompetitor || hasPayingCustomers)
      ? '✓ PASS — Market is proven. Someone is already making money here.'
      : '✗ FAIL — No evidence anyone pays for this. Too risky to pioneer.',
  };

  // ── Rule 2: Max 4 Competitors ──
  const competitorCount = competitors.length;
  // Only count "real" competitors (with traffic or reviews)
  const realCompetitors = competitors.filter(c =>
    (c.monthly_traffic || 0) > 1000 || (c.g2_review_count || 0) > 5
  );

  guidelines.max_competitors = {
    rule: 'No more than 4 established competitors in the space',
    passed: realCompetitors.length <= 4,
    count: realCompetitors.length,
    names: realCompetitors.map(c => c.name),
    verdict: realCompetitors.length <= 4
      ? `✓ PASS — ${realCompetitors.length} real competitors. Room to compete.`
      : `✗ FAIL — ${realCompetitors.length} established competitors. Market is saturated. Find a niche or move on.`,
  };

  // ── Rule 3: MVP from Competitor Intelligence ──
  // Extract the most common complaints and missing features across all competitors
  const allComplaints = competitors.flatMap(c => c.top_complaints || []);
  const allMissing = competitors.flatMap(c => c.missing_features || []);

  // Count frequency of each complaint/feature
  const complaintFreq = {};
  allComplaints.forEach(c => {
    const normalized = c.toLowerCase().trim();
    complaintFreq[normalized] = (complaintFreq[normalized] || 0) + 1;
  });

  const missingFreq = {};
  allMissing.forEach(f => {
    const normalized = f.toLowerCase().trim();
    missingFreq[normalized] = (missingFreq[normalized] || 0) + 1;
  });

  // Sort by frequency
  const topComplaints = Object.entries(complaintFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([complaint, count]) => ({ complaint, mentioned_by: count }));

  const topMissing = Object.entries(missingFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([feature, count]) => ({ feature, requested_by: count }));

  guidelines.mvp_from_competitors = {
    rule: 'MVP feature set derived from competitor user complaints',
    top_complaints: topComplaints,
    top_missing_features: topMissing,
    suggested_mvp_features: [
      ...topMissing.slice(0, 3).map(f => f.feature),
      ...topComplaints.slice(0, 2).map(c => `Fix: ${c.complaint}`),
    ],
    verdict: topComplaints.length >= 2
      ? `✓ ACTIONABLE — ${topComplaints.length} recurring complaints identified. Build their users' wish list.`
      : 'ℹ INSUFFICIENT DATA — Need more competitor reviews to define MVP. Gather more intel.',
  };

  // ── Overall Guidelines Assessment ──
  const rulesPassed = [
    guidelines.proven_model.passed,
    guidelines.max_competitors.passed,
    guidelines.mvp_from_competitors.top_complaints.length >= 2,
  ].filter(Boolean).length;

  return {
    guidelines,
    summary: {
      rules_passed: rulesPassed,
      rules_total: 3,
      proceed: rulesPassed >= 2,  // Must pass at least 2 of 3
      verdict: rulesPassed === 3
        ? 'ALL CLEAR — Proven market, low competition, clear MVP path.'
        : rulesPassed === 2
          ? 'PROCEED WITH CAUTION — One guideline failed. Address before scaling.'
          : rulesPassed === 1
            ? 'HIGH RISK — Multiple guidelines failed. Reconsider this opportunity.'
            : 'KILL — Market is either unproven, saturated, or unclear. Move on.',
    },
  };
}


// ─── MASTER EVALUATION ───────────────────────────────────────
// Runs all three frameworks on an opportunity and produces
// a single strategic verdict.

export function evaluateOpportunity(opportunity, founderContext = {}) {
  const moatAnalysis = evaluateMoats(opportunity);
  const loopAnalysis = evaluateFeedbackLoops(opportunity, founderContext);
  const guidelineAnalysis = evaluateCompetitiveGuidelines(opportunity);

  // Strategic score modifier (applied on top of the base 0-100 score)
  // This can boost or penalize the opportunity score by up to ±15 points
  const moatModifier = (moatAnalysis.summary.normalized_score - 0.3) * 10;      // -3 to +7
  const loopModifier = (loopAnalysis.summary.normalized_score - 0.3) * 10;      // -3 to +7
  const guidelineModifier = guidelineAnalysis.summary.proceed ? 0 : -10;        // 0 or -10

  const totalModifier = Math.round((moatModifier + loopModifier + guidelineModifier) * 10) / 10;

  const baseScore = opportunity.score_total || 0;
  const adjustedScore = Math.max(0, Math.min(100, baseScore + totalModifier));

  // Final strategic verdict
  let strategicVerdict;
  if (adjustedScore >= 75 && moatAnalysis.summary.moat_count >= 1 && guidelineAnalysis.summary.proceed) {
    strategicVerdict = 'GO — Strong opportunity with defensible position. Begin validation.';
  } else if (adjustedScore >= 60 && guidelineAnalysis.summary.proceed) {
    strategicVerdict = 'INVESTIGATE — Promising but needs stronger moats. Proceed to validation with caution.';
  } else if (adjustedScore >= 50) {
    strategicVerdict = 'WATCH — Monitor for signal changes. Not ready for investment yet.';
  } else {
    strategicVerdict = 'KILL — Does not meet strategic criteria. Archive and move on.';
  }

  return {
    base_score: baseScore,
    strategic_modifier: totalModifier,
    adjusted_score: adjustedScore,
    strategic_verdict: strategicVerdict,
    moat_analysis: moatAnalysis,
    loop_analysis: loopAnalysis,
    guideline_analysis: guidelineAnalysis,
    action_items: [
      ...loopAnalysis.summary.all_action_items,
      ...(moatAnalysis.summary.moat_count === 0
        ? ['CRITICAL: No defensible moat identified. Engineer at least one before building.']
        : []),
      ...(guidelineAnalysis.summary.rules_passed < 2
        ? ['CRITICAL: Competitive guidelines not met. Reassess market positioning.']
        : []),
    ],
  };
}
