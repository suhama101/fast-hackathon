import { NextResponse } from "next/server";
import { analyzeWithGroq } from "../../../../lib/groqClient";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "../../../../lib/requestAuth";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const buildEvidenceLockedContent = (sectionTitle, requirementText, matchedEvidence, matchStatus, expectedEvidenceType) => {
  if (!matchedEvidence || matchStatus === "No Match") {
    return `## ${sectionTitle}\n\nEvidence required: ${expectedEvidenceType || "supporting evidence"}. No strong supporting evidence was found in the capability library.\n`;
  }

  return `## ${sectionTitle}\n\nEvidence-backed response: ${matchedEvidence}\n\nThis section should be edited only within the bounds of the matched evidence above.\n`;
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!isUuid(workspaceId)) {
      return NextResponse.json(
        { error: "A valid workspaceId UUID is required." },
        { status: 400 }
      );
    }

    const ownership = await requireWorkspaceOwner(request, workspaceId);
    if (ownership.errorResponse) return ownership.errorResponse;

    const { supabase } = ownership;
    const { data: drafts, error } = await supabase
      .from("proposal_drafts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      workspaceId,
      drafts: drafts || [],
    });
  } catch (err) {
    console.error("Proposal drafts load failure:", err);
    return NextResponse.json(
      { error: "Failed to load proposal drafts: " + err.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { workspaceId, requirementId, tone, capabilityInfo } = await request.json();

    if (!isUuid(workspaceId)) {
      return NextResponse.json(
        { error: "A valid workspaceId UUID is required." },
        { status: 400 }
      );
    }

    const ownership = await requireWorkspaceOwner(request, workspaceId);
    if (ownership.errorResponse) return ownership.errorResponse;

    const { supabase } = ownership;

    // 1. Fetch requirements for this workspace to identify what questions or sections need responses
    const { data: requirements, error: reqError } = await supabase
      .from("rfp_requirements")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (reqError || !requirements) {
      throw new Error(`Failed to load workspace requirement parameters: ${reqError?.message}`);
    }

    if (requirements.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No sections or requirements found to draft. Analyze the RFP first.",
        drafts: []
      });
    }

    const extractedEntities = {
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
        .slice(0, 12),
      mapped_criteria: requirements
        .filter((req) => req.requirement_type === "evaluation" && /Taxonomy:/i.test(req.extracted_value || ""))
        .map((req) => req.extracted_value)
        .filter(Boolean),
    };

    // 2. Load the capability library for reference evidence
    const { data: capabilities, error: capError } = await supabase
      .from("capability_library")
      .select("*");

    if (capError) {
      throw new Error(`Failed to read capabilities library: ${capError.message}`);
    }

    const evidenceByRequirement = requirements.map((item) => ({
      requirement_id: item.id,
      requirement_text: item.requirement_text,
      compliance_status: item.compliance_status,
      matched_evidence: item.matched_evidence,
      match_confidence: item.match_confidence,
      evidence_items: item.evidence_items || [],
      match_reasoning: item.match_reasoning,
    }));

    const draftTargets = [
      { id: "executive-summary", section_title: "Executive Summary" },
      { id: "understanding-requirements", section_title: "Understanding of Requirements" },
      { id: "technical-approach", section_title: "Technical Approach" },
      { id: "relevant-experience", section_title: "Relevant Experience" },
      { id: "compliance-response", section_title: "Compliance Response" },
      { id: "implementation-approach", section_title: "Implementation Approach" },
      { id: "conclusion", section_title: "Conclusion" },
    ];

    if (requirementId && requirements.find((req) => req.id === requirementId)) {
      const focused = requirements.find((req) => req.id === requirementId);
      draftTargets.unshift({
        id: focused.id,
        section_title: `Response to ${String(focused.requirement_text || "").slice(0, 50)}`,
      });
    }

    // 3. Draft the proposal template using Groq
    const toneInstruction = tone ? `Use a "${tone}" tone throughout.` : "Use a professional, compliant tone.";
    const capabilityContext = capabilityInfo ? `\n\nADDITIONAL CAPABILITY CONTEXT FROM USER:\n${capabilityInfo}` : "";
    const systemPrompt = `You are an expert proposal writer. Write professional, compliant proposal responses. ${toneInstruction}`;

    const userPrompt = `Generate a structured proposal document responding to the retrieved RFP requirements.

OUTPUT SECTIONS:
${JSON.stringify(draftTargets)}

EXTRACTED ENTITIES AND TAXONOMY CONTEXT:
${JSON.stringify(extractedEntities)}

MATCHED EVIDENCE BY REQUIREMENT:
${JSON.stringify(evidenceByRequirement)}

OUR CAPABILITY LIBRARY EXCERPTS:
${JSON.stringify(capabilities.slice(0, 10).map(c => ({
  project: c.project_name,
  description: c.project_summary || c.description,
  skills: c.skills,
  certifications: c.certifications,
  certification: c.certification,
  contract_value: c.contract_value,
  client_type: c.client_type
})))}${capabilityContext}

For each section:
- Use only matched evidence and extracted requirements.
- Write a concise but complete proposal section.
- Avoid unsupported claims.
- Explicitly mention compliance status where relevant.
- Keep a formal, procurement-safe tone.

Return a JSON object containing a "drafts" array. Format of each element:
- "section_title": exact concise heading for the response section (e.g., "Response to Security SLA")
- "content": the formatted Markdown proposal response paragraph.
- "requirement_id": corresponding id of the RFP criteria target

Return ONLY valid JSON.`;

    const aiResponse = await analyzeWithGroq(userPrompt, systemPrompt);
    const draftsList = Array.isArray(aiResponse.drafts) && aiResponse.drafts.length
      ? aiResponse.drafts
      : draftTargets.map((section, index) => {
          const reference = evidenceByRequirement[index % evidenceByRequirement.length] || {};
          const evidenceLine = reference.matched_evidence || reference.evidence_items?.[0]?.summary || "";
          const matchStatus = String(reference.compliance_status || "").toLowerCase() === "pass" ? "Strong Match" : String(reference.compliance_status || "").toLowerCase() === "partial" ? "Partial Match" : "No Match";
          return {
            section_title: section.section_title,
            requirement_id: reference.requirement_id || section.id,
            content: buildEvidenceLockedContent(section.section_title, reference.requirement_text, evidenceLine, matchStatus, reference.expected_evidence_type),
          };
        });

    const lockedDrafts = draftsList.map((draft, index) => {
      const reference = evidenceByRequirement[index % evidenceByRequirement.length] || {};
      const evidenceLine = reference.matched_evidence || reference.evidence_items?.[0]?.summary || "";
      const matchStatus = String(reference.compliance_status || "").toLowerCase() === "pass" ? "Strong Match" : String(reference.compliance_status || "").toLowerCase() === "partial" ? "Partial Match" : "No Match";
      const safeContent = buildEvidenceLockedContent(
        draft.section_title || "Proposal Response Section",
        reference.requirement_text || draft.section_title,
        evidenceLine,
        matchStatus,
        reference.expected_evidence_type
      );
      return {
        ...draft,
        content: matchStatus === "No Match" ? safeContent : `${safeContent}\n\n${String(draft.content || "").trim()}`,
      };
    });

    // 4. Pre-clear any old drafts for this workspace to avoid duplication in multiple runs
    await supabase
      .from("proposal_drafts")
      .delete()
      .eq("workspace_id", workspaceId);

    // Prepare rows for bulk insert
    const insertRows = lockedDrafts.map(item => ({
      workspace_id: workspaceId,
      section_title: item.section_title || "Proposal Response Section",
      content: item.content || "Response placeholder under generation.",
      status: "ai_generated"
    }));

    // 5. Save generated sections to proposal_drafts table
    if (insertRows.length > 0) {
      const { data: savedDrafts, error: draftsError } = await supabase
        .from("proposal_drafts")
        .insert(insertRows)
        .select();

      if (draftsError) {
        throw new Error(`Failed to save AI proposal drafts to database: ${draftsError.message}`);
      }

      return NextResponse.json({
        success: true,
        drafts: savedDrafts,
        count: savedDrafts.length,
        message: "Draft generated successfully"
      });
    }

    return NextResponse.json({
      success: true,
      drafts: [],
      count: 0
    });

  } catch (err) {
    console.error("Proposal drafting route failure:", err);
    return NextResponse.json(
      { error: "Drafting engine encountered error: " + err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const { draftId, content, status } = await request.json();

    if (!isUuid(draftId)) {
      return NextResponse.json(
        { error: "A valid draftId UUID is required." },
        { status: 400 }
      );
    }

    const nextStatus = ["ai_generated", "edited", "approved"].includes(status)
      ? status
      : "edited";

    const auth = await requireAuthenticatedUser(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { supabase } = auth;
    const { data: draftRow, error: draftLookupError } = await supabase
      .from("proposal_drafts")
      .select("workspace_id")
      .eq("id", draftId)
      .maybeSingle();

    if (draftLookupError) throw draftLookupError;
    if (!draftRow?.workspace_id) {
      return NextResponse.json(
        { error: "Draft not found." },
        { status: 404 }
      );
    }

    const workspaceCheck = await requireWorkspaceOwner(request, draftRow.workspace_id);
    if (workspaceCheck.errorResponse) return workspaceCheck.errorResponse;

    const { data, error } = await supabase
      .from("proposal_drafts")
      .update({
        content: String(content || ""),
        status: nextStatus,
      })
      .eq("id", draftId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      draft: data,
    });
  } catch (err) {
    console.error("Proposal draft save failure:", err);
    return NextResponse.json(
      { error: "Failed to save proposal draft: " + err.message },
      { status: 500 }
    );
  }
}
