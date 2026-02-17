# SIGNALFORGE — SUPABASE SETUP GUIDE

## Step-by-Step Deployment (30 minutes)

---

### 1. Create Your Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. **Project name:** `signalforge` (or whatever you want)
3. **Database password:** Generate a strong one. **Save it.** You need it for direct DB connections.
4. **Region:** Choose closest to your n8n instance (if Railway US, pick `us-east-1`)
5. **Plan:** Free tier works for MVP. Upgrade to Pro ($25/mo) when you hit 500MB or need pg_cron.

### 2. Enable Required Extensions

Go to **Database → Extensions** in the Supabase dashboard and enable:

- [x] `vector` — for embeddings and similarity search
- [x] `pg_cron` — for scheduled maintenance jobs (**Pro plan required**)
- [x] `pg_trgm` — for trigram text search

> **Note:** If you're on the free tier, skip `pg_cron` for now. You can run the
> maintenance queries manually or via n8n scheduled workflows instead.

### 3. Run the Migration

**Option A: SQL Editor (easiest)**
1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Paste the entire contents of `001_initial_schema.sql`
4. Click **Run**

> If pg_cron is not available (free tier), comment out the entire
> Section 8 (DAILY MAINTENANCE) before running. You'll handle those
> tasks in n8n instead.

**Option B: Supabase CLI (recommended for version control)**
```bash
# Install CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push the migration
supabase db push
```

### 4. Verify the Setup

Run these in SQL Editor to confirm everything is working:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected: alerts, competitors, ingestion_runs, opportunities,
--           pain_clusters, raw_signals, scoring_snapshots

-- Check views exist
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public';

-- Expected: v_active_opportunities, v_competitor_weaknesses,
--           v_signal_queue, v_trending_clusters

-- Check vector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- Test the daily briefing function (will return empty data)
SELECT get_daily_briefing();
```

### 5. Get Your Connection Credentials

You need TWO things for n8n:

**A. Supabase REST API (for simple CRUD):**
- Go to **Settings → API**
- Copy: `Project URL` (e.g., `https://xxxxx.supabase.co`)
- Copy: `service_role` key (the secret one, not `anon`)

**B. Direct PostgreSQL connection (for complex queries):**
- Go to **Settings → Database**
- Copy the **Connection string** (URI format)
- Format: `postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres`

---

## n8n Environment Variables

Set these in your n8n instance (Railway environment variables or `.env` file):

```env
# Supabase REST API
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Direct DB (for complex queries)
SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres

# LLM APIs (needed by agents)
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...

# Alert delivery
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
RESEND_API_KEY=re_...
```

---

## n8n Connection Examples

### Insert a Raw Signal (REST API)

```javascript
// n8n HTTP Request node
// Method: POST
// URL: {{ $env.SUPABASE_URL }}/rest/v1/raw_signals
// Headers:
//   apikey: {{ $env.SUPABASE_SERVICE_ROLE_KEY }}
//   Authorization: Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}
//   Content-Type: application/json
//   Prefer: return=representation

{
  "source": "reddit",
  "source_url": "https://reddit.com/r/SaaS/comments/abc123",
  "source_id": "abc123",
  "raw_text": "I've been looking for a tool that auto-reconciles invoices...",
  "author": "u/frustrated_founder",
  "thread_title": "What tool do you wish existed?",
  "parent_context": "r/SaaS",
  "upvotes": 247,
  "comments": 89,
  "published_at": "2026-01-15T10:30:00Z"
}
```

### Query Unprocessed Signals (REST API)

```javascript
// GET {{ $env.SUPABASE_URL }}/rest/v1/raw_signals
//   ?is_processed=eq.false
//   &is_noise=eq.false
//   &order=engagement_score.desc
//   &limit=50
```

### Update Signal After Classification (REST API)

```javascript
// PATCH {{ $env.SUPABASE_URL }}/rest/v1/raw_signals?id=eq.{{ signal_id }}
{
  "is_processed": true,
  "pain_category": "workflow_friction",
  "intensity": 8,
  "specificity": 7,
  "wtp": "explicit",
  "budget_mentioned": 50.00,
  "tools_mentioned": ["QuickBooks", "Harvest"],
  "target_persona": "agency owners",
  "suggested_niche": "invoice_reconciliation",
  "classification": { /* full LLM JSON response */ }
}
```

