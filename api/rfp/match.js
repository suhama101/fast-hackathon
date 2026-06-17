import { CAPABILITY_LIBRARY } from "../../bid-engine/lib/sampleData.js";
import { buildCapabilityIndex, retrieveCapabilityEvidence, syncCapabilityCorpus } from "../../bid-engine/lib/ragEngine.js";
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
    let ragSeedStats = null;

    try {
      ragSeedStats = await syncCapabilityCorpus(capabilityIndex);
      if (capabilityIndex.length > 0 && Number(ragSeedStats.finalRows || ragSeedStats.existingRows || 0) === 0) {
        throw new Error("RAG corpus is empty after automatic seeding.");
      }
    } catch (seedError) {
      console.error("[RAG ERROR] Automatic corpus seeding failed before Compliance Check.", {
        capability_count: capabilityIndex.length,
        error: seedError.message,
      });
      return res.status(500).json({
        success: false,
        mode,
        workspaceId,
        error: `RAG corpus seeding failed: ${seedError.message}`,
        rag_error: seedError.message,
        rag_warning: "Compliance Check stopped because vector corpus seeding failed.",
        capability_count: capabilityIndex.length,
      });
    }

    const matches = [];
    const ragWarnings = [];
    const matchingDebug = [];
    for (const [index, requirement] of requirements.entries()) {
      const normalized = normalizeRequirement(requirement, index);
      const requirementMeta = inferRequirementMetadata(
        normalized.requirement_text,
        normalized.source_section || "",
        normalized.requirement_text
      );

      if (requirementMeta.needs_evidence === false) {
        const acknowledgement = {
          requirement_id: normalized.id,
          requirement_text: normalized.requirement_text,
          compliance_status: "partial",
          confidence_score: 0,
          evidence: "Acknowledgement/declaration requirement. No capability evidence attached.",
          selected_evidence: "",
          retrieved_chunks: [],
          reasoning: "RAG skipped because this requirement does not require capability evidence.",
          match_status: "Partial Match",
          match_score: 0,
          evidence_items: [],
          source_references: [],
          matched_terms: [],
          needs_evidence: false,
          vector_search_used: false,
          fallback_used: false,
          traceability: {
            query: normalized.requirement_text,
            approved_evidence: null,
            rejected_candidates: [],
            needs_evidence: false,
          },
        };
        matches.push(acknowledgement);
        matchingDebug.push({
          requirement: normalized.requirement_text,
          needs_evidence: false,
          retrieved_count: 0,
          selected_evidence: "",
          match_status: acknowledgement.match_status,
          reason: acknowledgement.reasoning,
        });
        continue;
      }

      const evidence = await retrieveCapabilityEvidence(
        { ...normalized, category: requirementMeta.category },
        capabilityIndex,
        { topK: 3, entities: entityContext }
      );

      if (evidence.rag_warning) {
        ragWarnings.push({
          requirement_id: normalized.id,
          requirement_text: normalized.requirement_text,
          warning: evidence.rag_warning,
          details: evidence.rag_details || {},
        });
      }

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
        retrieved_chunks: evidence.retrieved_chunks || [],
        selected_evidence: evidence.selected_evidence || evidence.matched_evidence || evidence.evidence || "",
        source_references: evidence.source_references || [],
        matched_terms: evidence.matched_terms || [],
        needs_evidence: true,
        vector_search_used: !evidence.rag_warning,
        fallback_used: false,
        rag_warning: evidence.rag_warning || null,
        rag_details: evidence.rag_details || null,
        embedding_provider: evidence.embedding_provider || capabilityIndex[0]?.embedding_provider || "unconfigured",
        vector_dimensions: evidence.vector_dimensions || capabilityIndex[0]?.vector_dimensions || 1536,
        average_similarity_score: evidence.average_similarity_score || 0,
        retrieval_confidence_score: evidence.retrieval_confidence_score || 0,
        retrieval_quality_improvement: evidence.retrieval_quality_improvement || null,
        traceability: evidence.traceability || null,
      });
      matchingDebug.push({
        requirement: normalized.requirement_text,
        needs_evidence: true,
        retrieved_count: evidence.retrieved_chunks?.length || evidence.evidence_items?.length || 0,
        selected_evidence: evidence.selected_evidence || evidence.matched_evidence || evidence.evidence || "",
        match_status: evidence.match_status,
        average_similarity_score: evidence.average_similarity_score || 0,
        retrieval_confidence_score: evidence.retrieval_confidence_score || 0,
        reason: evidence.reason,
      });
    }

    if (ragWarnings.length > 0) {
      console.warn("[RAG WARNING] Compliance Check completed with RAG warnings.", {
        warning_count: ragWarnings.length,
        first_warning: ragWarnings[0],
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
        retrieved_chunks: match?.retrieved_chunks || [],
        selected_evidence: match?.selected_evidence || "",
        match_status: match?.match_status || "No Match",
        needs_evidence: match?.needs_evidence !== false,
        average_similarity_score: match?.average_similarity_score || 0,
        retrieval_confidence_score: match?.retrieval_confidence_score || 0,
        rag_warning: match?.rag_warning || null,
      };
    });

    const evidenceMatches = matches.filter((match) => match.needs_evidence !== false);
    const averageSimilarityScore = Number((
      evidenceMatches.reduce((sum, match) => sum + Number(match.average_similarity_score || 0), 0)
      / Math.max(1, evidenceMatches.length)
    ).toFixed(4));

    return res.status(200).json({
      success: true,
      mode,
      workspaceId,
      matches,
      requirements: requirementsWithMatches,
      capability_count: capabilities.length,
      rag_seed: ragSeedStats,
      extracted_entities: entityContext,
      matching_debug: matchingDebug,
      rag_debug: {
        rag_status: ragWarnings.length ? "NOT_READY" : "ACTIVE",
        capability_rows: capabilities.length,
        evidence_rows_before: ragSeedStats?.existingRows ?? null,
        evidence_rows_after: ragSeedStats?.finalRows ?? ragSeedStats?.existingRows ?? null,
        embedding_provider: ragSeedStats?.embeddingProvider || capabilityIndex[0]?.embedding_provider || "unconfigured",
        embedding_model: ragSeedStats?.embeddingModel || capabilityIndex[0]?.embedding_model || "none",
        vector_dimensions: ragSeedStats?.vectorDimensions || capabilityIndex[0]?.vector_dimensions || 1536,
        chunks_created: ragSeedStats?.documentsChunked || 0,
        vector_search_used: matches.some((match) => match.vector_search_used),
        average_similarity_score: averageSimilarityScore,
        retrieval_quality_improvement: matches.find((match) => match.retrieval_quality_improvement)?.retrieval_quality_improvement || null,
        fallback_used: false,
      },
      rag_warning: ragWarnings.length
        ? "RAG corpus is empty or unavailable for at least one requirement. See rag_warnings."
        : null,
      rag_warnings: ragWarnings,
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
