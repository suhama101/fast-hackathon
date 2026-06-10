import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseClient";
import { loadHackathonDataset } from "../../../../lib/datasetLoader";
import { calculateWinScore } from "../../../../lib/datasetAnalysis";

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
    const supabase = getSupabaseAdmin();
    let mode = "dataset";
    let requirements = [];
    let bidHistory = [];
    let capabilities = [];

    if (workspaceId && !String(workspaceId).startsWith("ws-trial")) {
      const { data: dbRequirements, error: reqError } = await supabase
        .from("rfp_requirements")
        .select("*")
        .eq("workspace_id", workspaceId);
      if (reqError) throw reqError;
      requirements = dbRequirements || [];
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
      rawText,
    });

    let record = null;
    if (workspaceId && !String(workspaceId).startsWith("ws-trial")) {
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
        decision: scores.decision,
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