### Find Similar Signals (Direct SQL via n8n Postgres node)

```sql
SELECT * FROM find_similar_signals(
  '[0.123, 0.456, ...]'::vector(1536),  -- embedding from OpenAI/Claude
  0.87,  -- similarity threshold
  5      -- max results
);
```

### Get Daily Briefing (Direct SQL)

```sql
SELECT get_daily_briefing();
```

### Insert Opportunity with Auto-Tier (REST API)

```javascript
// POST {{ $env.SUPABASE_URL }}/rest/v1/opportunities
// The trigger automatically calculates tier from score_total
{
  "cluster_id": "uuid-of-pain-cluster",
  "title": "Invoice Reconciliation for Agencies",
  "description": "Auto-reconcile invoices across agency tools",
  "score_total": 82.3,
  "score_pain": 21.5,
  "score_velocity": 16.2,
  "score_wtp": 22.1,
  "score_competition": 12.8,
  "score_feasibility": 9.7,
  "tam_estimate": "$2.4B",
  "positioning": "Auto-reconcile invoices across all your agency tools",
  "competitor_count": 3,
  "primary_gap": "No multi-client reconciliation under $79/mo",
  "mvp_build_days": 60
}
// tier will be auto-set to 'A' (score >= 75)
// alert will be auto-generated for tier upgrade
```

---

## Schema Architecture Decisions (Why It's Built This Way)

### Why `engagement_score` is a generated column
You don't want agents doing math. The DB handles it:
`upvotes + (comments × 3) + (shares × 5)`. Comments are worth 3x
because they indicate deeper engagement. Shares are 5x because they
indicate the pain resonated enough to spread.

### Why `content_hash` for dedup
Before you spend tokens generating embeddings, a simple MD5 hash catches
exact duplicates (same post scraped from two sources, reposts, etc.)
at zero cost. Semantic dedup via embeddings is the second layer.

### Why HNSW indexes instead of IVFFlat
HNSW is slower to build but faster to query and doesn't require training
on existing data. Since your dataset grows incrementally, HNSW is the
right choice. IVFFlat would need periodic retraining.

### Why `signal_source` is an enum, not a text field
Enums prevent garbage data. When you add a new source, you add it to
the enum (`ALTER TYPE signal_source ADD VALUE 'new_source';`). This
ensures every query that filters by source works correctly.

### Why cluster aggregates are in a function, not a materialized view
Materialized views require manual refresh. The function runs on-demand
when a signal is assigned to a cluster (via trigger) and is always
current. For a dataset of <100K signals, this is fast enough.

### Why RLS is enabled but permissive
Right now your only client is n8n using the `service_role` key, which
bypasses RLS. When you build a dashboard (Retool, custom app), you'll
add user-specific policies. Having RLS enabled from Day 1 means you
won't forget to secure it later.

### Why separate `scoring_snapshots` table
You need to answer: "How did this opportunity's score change over the
last 30 days?" That requires historical snapshots. Storing score_history
as JSONB in the opportunities table works for small histories, but a
dedicated table with a unique constraint on (opportunity_id, date) is
cleaner for time-series queries and charting.

---

## Free Tier vs Pro Tier

| Feature | Free | Pro ($25/mo) |
|---------|------|-------------|
| Database size | 500MB | 8GB |
| pg_cron | ❌ | ✅ |
| pgvector | ✅ | ✅ |
| Edge Functions | 500K/mo | 2M/mo |
| Realtime | 200 concurrent | 500 concurrent |
| Daily backups | ❌ | ✅ |

**Recommendation:** Start on Free. Move to Pro when either:
- You exceed 500MB (probably around 50K signals)
- You want pg_cron for automated maintenance
- You need daily backups (you should)

On Free tier, replace pg_cron tasks with n8n scheduled workflows
that run the same SQL queries on a cron schedule.

---

## What's Next

Your database is ready. The next attack vector is:

1. **Scout Agent (Reddit)** — n8n workflow that ingests signals
2. **Classifier Agent** — n8n workflow that calls Claude to classify
3. **Embedding Pipeline** — generates vectors for dedup + clustering
4. **Scoring Engine** — calculates opportunity scores

Pick your next target.
