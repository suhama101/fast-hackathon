import { mapCriteriaToTaxonomy } from "../../bid-engine/lib/datasetAnalysis.js";
import { EVALUATION_CRITERIA_TAXONOMY } from "../../bid-engine/lib/sampleData.js";
import { runCrewStage } from "../../bid-engine/lib/crewBridge.js";
import {
  buildRequirementId,
  extractSectionAwareRequirements,
  flattenModelRequirements,
  mergeRequirementCandidates,
  toDbRequirementType,
  validateRequirementCandidates,
} from "../../bid-engine/lib/intelligence.js";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "../_lib/requestAuth.js";
import { getSupabaseAdminOrNull } from "../_lib/supabase.js";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const readBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
};

const unique = (values) => [...new Set(values.filter(Boolean))];
const splitLines = (text) =>
  String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

// ── Groq AI call via native fetch ─────────────────────────────────────────────
const callGroq = async (prompt, systemPrompt) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Groq API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(text); } catch { return {}; }
};

// ── Groq extraction with improved per-item prompt ─────────────────────────────
const extractWithGroq = async (rawText) => {
  const rfpText = rawText.slice(0, 6000);

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
${rfpText}`;

  return callGroq(
    extractionPrompt,
    "You are an expert procurement analyst. Extract requirements from RFP documents in JSON format only."
  );
};

// ── Heuristic fallback when Groq is unavailable ───────────────────────────────
const extractHeuristicFields = (rawText) => {
  const lines = splitLines(rawText);
  return {
    mandatory_requirements: unique(
      lines
        .filter((l) => /\b(must|shall|required|mandatory|should|compliance|certification|license|registration)\b/i.test(l))
        .map((l) => l.slice(0, 150))
    ).slice(0, 15),
    evaluation_criteria: unique(
      lines
        .filter((l) => /\b(criteria|evaluation|weight|scored|scoring|points?|percentage|%)\b/i.test(l))
        .map((l) => l.slice(0, 150))
    ).slice(0, 10),
    questions_to_answer: unique(
      lines.filter((l) => /\?$/.test(l)).map((l) => l.slice(0, 150))
    ).slice(0, 8),
    deadlines: [
      lines.find((l) => /\b(deadline|submission date|closing date)\b/i.test(l)) || null,
    ].filter(Boolean),
    budget: [
      lines.find((l) => /\b(budget|pricing|price range|financial limit)\b/i.test(l)) || null,
    ].filter(Boolean),
    compliance_clauses: unique(
      lines
        .filter((l) => /\b(certification|legal|compliance|license|insurance|iso|soc 2)\b/i.test(l))
        .map((l) => l.slice(0, 150))
    ).slice(0, 10),
  };
};

// ── Heading / noise filter ────────────────────────────────────────────────────
const HEADING_PATTERNS = [
  /^SECTION\s+\d+/i, /^PART\s+\d+/i, /^SCHEDULE\s+\d+/i,
  /^CHAPTER\s+\d+/i, /^ANNEX\s+[A-Z\d]+/i, /^APPENDIX\s+[A-Z\d]+/i,
  /^\d+\.\s*[A-Z\s]{3,40}$/,
];
const isHeading = (text) => HEADING_PATTERNS.some((p) => p.test(text.trim()));

// ── Build flat requirement rows — each array item = one row ───────────────────
const buildRequirementRows = (extractedData, taxonomyMappings) => {
  const rows = [];

  const add = (text, type, value) => {
    if (!text || typeof text !== "string") return;
    const clean = text.trim().slice(0, 200);
    if (clean.length < 10) return;
    if (isHeading(clean)) return;
    rows.push({
      requirement_text: clean,
      requirement_type: type,
      compliance_status: "partial",
      extracted_value: value,
    });
  };

  (extractedData.mandatory_requirements || []).forEach((item) =>
    add(item, "mandatory", "Mandatory Core")
  );
  (extractedData.compliance_clauses || []).forEach((item) =>
    add(item, "mandatory", "Compliance Clause")
  );

  if (taxonomyMappings.length > 0) {
    taxonomyMappings.forEach((item) => {
      const label = `${item.source_text} [${item.criteria_name}; ${item.sector}; ${item.weight_percentage ?? "N/A"}%]`;
      add(label.slice(0, 200), "evaluation", `Taxonomy: ${item.criteria_name} | ${item.sector}`);
    });
  } else {
    (extractedData.evaluation_criteria || []).forEach((item) =>
      add(item, "evaluation", "Evaluation Metric")
    );
  }

  (extractedData.questions_to_answer || []).forEach((item) =>
    add(item, "evaluation", "Question to Answer")
  );
  (extractedData.deadlines || []).forEach((item) =>
    add(item, "deadline", "Submission Deadline")
  );
  (extractedData.budget || []).forEach((item) =>
    add(item, "evaluation", "Budget Range")
  );

  return rows;
};

// ── Deduplicate with first-50-chars key ──────────────────────────────────────
const deduplicateRows = (rows) => {
  const seen = new Set();
  return rows.filter((req) => {
    const key = req.requirement_text.substring(0, 50).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = readBody(req);
    const rawText = String(body.rawText || "");
    const givenWorkspaceId = body.workspaceId || body.workspace_id || null;
    const givenBidTitle = body.bidTitle || body.title || null;

    if (!rawText) {
      return res.status(400).json({ error: "No RFP textual content provided for analysis." });
    }
    if (givenWorkspaceId && !isUuid(givenWorkspaceId)) {
      return res.status(400).json({ error: "workspaceId must be a valid Supabase UUID." });
    }

    const auth = await requireAuthenticatedUser(req);
    if (auth.errorResponse) {
      return res.status(auth.errorResponse.status).json(auth.errorResponse.body);
    }

    const { supabase, user } = auth;
    const workspaceDb = getSupabaseAdminOrNull() || supabase;
    let workspaceId = givenWorkspaceId;

    // Step 1: Extract requirements (Groq AI → heuristic fallback)
    let extractedData;
    try {
      const crewExtraction = await runCrewStage("extract", {
        raw_text: rawText,
        workspace_title: givenBidTitle || "RFP Analysis",
      });
      if (crewExtraction && !crewExtraction.error) {
        extractedData = crewExtraction;
      }
    } catch (groqErr) {
      console.warn("CrewAI extraction fallback:", groqErr.message);
    }

    if (!extractedData) {
      try {
        extractedData = await extractWithGroq(rawText);
        const totalItems = [
          ...(extractedData.mandatory_requirements || []),
          ...(extractedData.evaluation_criteria || []),
          ...(extractedData.compliance_clauses || []),
        ].length;
        if (totalItems < 2) throw new Error("Groq returned too few items");
      } catch (groqErr) {
        console.warn("Groq fallback:", groqErr.message);
        extractedData = extractHeuristicFields(rawText);
      }
    }

    // Step 2: Taxonomy mapping
    const { data: dbTaxonomy, error: taxonomyError } = await supabase
      .from("evaluation_criteria_taxonomy").select("*");
    const taxonomy = !taxonomyError && dbTaxonomy?.length ? dbTaxonomy : EVALUATION_CRITERIA_TAXONOMY;
    const taxonomyMappings = mapCriteriaToTaxonomy(extractedData.evaluation_criteria || [], taxonomy);
    extractedData.taxonomy_mappings = taxonomyMappings;

    // Step 3: Create workspace if needed
    if (!workspaceId) {
      const bidTitle = givenBidTitle || `RFP Analysis - ${new Date().toLocaleDateString()}`;
      const { data: newWorkspace, error: workspaceError } = await workspaceDb
        .from("rfp_workspaces")
        .insert({ user_id: user.id, title: bidTitle, status: "analyzing", raw_text: rawText })
        .select().single();
      if (workspaceError) throw new Error(`Failed to create workspace: ${workspaceError.message}`);
      workspaceId = newWorkspace.id;
    } else {
      const check = await requireWorkspaceOwner(req, workspaceId);
      if (check.errorResponse) {
        return res.status(check.errorResponse.status).json(check.errorResponse.body);
      }
    }

    // Step 4: Build, validate, deduplicate, cap at 80
    const llmRequirements = flattenModelRequirements(extractedData);
    const heuristicRequirements = extractSectionAwareRequirements(rawText);
    const taxonomyRequirements = taxonomyMappings.map((item) => ({
      requirement: item.source_text || item.criteria_name,
      category: "Evaluation",
      priority: item.weight_percentage ? "Important" : "Standard",
      source_section: `Taxonomy: ${item.criteria_name}`,
      source_page: null,
      source_text: item.source_text || item.criteria_name,
      needs_evidence: false,
      expected_evidence_type: "Evaluation Criteria",
    }));
    const validation = validateRequirementCandidates([
      ...llmRequirements,
      ...heuristicRequirements,
      ...taxonomyRequirements,
    ]);
    const finalRequirements = mergeRequirementCandidates(
      llmRequirements,
      heuristicRequirements,
      taxonomyRequirements
    ).map((requirement, index) => ({
      id: buildRequirementId(index),
      ...requirement,
      requirement_type: toDbRequirementType(requirement.category),
      compliance_status: "partial",
    })).slice(0, 80);

    const finalRows = finalRequirements.map((requirement) => ({
      workspace_id: workspaceId,
      requirement_text: requirement.requirement,
      requirement_type: requirement.requirement_type,
      compliance_status: "partial",
      extracted_value: String(requirement.source_text || requirement.requirement).slice(0, 600),
    }));

    // Step 5: Save to Supabase
    let insertedRequirements = [];
    if (finalRows.length > 0) {
      const { data: inserted, error: insertError } = await workspaceDb
        .from("rfp_requirements").insert(finalRows).select();
      if (insertError) throw new Error(`Failed to save requirements: ${insertError.message}`);
      insertedRequirements = inserted || [];

      await workspaceDb.from("rfp_workspaces")
        .update({ status: "draft_ready", updated_at: new Date().toISOString() })
        .eq("id", workspaceId).eq("user_id", user.id);
    }

    return res.status(200).json({
      success: true,
      workspaceId,
      extracted: extractedData,
      requirements: finalRequirements,
      inserted_requirements: insertedRequirements,
      diagnostics: {
        total_requirements: finalRequirements.length,
        extraction_debug: {
          raw_text_length: rawText.length,
          sections_detected: new Set(finalRequirements.map((item) => item.source_section).filter(Boolean)).size,
          requirements_before_validation: validation.diagnostics.requirements_before_validation,
          requirements_after_validation: finalRequirements.length,
          rejected_bad_chunks: validation.diagnostics.rejected_bad_chunks,
          rejected_examples: validation.diagnostics.rejected_examples,
        },
      },
      count: insertedRequirements.length,
    });
  } catch (err) {
    console.error("RFP analysis error:", err);
    return res.status(500).json({ error: "RFP Analysis system error: " + err.message });
  }
}
