import { config, validateConfig, getSupabase, log, logIngestionRun } from '../lib/config.js';
import { generateEmbedding, storeSignalEmbedding, findSimilarSignals, assignToCluster } from '../lib/embeddings.js';

validateConfig(['supabase.url', 'supabase.serviceRoleKey', 'anthropic.apiKey', 'openai.apiKey']);

const BATCH_SIZE = 10;
const MAX_BATCHES = 5;

const CLASSIFY_SYSTEM_PROMPT = `You are a senior SaaS market analyst. Your job is to classify raw social media signals into structured pain point data.

You are looking for REAL business opportunities — problems that could support a $100K-$5M/month SaaS product.

For each signal, return a JSON object with EXACTLY these fields:

{
  "pain_category": "one of: workflow_friction, missing_feature, cost_complaint, integration_gap, reliability_issue, complexity_complaint, support_failure, scaling_limitation, security_concern, onboarding_friction, performance_issue, data_portability, uncategorized",
  "intensity": <1-10 integer. 10 = person is desperate, 1 = mild annoyance>,
  "specificity": <1-10 integer. 10 = describes exact workflow/tool/budget, 1 = vague complaint>,
  "wtp": "one of: none, implicit, explicit, proven",
  "budget_mentioned": <dollar amount as number if stated, null otherwise>,
  "tools_mentioned": ["Tool A", "Tool B"],
  "existing_workarounds": "brief description of what they're doing now, or null",
  "target_persona": "who has this problem (e.g., 'agency owners with 10+ clients')",
  "suggested_niche": "snake_case SaaS category (e.g., invoice_reconciliation, social_media_scheduling)",
  "is_noise": <true if this is spam, self-promotion, venting without actionable pain, or off-topic. false otherwise>,
  "confidence": <0.0-1.0 how confident you are in this classification>
}

WTP (Willingness to Pay) definitions:
- "none": No payment signals at all
- "implicit": Suggests they'd switch or try something better
- "explicit": Directly states willingness to pay
- "proven": References actual spending

Be aggressive about marking noise. If the signal doesn't describe a specific, actionable problem that a SaaS could solve, mark it as noise.

Return ONLY the JSON object. No explanation, no markdown, no backticks.`;

async function classifySignal(rawText, context = '') {
  const userPrompt = context
    ? `Context: ${context}\n\nSignal:\n${rawText}`
    : `Signal:\n${rawText}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropic.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.anthropic.model,
      max_tokens: 500,
      system: CLASSIFY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
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
}

async function classifyBatch(signals) {
  const results = [];

  for (const signal of signals) {
    try {
      const context = [signal.parent_context, signal.thread_title]
        .filter(Boolean)
        .join(' — ');

      const classification = await classifySignal(signal.raw_text, context);
      results.push({ signal, classification, error: null });
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      log('classifier', `Failed to classify signal ${signal.id}: ${err.message}`);
      results.push({ signal, classification: null, error: err.message });
    }
  }

  return results;
}

async function saveClassification(signalId, classification) {
  const sb = getSupabase();

  const update = {
    is_processed: true,
    pain_category: classification.pain_category || 'uncategorized',
    intensity: classification.intensity || null,
    specificity: classification.specificity || null,
    wtp: classification.wtp || 'none',
    budget_mentioned: classification.budget_mentioned || null,
    tools_mentioned: classification.tools_mentioned || [],
    existing_workarounds: classification.existing_workarounds || null,
    target_persona: classification.target_persona || null,
    suggested_niche: classification.suggested_niche || null,
    is_noise: classification.is_noise || false,
    classification: classification,
  };

  const { error } = await sb
    .from('raw_signals')
    .update(update)
    .eq('id', signalId);

  if (error) {
    log('classifier', `Failed to save classification for ${signalId}: ${error.message}`);
    return false;
  }
  return true;
}

async function runClassifier() {
  const startTime = Date.now();
  log('classifier', '═══ Starting classification pipeline ═══');

  const sb = getSupabase();
  let totalProcessed = 0;
  let totalClassified = 0;
  let totalNoise = 0;
  let totalClustered = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data: signals, error } = await sb
      .from('raw_signals')
      .select('id, raw_text, source, parent_context, thread_title, engagement_score')
      .eq('is_processed', false)
      .order('engagement_score', { ascending: false })
      .limit(BATCH_SIZE);

    if (error) {
      log('classifier', `DB error: ${error.message}`);
      break;
    }
    if (!signals || signals.length === 0) {
      log('classifier', 'No more unprocessed signals.');
      break;
    }

    log('classifier', `Batch ${batch + 1}: processing ${signals.length} signals...`);

    const results = await classifyBatch(signals);

    for (const { signal, classification, error: classError } of results) {
      if (classError || !classification) {
        await sb.from('raw_signals').update({ is_processed: true, is_noise: true }).eq('id', signal.id);
        totalProcessed++;
        continue;
      }

      await saveClassification(signal.id, classification);
      totalProcessed++;

      if (classification.is_noise) {
        totalNoise++;
        continue;
      }

      totalClassified++;

      try {
        const embedding = await generateEmbedding(signal.raw_text);
        await storeSignalEmbedding(signal.id, embedding);

        const dupes = await findSimilarSignals(embedding);
        if (dupes.length > 0 && dupes[0].cluster_id) {
          await sb.from('raw_signals')
            .update({ cluster_id: dupes[0].cluster_id })
            .eq('id', signal.id);
          log('classifier', `  → Matched to existing cluster via similarity (${dupes[0].similarity.toFixed(3)})`);
          totalClustered++;
        } else {
          const result = await assignToCluster(signal.id, embedding, classification);
          if (result.action !== 'failed') totalClustered++;
        }

      } catch (embError) {
        log('classifier', `Embedding/clustering failed for ${signal.id}: ${embError.message}`);
      }
    }

    log('classifier', `  Batch ${batch + 1} done: ${results.length} processed`);
  }

  const duration = (Date.now() - startTime) / 1000;
  log('classifier', `═══ Classification complete ═══`);
  log('classifier', `  Processed: ${totalProcessed} | Classified: ${totalClassified} | Noise: ${totalNoise} | Clustered: ${totalClustered} | Time: ${duration.toFixed(1)}s`);

  await logIngestionRun('classifier', null, {
    found: totalProcessed,
    new: totalClassified,
    noise: totalNoise,
    status: 'completed',
    durationSeconds: duration,
  });
}

runClassifier().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
