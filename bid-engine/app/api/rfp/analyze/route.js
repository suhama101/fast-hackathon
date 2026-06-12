import { NextResponse } from "next/server";
import { analyzeWithGroq } from "../../../../lib/groqClient";
import { loadHackathonDataset } from "../../../../lib/datasetLoader";
import { mapCriteriaToTaxonomy } from "../../../../lib/datasetAnalysis";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "../../../../lib/requestAuth";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

// ── Heading / noise filter ────────────────────────────────────────────────────
const HEADING_PATTERNS = [
  /^SECTION\s+\d+/i, /^PART\s+\d+/i, /^SCHEDULE\s+\d+/i,
  /^CHAPTER\s+\d+/i, /^ANNEX\s+[A-Z\d]+/i, /^APPENDIX\s+[A-Z\d]+/i,
  /^\d+\.\s*[A-Z\s]{3,40}$/,
];
const isHeading = (text) => HEADING_PATTERNS.some((p) => p.test(text.trim()));

// ── Build flat requirement rows from extracted JSON ───────────────────────────
const buildRequirementRows = (extractedData, workspaceId, taxonomyMappings) => {
  const rows = [];

  const add = (text, type, value) => {
    if (!text || typeof text !== "string") return;
    const clean = text.trim().slice(0, 200); // max 200 chars per requirement
    if (clean.length < 10) return;           // skip empty / too-short items
    if (isHeading(clean)) return;            // skip section headings
    rows.push({
      workspace_id: workspaceId,
      requirement_text: clean,
      requirement_type: type,
      compliance_status: "partial",
      extracted_value: value,
    });
  };

  // Each array item from Groq becomes ONE separate requirement row
  (extractedData.mandatory_requirements || []).forEach((item) =>
    add(item, "mandatory", "Mandatory Core")
  );
  (extractedData.compliance_clauses || []).forEach((item) =>
    add(item, "mandatory", "Compliance Clause")
  );

  if (taxonomyMappings.length > 0) {
    taxonomyMappings.forEach((item) => {
      const label = `${item.source_text} [${item.criteria_name}; ${item.sector}; ${item.weight_percentage ?? "N/A"}%]`;
      add(label, "evaluation", `Taxonomy: ${item.criteria_name} | ${item.sector}`);
    });
  } else {
    (extractedData.evaluation_criteria || []).forEach((item) =>
      add(item, "evaluation", "Evaluation Metric")
    );
  }

  // questions_to_answer (new field from improved prompt)
  (extractedData.questions_to_answer || []).forEach((item) =>
    add(item, "evaluation", "Question to Answer")
  );

  // deadlines — new array format from improved prompt
  (extractedData.deadlines || []).forEach((item) =>
    add(item, "deadline", "Submission Deadline")
  );
  // budget — new array format from improved prompt
  (extractedData.budget || []).forEach((item) =>
    add(item, "evaluation", "Budget Range")
  );

  // Legacy single-value fields (backwards compat)
  if (extractedData.submission_deadline && typeof extractedData.submission_deadline === "string") {
    add(`Submission Deadline: ${extractedData.submission_deadline}`, "deadline", extractedData.submission_deadline);
  }
  if (extractedData.budget_range && typeof extractedData.budget_range === "string") {
    add(`Budget Range: ${extractedData.budget_range}`, "evaluation", extractedData.budget_range);
  }

  return rows;
};

// ── Deduplicate using first-50-chars key ──────────────────────────────────────
const deduplicateRows = (rows) => {
  const seen = new Set();
  return rows.filter((req) => {
    const key = req.requirement_text.substring(0, 50).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

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

    // ── Step 1: Create workspace if needed ────────────────────────────────────
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

    // ── Step 2: Groq AI extraction with improved per-item prompt ──────────────
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

Extract and return JSON:
{
  "mandatory_requirements": [
    "Vendor must be registered with SECP",
    "Minimum 5 years software development experience required",
    "ISO 9001 certification is mandatory"
  ],
  "evaluation_criteria": [
    "Technical Approach - 30% weight",
    "Past Experience and References - 25% weight"
  ],
  "questions_to_answer": [
    "Describe your technical approach for enterprise systems",
    "Provide details of 3 similar government projects"
  ],
  "deadlines": ["Submission deadline: December 31, 2026"],
  "budget": ["Budget range: PKR 50M to 80M"],
  "compliance_clauses": [
    "Must comply with Pakistan Data Protection Act 2023",
    "Data must be stored on servers in Pakistan"
  ]
}

Return ONLY valid JSON. No explanations. No markdown.
Each item must be SHORT and SPECIFIC - one clear requirement only.

RFP TEXT:
${rawText.substring(0, 6000)}`;

    const extractedData = await analyzeWithGroq(extractionPrompt, systemPrompt);

    // ── Step 3: Taxonomy mapping ──────────────────────────────────────────────
    const { data: dbTaxonomy, error: taxonomyError } = await supabase
      .from("evaluation_criteria_taxonomy").select("*");
    const fallbackTaxonomy = loadHackathonDataset().evaluationCriteria;
    const taxonomy = !taxonomyError && dbTaxonomy?.length ? dbTaxonomy : fallbackTaxonomy;
    const taxonomyMappings = mapCriteriaToTaxonomy(extractedData.evaluation_criteria || [], taxonomy);
    extractedData.taxonomy_mappings = taxonomyMappings;

    // ── Step 4: Build rows — each array item = one row ────────────────────────
    const rawRows = buildRequirementRows(extractedData, workspaceId, taxonomyMappings);

    // Deduplicate with first-50-chars key
    const deduplicated = deduplicateRows(rawRows);

    // Cap at 30 requirements max
    const finalRows = deduplicated.slice(0, 30);

    // ── Step 5: Save to Supabase ──────────────────────────────────────────────
    if (finalRows.length === 0) {
      return NextResponse.json({ success: true, workspaceId, extracted: extractedData, requirements: [], count: 0 });
    }

    const { data: insertedRequirements, error: insertError } = await supabase
      .from("rfp_requirements").insert(finalRows).select();

    if (insertError) {
      console.error("Supabase requirement insertion fault:", insertError);
      throw new Error(`Failed to commit extracted criteria to database: ${insertError.message}`);
    }

    await supabase
      .from("rfp_workspaces")
      .update({ status: "draft_ready", updated_at: new Date().toISOString() })
      .eq("id", workspaceId)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      workspaceId,
      extracted: extractedData,
      requirements: insertedRequirements,
      count: insertedRequirements.length,
    });

  } catch (err) {
    console.error("Critical failure during RFP analysis route:", err);
    return NextResponse.json({ error: "RFP Analysis system error: " + err.message }, { status: 500 });
  }
}
