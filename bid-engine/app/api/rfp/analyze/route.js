import { NextResponse } from "next/server";
import { analyzeWithGroq } from "../../../../lib/groqClient";
import { getSupabaseAdmin } from "../../../../lib/supabaseClient";

export async function POST(request) {
  try {
    const { rawText, workspaceId: givenWorkspaceId, bidTitle: givenBidTitle } = await request.json();

    if (!rawText) {
      return NextResponse.json(
        { error: "No RFP textual content provided for analysis." },
        { status: 400 }
      );
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
    const rowsToInsert = [];

    // Map mandatory requirements
    if (Array.isArray(extractedData.mandatory_requirements)) {
      extractedData.mandatory_requirements.forEach((reqText) => {
        if (reqText && reqText.trim()) {
          rowsToInsert.push({
            workspace_id: workspaceId,
            requirement_text: reqText.trim(),
            requirement_type: "mandatory",
            compliance_status: "payload_pending" || "partial", // Default compliant starting grade
            extracted_value: "Mandatory Core"
          });
        }
      });
    }

    // Map compliance clauses
    if (Array.isArray(extractedData.compliance_clauses)) {
      extractedData.compliance_clauses.forEach((reqText) => {
        if (reqText && reqText.trim()) {
          rowsToInsert.push({
            workspace_id: workspaceId,
            requirement_text: reqText.trim(),
            requirement_type: "mandatory",
            compliance_status: "partial",
            extracted_value: "Compliance Clause"
          });
        }
      });
    }

    // Map evaluation criteria
    if (Array.isArray(extractedData.evaluation_criteria)) {
      extractedData.evaluation_criteria.forEach((reqText) => {
        if (reqText && reqText.trim()) {
          rowsToInsert.push({
            workspace_id: workspaceId,
            requirement_text: reqText.trim(),
            requirement_type: "evaluation",
            compliance_status: "partial",
            extracted_value: "Evaluation Metric"
          });
        }
      });
    }

    // Map submission deadline
    if (extractedData.submission_deadline && String(extractedData.submission_deadline).trim()) {
      rowsToInsert.push({
        workspace_id: workspaceId,
        requirement_text: `Submission Deadline Target: ${String(extractedData.submission_deadline).trim()}`,
        requirement_type: "deadline",
        compliance_status: "partial",
        extracted_value: String(extractedData.submission_deadline).trim()
      });
    }

    // Map budget range
    if (extractedData.budget_range && String(extractedData.budget_range).trim()) {
      rowsToInsert.push({
        workspace_id: workspaceId,
        requirement_text: `Project Budget Range: ${String(extractedData.budget_range).trim()}`,
        requirement_type: "evaluation",
        compliance_status: "partial",
        extracted_value: String(extractedData.budget_range).trim()
      });
    }

    // Keep active note of Question Sections in key indicators
    if (Array.isArray(extractedData.question_sections)) {
      extractedData.question_sections.forEach((qText) => {
        if (qText && qText.trim()) {
          rowsToInsert.push({
            workspace_id: workspaceId,
            requirement_text: qText.trim(),
            requirement_type: "mandatory",
            compliance_status: "partial",
            extracted_value: "Question Section"
          });
        }
      });
    }

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
