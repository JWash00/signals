import OpenAI from 'openai';
import { config, getSupabase, log } from './config.js';

let _openai = null;

function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return _openai;
}

export async function generateEmbedding(text) {
  const openai = getOpenAI();
  const cleaned = text.slice(0, 8000).replace(/\n+/g, ' ').trim();

  const response = await openai.embeddings.create({
    model: config.openai.embeddingModel,
    input: cleaned,
    dimensions: config.openai.embeddingDimensions,
  });

  return response.data[0].embedding;
}

export async function generateEmbeddings(texts) {
  const openai = getOpenAI();
  const cleaned = texts.map(t => t.slice(0, 8000).replace(/\n+/g, ' ').trim());

  const response = await openai.embeddings.create({
    model: config.openai.embeddingModel,
    input: cleaned,
    dimensions: config.openai.embeddingDimensions,
  });

  return response.data.map(d => d.embedding);
}

export async function findSimilarSignals(embedding, threshold = null) {
  const sb = getSupabase();
  const t = threshold || config.thresholds.similarity;

  const { data, error } = await sb.rpc('find_similar_signals', {
    query_embedding: JSON.stringify(embedding),
    similarity_threshold: t,
    max_results: 5,
  });

  if (error) {
    log('embeddings', `Similarity search failed: ${error.message}`);
    return [];
  }
  return data || [];
}

export async function findSimilarClusters(embedding, threshold = null) {
  const sb = getSupabase();
  const t = threshold || config.thresholds.clusterSimilarity;

  const { data, error } = await sb.rpc('find_similar_clusters', {
    query_embedding: JSON.stringify(embedding),
    similarity_threshold: t,
    max_results: 3,
  });

  if (error) {
    log('embeddings', `Cluster search failed: ${error.message}`);
    return [];
  }
  return data || [];
}

export async function storeSignalEmbedding(signalId, embedding) {
  const sb = getSupabase();
  const { error } = await sb
    .from('raw_signals')
    .update({ embedding: JSON.stringify(embedding) })
    .eq('id', signalId);

  if (error) {
    log('embeddings', `Failed to store embedding for ${signalId}: ${error.message}`);
  }
}

export async function assignToCluster(signalId, embedding, classification) {
  const sb = getSupabase();

  const matches = await findSimilarClusters(embedding);

  if (matches.length > 0) {
    const best = matches[0];
    log('embeddings', `Signal ${signalId} → existing cluster "${best.title}" (similarity: ${best.similarity.toFixed(3)})`);

    const { error } = await sb
      .from('raw_signals')
      .update({ cluster_id: best.cluster_id })
      .eq('id', signalId);

    if (error) log('embeddings', `Failed to assign to cluster: ${error.message}`);
    return { action: 'assigned', clusterId: best.cluster_id, clusterTitle: best.title };
  }

  const title = classification?.suggested_niche
    ? classification.suggested_niche.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Uncategorized Cluster';

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const { data: newCluster, error: clusterError } = await sb
    .from('pain_clusters')
    .insert({
      title,
      slug: `${slug}-${Date.now()}`,
      pain_category: classification?.pain_category || 'uncategorized',
      description: classification?.existing_workarounds || null,
      centroid: JSON.stringify(embedding),
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (clusterError) {
    log('embeddings', `Failed to create cluster: ${clusterError.message}`);
    return { action: 'failed', error: clusterError.message };
  }

  await sb
    .from('raw_signals')
    .update({ cluster_id: newCluster.id })
    .eq('id', signalId);

  log('embeddings', `Signal ${signalId} → NEW cluster "${title}" (${newCluster.id})`);
  return { action: 'created', clusterId: newCluster.id, clusterTitle: title };
}
