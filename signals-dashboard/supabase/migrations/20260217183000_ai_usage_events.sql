-- Create AI usage events table
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  event text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  opportunity_id uuid null,
  cluster_id uuid null,
  raw_signal_id uuid null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists ai_usage_events_owner_created_at_idx
  on public.ai_usage_events (owner_id, created_at desc);

create index if not exists ai_usage_events_event_created_at_idx
  on public.ai_usage_events (event, created_at desc);

create index if not exists ai_usage_events_opportunity_id_idx
  on public.ai_usage_events (opportunity_id);

-- Enable RLS
alter table public.ai_usage_events enable row level security;

-- RLS policies
create policy "ai_usage_events_select_own"
  on public.ai_usage_events
  for select
  using (owner_id = auth.uid());

create policy "ai_usage_events_insert_own"
  on public.ai_usage_events
  for insert
  with check (owner_id = auth.uid());

create policy "ai_usage_events_update_own"
  on public.ai_usage_events
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "ai_usage_events_delete_own"
  on public.ai_usage_events
  for delete
  using (owner_id = auth.uid());
