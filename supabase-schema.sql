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
  project_name text not null,
  description text not null,
  skills text[] default '{}'::text[] not null,
  year_completed integer not null,
  contract_value text,
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


-- 4. PROPOSAL DRAFTS TABLE
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


-- 5. WIN SCORES TABLE
create table if not exists win_scores (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references rfp_workspaces(id) on delete cascade unique not null,
  total_score numeric not null check (total_score >= 0 and total_score <= 100),
  budget_alignment numeric not null check (budget_alignment >= 0 and budget_alignment <= 100),
  capability_match numeric not null check (capability_match >= 0 and capability_match <= 100),
  compliance_score numeric not null check (compliance_score >= 0 and compliance_score <= 100),
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
