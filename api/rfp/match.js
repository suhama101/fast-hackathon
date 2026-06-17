import { CAPABILITY_LIBRARY } from "../../bid-engine/lib/sampleData.js";
import { buildCapabilityIndex, retrieveCapabilityEvidence } from "../../bid-engine/lib/ragEngine.js";
import { inferRequirementMetadata } from "../../bid-engine/lib/intelligence.js";
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
  compliance_status: req.compliance_status || "partial",
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = readBody(req);
    const { workspaceId, requirements: clientRequirements = [], entities: clientEntities = null } = body;
    const auth = await requireAuthenticatedUser(req);
    if (auth.errorResponse) return res.status(auth.errorResponse.status).json(auth.errorResponse.body);

    const { supabase, user } = auth;
    const workspaceDb = getSupabaseAdminOrNull() || supabase;
    let mode = "dataset";
    let requirements = [];
    let capabilities = [];

    if (workspaceId && isUuid(workspaceId)) {
      const ownership = await requireWorkspaceOwner(req, workspaceId);
      if (ownership.errorResponse) return res.status(ownership.errorResponse.status).json(ownership.errorResponse.body);

      const { data: dbRequirements, error: reqError } = await workspaceDb
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
      return res.status(200).json({
        success: true,
        mode,
        message: "No requirements found. Run extraction first.",
        matches: [],
        requirements: [],
      });
    }

    const { data: dbCapabilities, error: capError } = await workspaceDb
      .from("capability_library")
      .select("*")
      .eq("user_id", user.id);

    if (!capError && dbCapabilities?.length) {
      capabilities = dbCapabilities;
    } else {
      mode = "sample_mode";
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

    const capabilityIndex = buildCapabilityIndex(capabilities);

    const matches = [];
    for (const [index, requirement] of requirements.entries()) {
      const normalized = normalizeRequirement(requirement, index);
      const requirementMeta = inferRequirementMetadata(
        normalized.requirement_text,
        normalized.source_section || "",
        normalized.requirement_text
      );
      const evidence = await retrieveCapabilityEvidence(
        { ...normalized, category: requirementMeta.category },
        capabilityIndex,
        { topK: 3, entities: entityContext }
      );
      matches.push({
        requirement_id: normalized.id,
        requirement_text: normalized.requirement_text,
        compliance_status: evidence.compliance_status,
        confidence_score: evidence.confidence_score,
        evidence: evidence.evidence,
        reasoning: evidence.reason,
        match_status: evidence.match_status,
        match_score: evidence.match_score,
        evidence_items: evidence.evidence_items || [],
        source_references: evidence.source_references || [],
        matched_terms: evidence.matched_terms || [],
      });
    }

    if (workspaceId && isUuid(workspaceId)) {
      const updateResults = await Promise.all(matches.map((match) =>
        workspaceDb
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
      const updateError = updateResults.find((result) => result.error)?.error;
      if (updateError) {
        throw new Error(`Failed to save compliance match results: ${updateError.message}`);
      }

      await workspaceDb.from("ai_decision_trace").insert(
        matches.map((match) => ({
          workspace_id: workspaceId,
          requirement_id: match.requirement_id,
          requirement_text: match.requirement_text,
          evidence_document_id: match.traceability?.approved_evidence?.id || null,
          evidence_text: match.evidence,
          rerank_score: match.match_score,
          compliance_status: match.compliance_status,
          trace: match.traceability || {},
        }))
      );
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
        evidence_items: match?.evidence_items || [],
        match_status: match?.match_status || "No Match",
      };
    });

    return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      mode: "sample_mode_unavailable",
      error: "Matching system encountered error: " + err.message,
    });
  }
}
