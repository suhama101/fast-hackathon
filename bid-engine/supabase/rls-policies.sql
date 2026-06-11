-- BidEngine AI Supabase RLS policies.
-- Run this in the Supabase SQL editor after the tables exist.

alter table public.capability_library enable row level security;
alter table public.bid_history enable row level security;
alter table public.evaluation_criteria_taxonomy enable row level security;
alter table public.rfp_workspaces enable row level security;
alter table public.rfp_requirements enable row level security;
alter table public.proposal_drafts enable row level security;
alter table public.win_scores enable row level security;

revoke insert, update, delete on public.capability_library from anon, authenticated;
revoke insert, update, delete on public.bid_history from anon, authenticated;
revoke insert, update, delete on public.evaluation_criteria_taxonomy from anon, authenticated;

grant select on public.capability_library to authenticated;
grant select on public.bid_history to authenticated;
grant select on public.evaluation_criteria_taxonomy to authenticated;

grant select, insert, update, delete on public.rfp_workspaces to authenticated;
grant select, insert, update, delete on public.rfp_requirements to authenticated;
grant select, insert, update, delete on public.proposal_drafts to authenticated;
grant select, insert, update, delete on public.win_scores to authenticated;

drop policy if exists "capability_library_read_only" on public.capability_library;
create policy "capability_library_read_only"
on public.capability_library
for select
to authenticated
using (true);

drop policy if exists "bid_history_read_only" on public.bid_history;
create policy "bid_history_read_only"
on public.bid_history
for select
to authenticated
using (true);

drop policy if exists "evaluation_criteria_taxonomy_read_only" on public.evaluation_criteria_taxonomy;
create policy "evaluation_criteria_taxonomy_read_only"
on public.evaluation_criteria_taxonomy
for select
to authenticated
using (true);

drop policy if exists "rfp_workspaces_select_own" on public.rfp_workspaces;
create policy "rfp_workspaces_select_own"
on public.rfp_workspaces
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "rfp_workspaces_insert_own" on public.rfp_workspaces;
create policy "rfp_workspaces_insert_own"
on public.rfp_workspaces
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "rfp_workspaces_update_own" on public.rfp_workspaces;
create policy "rfp_workspaces_update_own"
on public.rfp_workspaces
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "rfp_workspaces_delete_own" on public.rfp_workspaces;
create policy "rfp_workspaces_delete_own"
on public.rfp_workspaces
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "rfp_requirements_select_own_workspace" on public.rfp_requirements;
create policy "rfp_requirements_select_own_workspace"
on public.rfp_requirements
for select
to authenticated
using (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
);

drop policy if exists "rfp_requirements_insert_own_workspace" on public.rfp_requirements;
create policy "rfp_requirements_insert_own_workspace"
on public.rfp_requirements
for insert
to authenticated
with check (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
);

drop policy if exists "rfp_requirements_update_own_workspace" on public.rfp_requirements;
create policy "rfp_requirements_update_own_workspace"
on public.rfp_requirements
for update
to authenticated
using (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
);

drop policy if exists "rfp_requirements_delete_own_workspace" on public.rfp_requirements;
create policy "rfp_requirements_delete_own_workspace"
on public.rfp_requirements
for delete
to authenticated
using (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
);

drop policy if exists "proposal_drafts_select_own_workspace" on public.proposal_drafts;
create policy "proposal_drafts_select_own_workspace"
on public.proposal_drafts
for select
to authenticated
using (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
);

drop policy if exists "proposal_drafts_insert_own_workspace" on public.proposal_drafts;
create policy "proposal_drafts_insert_own_workspace"
on public.proposal_drafts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
);

drop policy if exists "proposal_drafts_update_own_workspace" on public.proposal_drafts;
create policy "proposal_drafts_update_own_workspace"
on public.proposal_drafts
for update
to authenticated
using (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
);

drop policy if exists "proposal_drafts_delete_own_workspace" on public.proposal_drafts;
create policy "proposal_drafts_delete_own_workspace"
on public.proposal_drafts
for delete
to authenticated
using (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
);

drop policy if exists "win_scores_select_own_workspace" on public.win_scores;
create policy "win_scores_select_own_workspace"
on public.win_scores
for select
to authenticated
using (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
);

drop policy if exists "win_scores_insert_own_workspace" on public.win_scores;
create policy "win_scores_insert_own_workspace"
on public.win_scores
for insert
to authenticated
with check (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
);

drop policy if exists "win_scores_update_own_workspace" on public.win_scores;
create policy "win_scores_update_own_workspace"
on public.win_scores
for update
to authenticated
using (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
);

drop policy if exists "win_scores_delete_own_workspace" on public.win_scores;
create policy "win_scores_delete_own_workspace"
on public.win_scores
for delete
to authenticated
using (
  exists (
    select 1
    from public.rfp_workspaces workspace
    where workspace.id = workspace_id
      and workspace.user_id = auth.uid()
  )
);
