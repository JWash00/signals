# SignalForge

AI-powered market intelligence engine that discovers validated SaaS opportunities from real human pain signals.

## What It Does

1. **Discovers** pain points from Reddit, YouTube, G2, app stores, and more
2. **Classifies** signals using Claude AI (category, intensity, willingness to pay)
3. **Deduplicates** using semantic embeddings (pgvector)
4. **Clusters** related signals into pain patterns
5. **Scores** each pattern on a 0-100 scale (pain × velocity × WTP × competition × feasibility)
6. **Delivers** daily briefings with the best opportunities to build

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Fill in your API keys (see .env.example for details)

# 3. Deploy database
# Paste supabase/migrations/001_initial_schema.sql into Supabase SQL Editor
# Then run supabase/tests/smoke_test.sql to verify

# 4. Run agents
node agents/scout_reddit.js     # Ingest signals from Reddit
node agents/classifier.js       # Classify + cluster signals
```

## Project Structure

```
signalforge/
├── agents/                    # Agent scripts (run standalone or via n8n)
│   ├── scout_reddit.js        # Reddit signal ingestion
│   ├── classifier.js          # Claude-powered classification + clustering
│   ├── scorer.js              # Opportunity scoring (TODO)
│   └── scribe.js              # Daily briefing generation (TODO)
├── lib/                       # Shared utilities
│   ├── config.js              # Supabase client, env config, logging
│   └── embeddings.js          # OpenAI embeddings, similarity search, clustering
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql  # Full database schema
│   ├── tests/
│   │   └── smoke_test.sql     # Schema validation tests
│   ├── CHEAT_SHEET.sql        # Copy-paste queries for common ops
│   └── SETUP_GUIDE.md         # Step-by-step Supabase deployment
├── n8n/
│   └── workflows/             # Exportable n8n workflow JSONs (TODO)
├── .env.example               # Environment variable template
└── package.json
```

## Required API Keys

| Service | Purpose | Get it at |
|---------|---------|-----------|
| Supabase | Database + vectors | supabase.com |
| Anthropic (Claude) | Signal classification | console.anthropic.com |
| OpenAI | Embeddings (text-embedding-3-small) | platform.openai.com |
| Reddit | Signal ingestion | reddit.com/prefs/apps |
| Perplexity | Competitor research | perplexity.ai/settings/api |

## Build Roadmap

- [x] Database schema (Supabase + pgvector)
- [x] Scout agent (Reddit)
- [x] Classifier agent (Claude API)
- [x] Embedding pipeline (OpenAI + pgvector)
- [x] Cluster assignment logic
- [ ] Scorer agent (5-dimension weighted model)
- [ ] Competitor intel agent (Perplexity Search API)
- [ ] Scribe agent (daily briefing + dossier generation)
- [ ] YouTube Scout agent
- [ ] n8n workflow configs
- [ ] Slack alert integration
- [ ] Retool dashboard
