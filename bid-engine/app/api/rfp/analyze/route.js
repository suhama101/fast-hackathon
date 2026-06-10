import { NextResponse } from "next/server";
import { analyzeWithGroq } from "../../../../lib/groqClient";
import { getSupabaseAdmin } from "../../../../lib/supabaseClient";
import { loadHackathonDataset } from "../../../../lib/datasetLoader";

const localExtract = (rawText) => {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);

  const mandatory = lines.filter((line) => /\b(must|shall|required|mandatory|compliance|certification|sla|encryption)\b/i.test(line)).slice(0, 8);
  const questions = lines.filter((line) => /\?|question\s+[a-z0-9]/i.test(line)).slice(0, 8);
  const evaluation = lines.filter((line) => /\b(weight|score|criteria|evaluation|technical|pricing|commercial)\b/i.test(line)).slice(0, 8);
  const deadline = String(rawText).match(/\b(?:deadline|submission).*?(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i)?.[1] || "";
  const budget = String(rawText).match(/\b(?:budget|estimate|value|cost).*?(PKR|USD|\$)?\s?[\d,.]+\s?[MK]?/i)?.[0] || "";

  return {
    mandatory_requirements: mandatory.length ? mandatory : lines.slice(0, 4),
    evaluation_criteria: evaluation,
    submission_deadline: deadline,
    budget_range: budget,
    question_sections: questions,
    compliance_clauses: mandatory.filter((line) => /certification|compliance|security|audit|iso|soc/i.test(line)),
  };
};

const toRequirementRows = (extractedData, workspaceId = null) => {
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
  (extractedData.evaluation_criteria || []).forEach((item) => addRow(item, "evaluation", "Evaluation Metric"));
  (extractedData.question_sections || []).forEach((item) => addRow(item, "mandatory", "Question Section"));
  if (extractedData.submission_deadline) addRow(`Submission Deadline Target: ${extractedData.submission_deadline}`, "deadline", String(extractedData.submission_deadline));
  if (extractedData.budget_range) addRow(`Project Budget Range: ${extractedData.budget_range}`, "evaluation", String(extractedData.budget_range));
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

    const isTrialWorkspace = givenWorkspaceId && String(givenWorkspaceId).startsWith("ws-trial");
    if (isTrialWorkspace) {
      const dataset = loadHackathonDataset();
      const extracted = localExtract(rawText);
      const requirements = toRequirementRows(extracted).map((row, index) => ({
        id: `REQ-${String(index + 1).padStart(3, "0")}`,
        ...row,
      }));

      return NextResponse.json({
        success: true,
        mode: "sample_mode",
        workspaceId: givenWorkspaceId,
        extracted,
        requirements,
        dataset_counts: {
          capability_library: dataset.capabilityLibrary.length,
          bid_history: dataset.bidHistory.length,
          evaluation_criteria_taxonomy: dataset.evaluationCriteria.length,
        },
      });
    }

    const supabase = getSupabaseAdmin();
    let workspaceId = givenWorkspaceId;

    // 1. Create a workspace or find the existing one if not provided
    if (!workspaceId) {
      const bidTitle = givenBidTitle || `Corporate RFP Analysis Session - ${new Date().toLocaleDateString()}`;
      const { data: newWorkspace, error: workspaceError } = await supabase
        .from("rfp_workspaces")
        .insert({
          title: bidTitle,
          status: "analyzing"
        })
        .select()
        .single();

      if (workspaceError) {
        throw new Error(`Failed to provision RFP Workspace in Supabase: ${workspaceError.message}`);
      }
      workspaceId = newWorkspace.id;
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

    // 3. Prepare requirements structure to populate database
    const rowsToInsert = toRequirementRows(extractedData, workspaceId);

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
        .update({ status: "draft_ready" })
        .eq("id", workspaceId);

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
