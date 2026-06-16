import { NextResponse } from "next/server";
import { analyzeWithGroq } from "../../../../lib/groqClient";
import { loadHackathonDataset } from "../../../../lib/datasetLoader";
import { mapCriteriaToTaxonomy } from "../../../../lib/datasetAnalysis";
import {
  buildRequirementId,
  extractSectionAwareRequirements,
  flattenModelRequirements,
  mergeRequirementCandidates,
  toDbRequirementType,
} from "../../../../lib/intelligence.js";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "../../../../lib/requestAuth";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const buildRequirementRows = (requirements = [], workspaceId) =>
  requirements.map((requirement) => ({
    workspace_id: workspaceId,
    requirement_text: requirement.requirement,
    requirement_type: toDbRequirementType(requirement.category),
    compliance_status: "partial",
    extracted_value: requirement.source_text || requirement.requirement,
  }));

const countByCategory = (requirements = []) =>
  requirements.reduce((accumulator, requirement) => {
    const key = requirement.category || "Unknown";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

export async function POST(request) {
  try {
    const { rawText, workspaceId: givenWorkspaceId, bidTitle: givenBidTitle } = await request.json();

    if (!rawText) {
      return NextResponse.json({ error: "No RFP textual content provided for analysis." }, { status: 400 });
    }
    if (givenWorkspaceId && !isUuid(givenWorkspaceId)) {
      return NextResponse.json({ error: "workspaceId must be a valid Supabase UUID." }, { status: 400 });
    }

    const auth = await requireAuthenticatedUser(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { supabase, user } = auth;
    let workspaceId = givenWorkspaceId;

    if (!workspaceId) {
      const bidTitle = givenBidTitle || `RFP Analysis - ${new Date().toLocaleDateString()}`;
      const { data: newWorkspace, error: workspaceError } = await supabase
        .from("rfp_workspaces")
        .insert({ user_id: user.id, title: bidTitle, status: "analyzing", raw_text: rawText })
        .select().single();
      if (workspaceError) throw new Error(`Failed to provision RFP Workspace: ${workspaceError.message}`);
      workspaceId = newWorkspace.id;
    } else {
      const workspaceCheck = await requireWorkspaceOwner(request, workspaceId);
      if (workspaceCheck.errorResponse) return workspaceCheck.errorResponse;
    }

    const systemPrompt = "You are an expert procurement analyst. Extract requirements from RFP documents in JSON format only.";

    const extractionPrompt = `You are an expert procurement analyst.
Analyze this RFP document and extract INDIVIDUAL requirements.

CRITICAL RULES:
- Each requirement must be ONE specific, actionable item
- Maximum 150 characters per requirement
- Do NOT include entire paragraphs as one requirement
- Do NOT include section headings
- Do NOT include questions from Q&A sections
- Extract ONLY clear requirements and obligations

Return JSON using arrays of short strings for all relevant fields:
{
  "mandatory_requirements": [],
  "eligibility_criteria": [],
  "prequalification_criteria": [],
  "required_documents": [],
  "technical_requirements": [],
  "technical_proposal_requirements": [],
  "financial_requirements": [],
  "financial_proposal_requirements": [],
  "evaluation_criteria": [],
  "scoring_weights": [],
  "questions_to_answer": [],
  "question_answer_sections": [],
  "deliverables": [],
  "payment_schedule": [],
  "contract_validity": [],
  "proposal_validity": [],
  "consortium_requirements": [],
  "conflict_of_interest_requirements": [],
  "related_party_disclosure_requirements": [],
  "anti_fraud_corruption_requirements": [],
  "blacklisting_undertaking": [],
  "ntn_tax_registration_requirements": [],
  "local_partner_requirements": [],
  "submission_instructions": [],
  "page_limits": [],
  "hard_copy_submission_rules": [],
  "soft_copy_submission_rules": [],
  "submission_details": [],
  "deadlines": [],
  "compliance_clauses": []
}

RFP TEXT:
${rawText.substring(0, 9000)}`;

    const extractedData = await analyzeWithGroq(extractionPrompt, systemPrompt);
    if (!extractedData || extractedData.error) {
      throw new Error(extractedData?.message || "Groq extraction failed.");
    }

    const { data: dbTaxonomy, error: taxonomyError } = await supabase
      .from("evaluation_criteria_taxonomy").select("*");
    const fallbackTaxonomy = loadHackathonDataset().evaluationCriteria;
    const taxonomy = !taxonomyError && dbTaxonomy?.length ? dbTaxonomy : fallbackTaxonomy;

    const llmRequirements = flattenModelRequirements(extractedData);
    const heuristicRequirements = extractSectionAwareRequirements(rawText);
    const taxonomyRequirements = mapCriteriaToTaxonomy(extractedData.evaluation_criteria || [], taxonomy).map((item) => ({
      requirement: item.source_text || item.criteria_name,
      category: "Evaluation",
      priority: item.weight_percentage ? "Important" : "Standard",
      source_section: `Taxonomy: ${item.criteria_name}`,
      source_page: null,
      source_text: item.source_text || item.criteria_name,
      needs_evidence: true,
      expected_evidence_type: "Methodology",
    }));

    const mergedRequirements = mergeRequirementCandidates(
      llmRequirements,
      heuristicRequirements,
      taxonomyRequirements
    ).map((requirement, index) => ({
      id: buildRequirementId(index),
      requirement: requirement.requirement,
      requirement_text: requirement.requirement,
      category: requirement.category,
      priority: requirement.priority,
      source_section: requirement.source_section,
      source_page: requirement.source_page,
      source_text: requirement.source_text,
      needs_evidence: requirement.needs_evidence,
      expected_evidence_type: requirement.expected_evidence_type,
      requirement_type: toDbRequirementType(requirement.category),
      compliance_status: "partial",
    }));

    const finalRequirements = mergedRequirements.slice(0, 80);
    const rawRows = buildRequirementRows(finalRequirements, workspaceId);

    if (rawRows.length === 0) {
      return NextResponse.json({
        success: true,
        workspaceId,
        extracted: extractedData,
        requirements: [],
        diagnostics: { total_requirements: 0, category_counts: {} },
        count: 0,
      });
    }

    const { data: insertedRequirements, error: insertError } = await supabase
      .from("rfp_requirements").insert(rawRows).select();

    if (insertError) {
      console.error("Supabase requirement insertion fault:", insertError);
      throw new Error(`Failed to commit extracted criteria to database: ${insertError.message}`);
    }

    await supabase
      .from("rfp_workspaces")
      .update({ status: "draft_ready", updated_at: new Date().toISOString() })
      .eq("id", workspaceId)
      .eq("user_id", user.id);

    const diagnostics = {
      total_requirements: finalRequirements.length,
      category_counts: countByCategory(finalRequirements),
    };

    return NextResponse.json({
      success: true,
      workspaceId,
      extracted: extractedData,
      requirements: finalRequirements.map((item, index) => ({
        id: item.id || buildRequirementId(index),
        requirement: item.requirement,
        requirement_text: item.requirement_text,
        category: item.category,
        priority: item.priority,
        source_section: item.source_section,
        source_page: item.source_page,
        source_text: item.source_text,
        needs_evidence: item.needs_evidence,
        expected_evidence_type: item.expected_evidence_type,
        requirement_type: item.requirement_type,
        compliance_status: item.compliance_status,
      })),
      inserted_requirements: insertedRequirements,
      diagnostics,
      count: insertedRequirements.length,
    });
  } catch (err) {
    console.error("Critical failure during RFP analysis route:", err);
    return NextResponse.json({ error: "RFP Analysis system error: " + err.message }, { status: 500 });
  }
}
