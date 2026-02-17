# PMF Dashboard — Signals

A Next.js (App Router) dashboard for Product-Market Fit scoring. Reads from existing Supabase views/tables.

## Environment Variables

Create `.env.local` in the `signals-dashboard` directory:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Enable Email/Password Auth in Supabase

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable **Email** provider
3. Optionally disable "Confirm email" for development (Authentication → Settings → toggle off "Enable email confirmations")

## Create First User

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:3000/login`
3. Click **Sign Up**, enter email and password (min 6 chars)
4. If email confirmations are enabled, check your inbox and confirm
5. You'll be redirected to `/dashboard`

## Create Default Scoring Model

1. Log in and navigate to `/models`
2. Click **Create Default Model**
3. This creates a model with standard weights:
   - demand: 0.25, pain: 0.25, wtp: 0.2, headroom: 0.2, timing: 0.1
   - Thresholds: build 80, invest 75, monitor 55
   - Penalties: saturation 0.75

## Create an Opportunity and Run Analysis

1. Navigate to `/opportunities`
2. Fill in the **Create Opportunity** form:
   - Title (required)
   - Cluster (optional, from existing clusters)
3. On the opportunity detail page, fill in the **Run Analysis** form:
   - All 6 inputs are floats between 0 and 1
   - demand_strength, pain_intensity, willingness_to_pay, competitive_headroom, saturation, timing
4. The engine computes a deterministic score, verdict (BUILD/INVEST/MONITOR/PASS), and confidence
5. Results are stored in `scoring_snapshots` and displayed immediately

## Routes

| Route | Auth | Description |
|-------|------|-------------|
| `/login` | Public | Sign in / sign up |
| `/dashboard` | Protected | Pipeline overview (top 25 by score) |
| `/clusters` | Protected | Pain clusters with signal counts |
| `/opportunities` | Protected | List + create opportunities |
| `/opportunities/[id]` | Protected | Detail view, competitors, run analysis |
| `/models` | Protected | Manage scoring models |

## Supabase Views Used

- `pipeline_v1` — Opportunity pipeline with latest scores
- `opportunity_detail_v1` — Full opportunity detail with competitors/signals
- `cluster_pipeline_v1` — Cluster overview with signal/opportunity counts
- `pmf_clusters` — Cluster list for dropdowns
- `pmf_signals` — Signal list
- `pmf_opportunities` — Opportunity list

## Tables Written To

- `opportunities` — Create new opportunities
- `competitors` — Add competitors (max 4 per cluster)
- `scoring_models` — Create/update scoring models
- `scoring_snapshots` — Store analysis results
