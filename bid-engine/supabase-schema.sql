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
