import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseClient";
import { loadHackathonDataset } from "../../../../lib/datasetLoader";
import { matchRequirementToCapabilities } from "../../../../lib/datasetAnalysis";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const normalizeRequirement = (req, index = 0) => ({
  id: req.id || `REQ-${String(index + 1).padStart(3, "0")}`,
  requirement_text: req.requirement_text || req.description || req.title || "",
  requirement_type: req.requirement_type || "mandatory",
  compliance_status: req.compliance_status || "partial",
});

export async function POST(request) {
  try {
    const { workspaceId, requirements: clientRequirements = [], entities: clientEntities = null } = await request.json();
    const supabase = getSupabaseAdmin();
    let mode = "dataset";
    let requirements = [];
    let capabilities = [];

    if (workspaceId && isUuid(workspaceId)) {
      const { data: dbRequirements, error: reqError } = await supabase
        .from("rfp_requirements")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (reqError) throw reqError;
      requirements = dbRequirements || [];
    }

    if (requirements.length === 0 && clientRequirements.length > 0) {
      mode = "sample_mode";
      requirements = clientRequirements.map(normalizeRequirement);
    }

    if (requirements.length === 0) {
      return NextResponse.json({
        success: true,
        mode,
        message: "No requirements found. Run extraction first.",
        matches: [],
        requirements: [],
      });
    }

    const { data: dbCapabilities, error: capError } = await supabase
      .from("capability_library")
      .select("*");

    if (!capError && dbCapabilities?.length) {
      capabilities = dbCapabilities;
    } else {
      const dataset = loadHackathonDataset();
      mode = "sample_mode";
      capabilities = dataset.capabilityLibrary;
    }

    const entityContext = clientEntities || {
      deadlines: requirements
        .filter((req) => req.requirement_type === "deadline")
        .map((req) => req.extracted_value || req.requirement_text)
        .filter(Boolean),
      budgets: requirements
        .filter((req) => /\bbudget|pkr|usd|\$|rs\.?/i.test(`${req.extracted_value || ""} ${req.requirement_text || ""}`))
        .map((req) => req.extracted_value || req.requirement_text)
        .filter(Boolean),
      mandatory_clauses: requirements
        .filter((req) => req.requirement_type === "mandatory")
        .map((req) => req.requirement_text)
        .filter(Boolean)
        .slice(0, 10),
    };

    const matches = requirements.map((requirement, index) => {
      const normalized = normalizeRequirement(requirement, index);
      const match = matchRequirementToCapabilities(normalized, capabilities, { entities: entityContext });
      return {
        requirement_id: normalized.id,
        requirement_text: normalized.requirement_text,
        compliance_status: match.compliance_status,
        confidence_score: match.confidence,
        evidence: match.evidence,
        reasoning: match.reasoning,
      };
    });

    if (workspaceId && isUuid(workspaceId)) {
      await Promise.all(matches.map((match) =>
        supabase
          .from("rfp_requirements")
          .update({
            compliance_status: match.compliance_status,
            extracted_value: match.evidence,
            matched_evidence: match.evidence,
            match_confidence: match.confidence_score,
            match_reasoning: match.reasoning,
          })
          .eq("id", match.requirement_id)
          .eq("workspace_id", workspaceId)
      ));
    }

    const requirementsWithMatches = requirements.map((requirement, index) => {
      const normalized = normalizeRequirement(requirement, index);
      const match = matches.find((item) => item.requirement_id === normalized.id);
      return {
        ...requirement,
        compliance_status: match?.compliance_status || "partial",
        matched_evidence: match?.evidence,
        match_confidence: match?.confidence_score,
        match_reasoning: match?.reasoning,
      };
    });

    return NextResponse.json({
      success: true,
      mode,
      workspaceId,
      matches,
      requirements: requirementsWithMatches,
      capability_count: capabilities.length,
      extracted_entities: entityContext,
    });
  } catch (err) {
    console.error("Failure in matching route:", err);
    return NextResponse.json(
      { success: false, mode: "sample_mode_unavailable", error: "Matching system encountered error: " + err.message },
      { status: 500 }
    );
  }
}
