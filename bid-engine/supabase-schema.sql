ALTER TABLE public.rfp_workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rfp_workspaces_select_own ON public.rfp_workspaces;
CREATE POLICY rfp_workspaces_select_own
ON public.rfp_workspaces
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS rfp_workspaces_insert_own ON public.rfp_workspaces;
CREATE POLICY rfp_workspaces_insert_own
ON public.rfp_workspaces
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS rfp_workspaces_update_own ON public.rfp_workspaces;
CREATE POLICY rfp_workspaces_update_own
ON public.rfp_workspaces
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS rfp_workspaces_delete_own ON public.rfp_workspaces;
CREATE POLICY rfp_workspaces_delete_own
ON public.rfp_workspaces
FOR DELETE
USING (auth.uid() = user_id);

ALTER TABLE public.rfp_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rfp_requirements_select_own ON public.rfp_requirements;
CREATE POLICY rfp_requirements_select_own
ON public.rfp_requirements
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS rfp_requirements_insert_own ON public.rfp_requirements;
CREATE POLICY rfp_requirements_insert_own
ON public.rfp_requirements
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS rfp_requirements_update_own ON public.rfp_requirements;
CREATE POLICY rfp_requirements_update_own
ON public.rfp_requirements
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS rfp_requirements_delete_own ON public.rfp_requirements;
CREATE POLICY rfp_requirements_delete_own
ON public.rfp_requirements
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

ALTER TABLE public.proposal_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proposal_drafts_select_own ON public.proposal_drafts;
CREATE POLICY proposal_drafts_select_own
ON public.proposal_drafts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS proposal_drafts_insert_own ON public.proposal_drafts;
CREATE POLICY proposal_drafts_insert_own
ON public.proposal_drafts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS proposal_drafts_update_own ON public.proposal_drafts;
CREATE POLICY proposal_drafts_update_own
ON public.proposal_drafts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS proposal_drafts_delete_own ON public.proposal_drafts;
CREATE POLICY proposal_drafts_delete_own
ON public.proposal_drafts
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

ALTER TABLE public.win_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS win_scores_select_own ON public.win_scores;
CREATE POLICY win_scores_select_own
ON public.win_scores
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS win_scores_insert_own ON public.win_scores;
CREATE POLICY win_scores_insert_own
ON public.win_scores
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS win_scores_update_own ON public.win_scores;
CREATE POLICY win_scores_update_own
ON public.win_scores
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS win_scores_delete_own ON public.win_scores;
CREATE POLICY win_scores_delete_own
ON public.win_scores
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.evidence_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type text NOT NULL,
  source_id text NOT NULL,
  workspace_id uuid REFERENCES public.rfp_workspaces(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536) NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (source_type, source_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS evidence_documents_embedding_idx
  ON public.evidence_documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS evidence_documents_metadata_idx
  ON public.evidence_documents USING gin (metadata);

CREATE OR REPLACE FUNCTION public.match_evidence_documents(
  query_embedding vector(1536),
  match_count integer DEFAULT 8,
  filter_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  source_type text,
  source_id text,
  workspace_id uuid,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE sql STABLE
AS $$
  SELECT
    evidence_documents.id,
    evidence_documents.source_type,
    evidence_documents.source_id,
    evidence_documents.workspace_id,
    evidence_documents.chunk_index,
    evidence_documents.content,
    evidence_documents.metadata,
    1 - (evidence_documents.embedding <=> query_embedding) AS similarity
  FROM public.evidence_documents
  WHERE evidence_documents.metadata @> filter_metadata
  ORDER BY evidence_documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE TABLE IF NOT EXISTS public.ai_decision_trace (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.rfp_workspaces(id) ON DELETE CASCADE,
  requirement_id text,
  requirement_text text,
  evidence_document_id uuid REFERENCES public.evidence_documents(id) ON DELETE SET NULL,
  evidence_text text,
  rerank_score numeric,
  compliance_status text,
  draft_section_title text,
  trace jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ai_decision_trace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_decision_trace_select_own ON public.ai_decision_trace;
CREATE POLICY ai_decision_trace_select_own
ON public.ai_decision_trace
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS ai_decision_trace_modify_own ON public.ai_decision_trace;
CREATE POLICY ai_decision_trace_modify_own
ON public.ai_decision_trace
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rfp_workspaces w
    WHERE w.id = workspace_id
      AND w.user_id = auth.uid()
  )
);

ALTER TABLE public.bid_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bid_history_select_authenticated ON public.bid_history;
CREATE POLICY bid_history_select_authenticated
ON public.bid_history
FOR SELECT
USING (auth.role() = 'authenticated');

ALTER TABLE public.capability_library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS capability_library_select_authenticated ON public.capability_library;
CREATE POLICY capability_library_select_authenticated
ON public.capability_library
FOR SELECT
USING (auth.role() = 'authenticated');

ALTER TABLE public.evaluation_criteria_taxonomy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS evaluation_criteria_taxonomy_select_authenticated ON public.evaluation_criteria_taxonomy;
CREATE POLICY evaluation_criteria_taxonomy_select_authenticated
ON public.evaluation_criteria_taxonomy
FOR SELECT
USING (auth.role() = 'authenticated');
