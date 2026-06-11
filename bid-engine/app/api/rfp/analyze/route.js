import { NextResponse } from "next/server";
import { analyzeWithGroq } from "../../../../lib/groqClient";
import { loadHackathonDataset } from "../../../../lib/datasetLoader";
import { extractEntitiesFromText, mapCriteriaToTaxonomy } from "../../../../lib/datasetAnalysis";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "../../../../lib/requestAuth";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const toRequirementRows = (extractedData, workspaceId = null, taxonomyMappings = [], entities = {}) => {
  const rowsToInsert = [];
  const addRow = (text, type, value) => {
    const cleanText = typeof text === "string" ? text.trim() : JSON.stringify(text);
    if (!cleanText) return;
    rowsToInsert.push({
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
      requirement_text: cleanText,
      requirement_type: type,
      compliance_status: "partial",
      extracted_value: value,
    });
  };

  (extractedData.mandatory_requirements || []).forEach((item) => addRow(item, "mandatory", "Mandatory Core"));
  (extractedData.compliance_clauses || []).forEach((item) => addRow(item, "mandatory", "Compliance Clause"));
  taxonomyMappings.forEach((item) => {
    addRow(
      `${item.source_text} [Mapped Taxonomy: ${item.criteria_name}; Sector: ${item.sector}; Weight: ${item.weight_percentage ?? "N/A"}%]`,
      "evaluation",
      `Taxonomy: ${item.criteria_name} | ${item.sector} | ${item.weight_percentage ?? "N/A"}%`
    );
  });
  if (taxonomyMappings.length === 0) {
    (extractedData.evaluation_criteria || []).forEach((item) => addRow(item, "evaluation", "Evaluation Metric"));
  }
  (extractedData.question_sections || []).forEach((item) => addRow(item, "mandatory", "Question Section"));
  if (extractedData.submission_deadline) addRow(`Submission Deadline Target: ${extractedData.submission_deadline}`, "deadline", String(extractedData.submission_deadline));
  if (extractedData.budget_range) addRow(`Project Budget Range: ${extractedData.budget_range}`, "evaluation", String(extractedData.budget_range));
  (entities.deadlines || []).forEach((item) => addRow(`NER Deadline Detected: ${item}`, "deadline", item));
  (entities.budgets || []).forEach((item) => addRow(`NER Budget Detected: ${item}`, "evaluation", item));
  (entities.mandatory_clauses || []).forEach((item) => addRow(item, "mandatory", "NER Mandatory Clause"));
  return rowsToInsert;
};

export async function POST(request) {
  try {
    const { rawText, workspaceId: givenWorkspaceId, bidTitle: givenBidTitle } = await request.json();

    if (!rawText) {
      return NextResponse.json(
        { error: "No RFP textual content provided for analysis." },
        { status: 400 }
      );
    }

    if (givenWorkspaceId && !isUuid(givenWorkspaceId)) {
      return NextResponse.json(
        { error: "workspaceId must be a valid Supabase UUID." },
        { status: 400 }
      );
    }

    const auth = await requireAuthenticatedUser(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { supabase, user } = auth;
    let workspaceId = givenWorkspaceId;
    const entities = extractEntitiesFromText(rawText);

    // 1. Create a workspace or find the existing one if not provided
    if (!workspaceId) {
      const bidTitle = givenBidTitle || `Corporate RFP Analysis Session - ${new Date().toLocaleDateString()}`;
      const { data: newWorkspace, error: workspaceError } = await supabase
        .from("rfp_workspaces")
        .insert({
          user_id: user.id,
          title: bidTitle,
          status: "analyzing",
          raw_text: rawText || null,
        })
        .select()
        .single();

      if (workspaceError) {
        throw new Error(`Failed to provision RFP Workspace in Supabase: ${workspaceError.message}`);
      }
      workspaceId = newWorkspace.id;
    } else {
      const workspaceCheck = await requireWorkspaceOwner(request, workspaceId);
      if (workspaceCheck.errorResponse) return workspaceCheck.errorResponse;
    }

    // 2. Build Groq AI analysis
    const systemPrompt = "You are an expert procurement analyst. Extract requirements from RFP documents in JSON format only.";
    const userPrompt = `Analyze this RFP document and extract:
1. mandatory_requirements: list of must-have requirements
2. evaluation_criteria: list with weight percentages
3. submission_deadline: date if mentioned
4. budget_range: budget if mentioned
5. question_sections: list of questions to answer
6. compliance_clauses: legal/certification requirements

Return ONLY valid JSON.

RFP TEXT:
${rawText.slice(0, 18000)}`;

    const extractedData = await analyzeWithGroq(userPrompt, systemPrompt);
    const { data: dbTaxonomy, error: taxonomyError } = await supabase
      .from("evaluation_criteria_taxonomy")
      .select("*");
    const fallbackTaxonomy = loadHackathonDataset().evaluationCriteria;
    const taxonomy = !taxonomyError && dbTaxonomy?.length ? dbTaxonomy : fallbackTaxonomy;
    const taxonomyMappings = mapCriteriaToTaxonomy(extractedData.evaluation_criteria || [], taxonomy);
    extractedData.extracted_entities = entities;
    extractedData.taxonomy_mappings = taxonomyMappings;

    // 3. Prepare requirements structure to populate database
    const rowsToInsert = toRequirementRows(extractedData, workspaceId, taxonomyMappings, entities);

    // 4. Save rows to Supabase database
    if (rowsToInsert.length > 0) {
      // Modify compatibility state
      const databaseRows = rowsToInsert.map(row => ({
        ...row,
        // Match Supabase schema check requirements (compliance_status must be 'pass', 'fail', or 'partial')
        compliance_status: "partial"
      }));

      const { data: insertedRequirements, error: insertError } = await supabase
        .from("rfp_requirements")
        .insert(databaseRows)
        .select();

      if (insertError) {
        console.error("Supabase requirement insertion fault:", insertError);
        throw new Error(`Failed to commit extracted criteria to database: ${insertError.message}`);
      }

      // Update workspace status to ready
      await supabase
        .from("rfp_workspaces")
        .update({ status: "draft_ready", updated_at: new Date().toISOString() })
        .eq("id", workspaceId)
        .eq("user_id", user.id);

      return NextResponse.json({
        success: true,
        workspaceId,
        extracted: extractedData,
        requirements: insertedRequirements
      });
    }

    return NextResponse.json({
      success: true,
      workspaceId,
      extracted: extractedData,
      requirements: []
    });

  } catch (err) {
    console.error("Critical failure during RFP analysis route:", err);
    return NextResponse.json(
      { error: "RFP Analysis system error: " + err.message },
      { status: 500 }
    );
  }
}
