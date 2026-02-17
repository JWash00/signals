import { createClient } from '@supabase/supabase-js';

export const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
  },
  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
  },
  reddit: {
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    userAgent: process.env.REDDIT_USER_AGENT || 'SignalForge/0.1',
  },
  thresholds: {
    tierA: parseFloat(process.env.TIER_A_THRESHOLD || '75'),
    tierB: parseFloat(process.env.TIER_B_THRESHOLD || '55'),
    tierC: parseFloat(process.env.TIER_C_THRESHOLD || '35'),
    similarity: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.87'),
    clusterSimilarity: parseFloat(process.env.CLUSTER_SIMILARITY_THRESHOLD || '0.82'),
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
  },
};

export function validateConfig(requiredKeys = []) {
  const missing = [];
  for (const key of requiredKeys) {
    const keys = key.split('.');
    let value = config;
    for (const k of keys) {
      value = value?.[k];
    }
    if (!value) missing.push(key);
  }
  if (missing.length > 0) {
    console.error(`\n❌ Missing required config:\n${missing.map(k => `   - ${k}`).join('\n')}`);
    console.error(`\n   Copy .env.example to .env and fill in your values.\n`);
    process.exit(1);
  }
}

let _supabase = null;

export function getSupabase() {
  if (!_supabase) {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
      process.exit(1);
    }
    _supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return _supabase;
}

export function log(agent, message, data = null) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = `[${timestamp}] [${agent}]`;
  if (data) {
    console.log(`${prefix} ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export async function logIngestionRun(agentName, source, stats) {
  const sb = getSupabase();
  const { error } = await sb.from('ingestion_runs').insert({
    agent_name: agentName,
    source: source,
    signals_found: stats.found || 0,
    signals_new: stats.new || 0,
    signals_noise: stats.noise || 0,
    status: stats.status || 'completed',
    completed_at: new Date().toISOString(),
    duration_seconds: stats.durationSeconds || 0,
    errors: stats.errors || [],
  });
  if (error) console.error('Failed to log ingestion run:', error.message);
}
