-- ===========================================================================
-- BidEngine AI — Database Schema Build Script
-- Target Database Platform: Supabase (PostgreSQL)
-- ===========================================================================

-- Enable UUID extension if not already present
create extension if not exists "uuid-ossp";

-- 1. RFP WORKSPACES TABLE
create table if not exists rfp_workspaces (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  status text not null default 'analyzing', -- 'analyzing', 'draft_ready', 'submitted'
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table rfp_workspaces enable row level security;

-- RLS Policies for rfp_workspaces
create policy "Users can operate only on their own workspaces"
  on rfp_workspaces
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 2. RFP REQUIREMENTS TABLE
create table if not exists rfp_requirements (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references rfp_workspaces(id) on delete cascade not null,
  requirement_text text not null,
  requirement_type text not null check (requirement_type in ('mandatory', 'evaluation', 'deadline')),
  compliance_status text not null check (compliance_status in ('pass', 'fail', 'partial')),
  extracted_value text,
  matched_evidence text,
  match_confidence numeric check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 100)),
  match_reasoning text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table rfp_requirements enable row level security;

-- RLS Policies for rfp_requirements
create policy "Users can read requirements of their workspaces"
  on rfp_requirements
  for select
  using (
    exists (
      select 1 from rfp_workspaces
      where rfp_workspaces.id = rfp_requirements.workspace_id
      and rfp_workspaces.user_id = auth.uid()
    )
  );

create policy "Users can construct/modify requirements of their workspaces"
  on rfp_requirements
  for all
  using (
    exists (
      select 1 from rfp_workspaces
      where rfp_workspaces.id = rfp_requirements.workspace_id
      and rfp_workspaces.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from rfp_workspaces
      where rfp_workspaces.id = rfp_requirements.workspace_id
      and rfp_workspaces.user_id = auth.uid()
    )
  );


-- 3. CAPABILITY LIBRARY TABLE
create table if not exists capability_library (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  external_id text unique,
  domain text,
  project_name text not null,
  description text not null,
  project_summary text,
  certification text,
  skills text[] default '{}'::text[] not null,
  year_completed integer not null,
  contract_value text,
  duration_months integer,
  client_type text,
  certifications text[] default '{}'::text[] not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table capability_library enable row level security;

-- RLS Policies for capability_library
create policy "Users can modify and read their own capability listings"
  on capability_library
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 4. HISTORICAL BID OUTCOMES TABLE
create table if not exists bid_history (
  id uuid default gen_random_uuid() primary key,
  bid_id text unique not null,
  client text,
  sector text not null,
  budget text,
  score_percent numeric check (score_percent is null or (score_percent >= 0 and score_percent <= 100)),
  outcome text not null check (outcome in ('win', 'loss')),
  response_time_hrs numeric,
  compliance_percent numeric check (compliance_percent is null or (compliance_percent >= 0 and compliance_percent <= 100)),
  doc_pages integer,
  gaps_found integer,
  bid_manager text,
  submission_date date,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table bid_history enable row level security;

create policy "Authenticated users can read bid history"
  on bid_history
  for select
  using (auth.role() = 'authenticated');


-- 5. EVALUATION CRITERIA TAXONOMY TABLE
create table if not exists evaluation_criteria_taxonomy (
  id uuid default gen_random_uuid() primary key,
  criteria_name text not null,
  sector text not null,
  weight_percentage numeric check (weight_percentage is null or (weight_percentage >= 0 and weight_percentage <= 100)),
  description text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique(criteria_name, sector)
);

alter table evaluation_criteria_taxonomy enable row level security;

create policy "Authenticated users can read evaluation taxonomy"
  on evaluation_criteria_taxonomy
  for select
  using (auth.role() = 'authenticated');


-- 6. PROPOSAL DRAFTS TABLE
create table if not exists proposal_drafts (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references rfp_workspaces(id) on delete cascade not null,
  section_title text not null,
  content text not null,
  status text not null default 'ai_generated' check (status in ('ai_generated', 'edited', 'approved')),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table proposal_drafts enable row level security;

-- RLS Policies for proposal_drafts
create policy "Users can read drafts of their workspaces"
  on proposal_drafts
  for select
  using (
    exists (
      select 1 from rfp_workspaces
      where rfp_workspaces.id = proposal_drafts.workspace_id
      and rfp_workspaces.user_id = auth.uid()
    )
  );

create policy "Users can create and update drafts of their workspaces"
  on proposal_drafts
  for all
  using (
    exists (
      select 1 from rfp_workspaces
      where rfp_workspaces.id = proposal_drafts.workspace_id
      and rfp_workspaces.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from rfp_workspaces
      where rfp_workspaces.id = proposal_drafts.workspace_id
      and rfp_workspaces.user_id = auth.uid()
    )
  );


-- 7. WIN SCORES TABLE
create table if not exists win_scores (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references rfp_workspaces(id) on delete cascade unique not null,
  total_score numeric not null check (total_score >= 0 and total_score <= 100),
  budget_alignment numeric not null check (budget_alignment >= 0 and budget_alignment <= 100),
  capability_match numeric not null check (capability_match >= 0 and capability_match <= 100),
  compliance_score numeric not null check (compliance_score >= 0 and compliance_score <= 100),
  sector_win_rate numeric check (sector_win_rate is null or (sector_win_rate >= 0 and sector_win_rate <= 100)),
  similar_experience_score numeric check (similar_experience_score is null or (similar_experience_score >= 0 and similar_experience_score <= 100)),
  evaluation_history_score numeric check (evaluation_history_score is null or (evaluation_history_score >= 0 and evaluation_history_score <= 100)),
  decision text not null check (decision in ('GO', 'NO-GO')),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table win_scores enable row level security;

-- RLS Policies for win_scores
create policy "Users can view score insights of their workspaces"
  on win_scores
  for select
  using (
    exists (
      select 1 from rfp_workspaces
      where rfp_workspaces.id = win_scores.workspace_id
      and rfp_workspaces.user_id = auth.uid()
    )
  );

create policy "Users can update and input score insights of their workspaces"
  on win_scores
  for all
  using (
    exists (
      select 1 from rfp_workspaces
      where rfp_workspaces.id = win_scores.workspace_id
      and rfp_workspaces.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from rfp_workspaces
      where rfp_workspaces.id = win_scores.workspace_id
      and rfp_workspaces.user_id = auth.uid()
    )
  );
