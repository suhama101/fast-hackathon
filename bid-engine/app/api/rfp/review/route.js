import { NextResponse } from "next/server";
import { reviewProposalWithGroq } from "../../../../lib/reviewerAgent";
import { runCrewStage } from "../../../../lib/crewBridge";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "../../../../lib/requestAuth";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

export async function POST(request) {
  try {
    const { workspaceId } = await request.json();
    if (!isUuid(workspaceId)) {
      return NextResponse.json({ error: "A valid workspaceId UUID is required." }, { status: 400 });
    }

    const auth = await requireAuthenticatedUser(request);
    if (auth.errorResponse) return auth.errorResponse;

    const ownership = await requireWorkspaceOwner(request, workspaceId);
    if (ownership.errorResponse) return ownership.errorResponse;

    const { supabase } = ownership;
    const [
      { data: workspace },
      { data: requirements },
      { data: drafts },
      { data: score },
    ] = await Promise.all([
      supabase.from("rfp_workspaces").select("*").eq("id", workspaceId).maybeSingle(),
      supabase.from("rfp_requirements").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: true }),
      supabase.from("proposal_drafts").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: true }),
      supabase.from("win_scores").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    ]);

    let crewReview = null;
    try {
      crewReview = await runCrewStage("review", {
        proposalDrafts: drafts || [],
        requirements: requirements || [],
        matches: requirements || [],
        score: score || null,
        workspaceTitle: workspace?.title || "RFP Proposal",
      });
    } catch (crewError) {
      console.warn("CrewAI review fallback:", crewError.message);
    }

    const review = crewReview && !crewReview.error
      ? crewReview
      : await reviewProposalWithGroq({
      proposalDrafts: drafts || [],
      requirements: requirements || [],
      matches: requirements || [],
      score: score || null,
      workspaceTitle: workspace?.title || "RFP Proposal",
      });

    return NextResponse.json({
      success: true,
      workspaceId,
      review,
      final_proposal: review.improved_proposal,
      recommendation: review.final_recommendation,
    });
  } catch (err) {
    console.error("Proposal review failure:", err);
    return NextResponse.json(
      { error: "Failed to review proposal: " + err.message },
      { status: 500 }
    );
  }
}
