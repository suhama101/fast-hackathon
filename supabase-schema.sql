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
  raw_text text,
  file_name text,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table rfp_workspaces add column if not exists raw_text text;
alter table rfp_workspaces add column if not exists file_name text;
alter table rfp_workspaces add column if not exists updated_at timestamptz default timezone('utc'::text, now()) not null;

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

alter table rfp_requirements add column if not exists matched_evidence text;
alter table rfp_requirements add column if not exists match_confidence numeric check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 100));
alter table rfp_requirements add column if not exists match_reasoning text;

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

alter table capability_library add column if not exists external_id text unique;
alter table capability_library add column if not exists domain text;
alter table capability_library add column if not exists project_summary text;
alter table capability_library add column if not exists certification text;
alter table capability_library add column if not exists duration_months integer;

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
  competitor_presence text,
  incumbent_vendor text,
  technical_score numeric check (technical_score is null or (technical_score >= 0 and technical_score <= 100)),
  commercial_score numeric check (commercial_score is null or (commercial_score >= 0 and commercial_score <= 100)),
  risk_score numeric check (risk_score is null or (risk_score >= 0 and risk_score <= 100)),
  strategic_fit_score numeric check (strategic_fit_score is null or (strategic_fit_score >= 0 and strategic_fit_score <= 100)),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table bid_history add column if not exists competitor_presence text;
alter table bid_history add column if not exists incumbent_vendor text;
alter table bid_history add column if not exists technical_score numeric check (technical_score is null or (technical_score >= 0 and technical_score <= 100));
alter table bid_history add column if not exists commercial_score numeric check (commercial_score is null or (commercial_score >= 0 and commercial_score <= 100));
alter table bid_history add column if not exists risk_score numeric check (risk_score is null or (risk_score >= 0 and risk_score <= 100));
alter table bid_history add column if not exists strategic_fit_score numeric check (strategic_fit_score is null or (strategic_fit_score >= 0 and strategic_fit_score <= 100));

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
  technical_history_score numeric check (technical_history_score is null or (technical_history_score >= 0 and technical_history_score <= 100)),
  commercial_history_score numeric check (commercial_history_score is null or (commercial_history_score >= 0 and commercial_history_score <= 100)),
  strategic_fit_score numeric check (strategic_fit_score is null or (strategic_fit_score >= 0 and strategic_fit_score <= 100)),
  risk_penalty_score numeric check (risk_penalty_score is null or (risk_penalty_score >= 0 and risk_penalty_score <= 100)),
  decision text not null check (decision in ('GO', 'NO-GO')),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table win_scores add column if not exists sector_win_rate numeric check (sector_win_rate is null or (sector_win_rate >= 0 and sector_win_rate <= 100));
alter table win_scores add column if not exists similar_experience_score numeric check (similar_experience_score is null or (similar_experience_score >= 0 and similar_experience_score <= 100));
alter table win_scores add column if not exists evaluation_history_score numeric check (evaluation_history_score is null or (evaluation_history_score >= 0 and evaluation_history_score <= 100));
alter table win_scores add column if not exists technical_history_score numeric check (technical_history_score is null or (technical_history_score >= 0 and technical_history_score <= 100));
alter table win_scores add column if not exists commercial_history_score numeric check (commercial_history_score is null or (commercial_history_score >= 0 and commercial_history_score <= 100));
alter table win_scores add column if not exists strategic_fit_score numeric check (strategic_fit_score is null or (strategic_fit_score >= 0 and strategic_fit_score <= 100));
alter table win_scores add column if not exists risk_penalty_score numeric check (risk_penalty_score is null or (risk_penalty_score >= 0 and risk_penalty_score <= 100));

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


-- 8. VECTOR KNOWLEDGE BASE FOR REAL RAG
create extension if not exists vector;

create table if not exists evidence_documents (
  id uuid default gen_random_uuid() primary key,
  source_type text not null,
  source_id text not null,
  workspace_id uuid references rfp_workspaces(id) on delete cascade,
  chunk_index integer not null default 0,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (source_type, source_id, chunk_index)
);

create index if not exists evidence_documents_embedding_idx
  on evidence_documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists evidence_documents_metadata_idx
  on evidence_documents using gin (metadata);

create or replace function match_evidence_documents(
  query_embedding vector(1536),
  match_count integer default 8,
  filter_metadata jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  source_type text,
  source_id text,
  workspace_id uuid,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql stable
as $$
  select
    evidence_documents.id,
    evidence_documents.source_type,
    evidence_documents.source_id,
    evidence_documents.workspace_id,
    evidence_documents.chunk_index,
    evidence_documents.content,
    evidence_documents.metadata,
    1 - (evidence_documents.embedding <=> query_embedding) as similarity
  from evidence_documents
  where evidence_documents.metadata @> filter_metadata
  order by evidence_documents.embedding <=> query_embedding
  limit match_count;
$$;

create table if not exists ai_decision_trace (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references rfp_workspaces(id) on delete cascade,
  requirement_id text,
  requirement_text text,
  evidence_document_id uuid references evidence_documents(id) on delete set null,
  evidence_text text,
  rerank_score numeric,
  compliance_status text,
  draft_section_title text,
  trace jsonb not null default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table ai_decision_trace enable row level security;

drop policy if exists ai_decision_trace_select_own on ai_decision_trace;
create policy ai_decision_trace_select_own
on ai_decision_trace
for select
using (
  exists (
    select 1
    from rfp_workspaces w
    where w.id = workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists ai_decision_trace_modify_own on ai_decision_trace;
create policy ai_decision_trace_modify_own
on ai_decision_trace
for all
using (
  exists (
    select 1
    from rfp_workspaces w
    where w.id = workspace_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from rfp_workspaces w
    where w.id = workspace_id
      and w.user_id = auth.uid()
  )
);
