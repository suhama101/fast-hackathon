import { NextResponse } from "next/server";
import { loadHackathonDataset } from "../../../../lib/datasetLoader";
import { calculateWinScore } from "../../../../lib/datasetAnalysis";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "../../../../lib/requestAuth";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const normalizeRequirement = (req, index = 0) => ({
  id: req.id || `REQ-${String(index + 1).padStart(3, "0")}`,
  requirement_text: req.requirement_text || req.description || req.title || "",
  requirement_type: req.requirement_type || "mandatory",
  compliance_status: req.compliance_status || req.status || "partial",
  extracted_value: req.extracted_value || "",
});

export async function POST(request) {
  try {
    const { workspaceId, requirements: clientRequirements = [], rawText = "" } = await request.json();
    const auth = await requireAuthenticatedUser(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { supabase, user } = auth;
    let mode = "dataset";
    let requirements = [];
    let bidHistory = [];
    let capabilities = [];
    let workspaceRawText = "";

    if (workspaceId && isUuid(workspaceId)) {
      const ownership = await requireWorkspaceOwner(request, workspaceId);
      if (ownership.errorResponse) return ownership.errorResponse;

      const [{ data: dbRequirements, error: reqError }, { data: workspace, error: workspaceError }] = await Promise.all([
        supabase
          .from("rfp_requirements")
          .select("*")
          .eq("workspace_id", workspaceId),
        supabase
          .from("rfp_workspaces")
          .select("raw_text")
          .eq("id", workspaceId)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (reqError) throw reqError;
      if (workspaceError) throw workspaceError;
      requirements = dbRequirements || [];
      workspaceRawText = workspace?.raw_text || "";
    }

    if (requirements.length === 0) {
      mode = "sample_mode";
      requirements = clientRequirements.map(normalizeRequirement);
    }

    const [{ data: dbHistory, error: historyError }, { data: dbCapabilities, error: capError }] = await Promise.all([
      supabase.from("bid_history").select("*"),
      supabase.from("capability_library").select("*"),
    ]);

    if (!historyError && dbHistory?.length) bidHistory = dbHistory;
    if (!capError && dbCapabilities?.length) capabilities = dbCapabilities;

    if (!bidHistory.length || !capabilities.length) {
      const dataset = loadHackathonDataset();
      mode = "sample_mode";
      if (!bidHistory.length) bidHistory = dataset.bidHistory;
      if (!capabilities.length) capabilities = dataset.capabilityLibrary;
    }

    const scores = calculateWinScore({
      requirements: requirements.map(normalizeRequirement),
      capabilities,
      bidHistory,
      rawText: rawText || workspaceRawText,
    });

    let record = null;
    if (workspaceId && isUuid(workspaceId)) {
      const { data: savedScore, error: dbError } = await supabase
        .from("win_scores")
        .upsert({
          workspace_id: workspaceId,
          total_score: scores.total_score,
          budget_alignment: scores.budget_alignment,
          capability_match: scores.capability_match,
          compliance_score: scores.compliance_score,
          sector_win_rate: scores.sector_win_rate,
          similar_experience_score: scores.similar_experience_score,
          evaluation_history_score: scores.evaluation_history_score,
          technical_history_score: scores.technical_history_score,
          commercial_history_score: scores.commercial_history_score,
          strategic_fit_score: scores.strategic_fit_score,
          risk_penalty_score: scores.risk_penalty_score,
          decision: scores.decision,
        }, { onConflict: "workspace_id" })
        .select()
        .single();

      if (dbError) throw dbError;
      record = savedScore;
    }

    return NextResponse.json({
      success: true,
      mode,
      workspaceId,
      scores,
      record: record || {
        total_score: scores.total_score,
        budget_alignment: scores.budget_alignment,
        capability_match: scores.capability_match,
        compliance_score: scores.compliance_score,
        sector_win_rate: scores.sector_win_rate,
        similar_experience_score: scores.similar_experience_score,
        evaluation_history_score: scores.evaluation_history_score,
        technical_history_score: scores.technical_history_score,
        commercial_history_score: scores.commercial_history_score,
        strategic_fit_score: scores.strategic_fit_score,
        risk_penalty_score: scores.risk_penalty_score,
        decision: scores.decision,
        mandatory_total: scores.mandatory_total,
        mandatory_passed: scores.mandatory_passed,
        mandatory_partial: scores.mandatory_partial,
        mandatory_failed: scores.mandatory_failed,
      },
      history_count: bidHistory.length,
      capability_count: capabilities.length,
    }, { status: 200 });
  } catch (err) {
    console.error("Error inside scoring router:", err);
    return NextResponse.json(
      { success: false, mode: "sample_mode_unavailable", error: "Forecast win scoring error: " + err.message },
      { status: 500 }
    );
  }
}
