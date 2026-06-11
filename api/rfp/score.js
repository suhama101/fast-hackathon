import { calculateWinScore } from "../../bid-engine/lib/datasetAnalysis.js";
import { CAPABILITY_LIBRARY, BID_HISTORY } from "../../bid-engine/lib/sampleData.js";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "../_lib/requestAuth.js";
import { getSupabaseAdminOrNull } from "../_lib/supabase.js";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const readBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
};

const normalizeRequirement = (req, index = 0) => ({
  id: req.id || `REQ-${String(index + 1).padStart(3, "0")}`,
  requirement_text: req.requirement_text || req.description || req.title || "",
  requirement_type: req.requirement_type || "mandatory",
  compliance_status: req.compliance_status || req.status || "partial",
  extracted_value: req.extracted_value || "",
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = readBody(req);
    const { workspaceId, requirements: clientRequirements = [], rawText = "" } = body;
    const auth = await requireAuthenticatedUser(req);
    if (auth.errorResponse) return res.status(auth.errorResponse.status).json(auth.errorResponse.body);

    const { supabase, user } = auth;
    const workspaceDb = getSupabaseAdminOrNull() || supabase;
    let mode = "dataset";
    let requirements = [];
    let bidHistory = [];
    let capabilities = [];
    let workspaceRawText = "";

    if (workspaceId && isUuid(workspaceId)) {
      const ownership = await requireWorkspaceOwner(req, workspaceId);
      if (ownership.errorResponse) return res.status(ownership.errorResponse.status).json(ownership.errorResponse.body);

      const [{ data: dbRequirements, error: reqError }, { data: workspace, error: workspaceError }] = await Promise.all([
        workspaceDb
          .from("rfp_requirements")
          .select("*")
          .eq("workspace_id", workspaceId),
        workspaceDb
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
      workspaceDb.from("bid_history").select("*"),
      workspaceDb.from("capability_library").select("*").eq("user_id", user.id),
    ]);

    if (!historyError && dbHistory?.length) bidHistory = dbHistory;
    if (!capError && dbCapabilities?.length) capabilities = dbCapabilities;

    if (!bidHistory.length) bidHistory = BID_HISTORY.map((item) => ({
      bid_id: item.bid_id,
      client: item.title || "Sample Client",
      sector: item.sector,
      budget: "",
      score_percent: item.match_score,
      outcome: item.outcome,
      response_time_hrs: null,
      compliance_percent: item.compliance_score,
      doc_pages: null,
      gaps_found: null,
      bid_manager: "Sample Manager",
      submission_date: null,
      competitor_presence: item.outcome === "win" ? "Medium" : "High",
      incumbent_vendor: item.outcome === "win" ? "No" : "Unknown",
      technical_score: item.match_score,
      commercial_score: item.budget_alignment,
      risk_score: item.outcome === "win" ? 18 : 42,
      strategic_fit_score: Math.round((item.match_score + item.compliance_score) / 2),
    }));

    if (!capabilities.length) {
      capabilities = CAPABILITY_LIBRARY.map((item) => ({
        external_id: item.id,
        domain: item.skills?.[0] || item.client_type || "General",
        project_name: item.project_name,
        description: item.description,
        project_summary: item.description,
        certification: item.certifications?.join(", ") || "N/A",
        certifications: item.certifications || [],
        skills: item.skills || [],
        year_completed: item.year_completed,
        contract_value: item.contract_value,
        duration_months: null,
        client_type: item.client_type,
      }));
    }

    const scores = calculateWinScore({
      requirements: requirements.map(normalizeRequirement),
      capabilities,
      bidHistory,
      rawText: rawText || workspaceRawText,
    });

    let record = null;
    if (workspaceId && isUuid(workspaceId)) {
      const { data: savedScore, error: dbError } = await workspaceDb
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

    return res.status(200).json({
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
      },
      history_count: bidHistory.length,
      capability_count: capabilities.length,
    });
  } catch (err) {
    console.error("Error inside scoring router:", err);
    return res.status(500).json({
      success: false,
      mode: "sample_mode_unavailable",
      error: "Forecast win scoring error: " + err.message,
    });
  }
}
