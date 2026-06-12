import { extractEntitiesFromText, mapCriteriaToTaxonomy } from "../../bid-engine/lib/datasetAnalysis.js";
import { EVALUATION_CRITERIA_TAXONOMY } from "../../bid-engine/lib/sampleData.js";
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

// ── Groq AI call ──────────────────────────────────────────────────────────────
const callGroq = async (prompt, systemPrompt) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
    const err = await response.text().catch(() => "");
    throw new Error(`Groq API error ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(text); } catch { return {}; }
};

// ── Improved extraction using Groq ────────────────────────────────────────────
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

  return callGroq(extractionPrompt, "You are an expert procurement analyst. Extract requirements from RFP documents in JSON format only.");
};

// ── Heuristic fallback (no AI) ────────────────────────────────────────────────
const extractHeuristicFields = (rawText) => {
  const lines = splitLines(rawText);
  return {
    mandatory_requirements: unique(
      lines.filter((l) => /\b(must|shall|required|mandatory|should|compliance|certification|license|registration)\b/i.test(l))
        .map((l) => l.slice(0, 150))
    ).slice(0, 15),
    evaluation_criteria: unique(
      lines.filter((l) => /\b(criteria|evaluation|weight|scored|scoring|points?|percentage|%)\b/i.test(l))
        .map((l) => l.slice(0, 150))
    ).slice(0, 10),
    questions_to_answer: unique(
      lines.filter((l) => /\?$/.test(l)).map((l) => l.slice(0, 150))
    ).slice(0, 8),
    deadlines: [lines.find((l) => /\b(deadline|submission date|closing date)\b/i.test(l)) || null].filter(Boolean),
    budget: [lines.find((l) => /\b(budget|pricing|price range|financial limit)\b/i.test(l)) || null].filter(Boolean),
    compliance_clauses: unique(
      lines.filter((l) => /\b(certification|legal|compliance|license|insurance|iso|soc 2)\b/i.test(l))
        .map((l) => l.slice(0, 150))
    ).slice(0, 10),
  };
};

// ── Normalise extracted data → flat requirement rows ─────────────────────────
const buildRequirementRows = (extractedData, taxonomyMappings) => {
  const rows = [];

  const add = (text, type, value) => {
    if (!text || typeof text !== "string") return;
    const clean = text.trim().slice(0, 200); // max 200 chars
    if (clean.length < 10) return;           // skip too-short items
    rows.push({ requirement_text: clean, requirement_type: type, compliance_status: "partial", extracted_value: value });
  };

  (extractedData.mandatory_requirements || []).forEach((item) => add(item, "mandatory", "Mandatory Core"));
  (extractedData.compliance_clauses || []).forEach((item) => add(item, "mandatory", "Compliance Clause"));

  if (taxonomyMappings.length > 0) {
    taxonomyMappings.forEach((item) => {
      const label = `${item.source_text} [${item.criteria_name}; ${item.sector}; ${item.weight_percentage ?? "N/A"}%]`;
      add(label.slice(0, 200), "evaluation", `Taxonomy: ${item.criteria_name} | ${item.sector}`);
    });
  } else {
    (extractedData.evaluation_criteria || []).forEach((item) => add(item, "evaluation", "Evaluation Metric"));
  }

  (extractedData.questions_to_answer || extractedData.question_sections || []).forEach((item) =>
    add(item, "evaluation", "Question to Answer")
  );

  (extractedData.deadlines || []).forEach((item) => add(item, "deadline", "Submission Deadline"));
  (extractedData.budget || []).forEach((item) => add(item, "evaluation", "Budget Range"));

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

// ── Heading / noise filter ────────────────────────────────────────────────────
const HEADING_PATTERNS = [
  /^SECTION\s+\d+/i, /^PART\s+\d+/i, /^SCHEDULE\s+\d+/i,
  /^CHAPTER\s+\d+/i, /^ANNEX\s+[A-Z\d]+/i, /^APPENDIX\s+[A-Z\d]+/i,
  /^\d+\.\s*[A-Z\s]{3,40}$/, /^NER\s+(Deadline|Budget)\s+Detected:/i,
];
const isHeading = (text) => HEADING_PATTERNS.some((p) => p.test(text.trim()));

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

    if (!rawText) return res.status(400).json({ error: "No RFP textual content provided for analysis." });
    if (givenWorkspaceId && !isUuid(givenWorkspaceId)) return res.status(400).json({ error: "workspaceId must be a valid Supabase UUID." });

    const auth = await requireAuthenticatedUser(req);
    if (auth.errorResponse) return res.status(auth.errorResponse.status).json(auth.errorResponse.body);

    const { supabase, user } = auth;
    const workspaceDb = getSupabaseAdminOrNull() || supabase;
    let workspaceId = givenWorkspaceId;

    // ── Step 1: Extract requirements (Groq AI, fallback to heuristic) ─────────
    let extractedData;
    try {
      extractedData = await extractWithGroq(rawText);
      // Validate we got meaningful data
      const totalItems = [
        ...(extractedData.mandatory_requirements || []),
        ...(extractedData.evaluation_criteria || []),
        ...(extractedData.compliance_clauses || []),
      ].length;
      if (totalItems < 2) throw new Error("Groq returned too few items, using fallback");
    } catch (groqErr) {
      console.warn("Groq extraction failed, using heuristic fallback:", groqErr.message);
      extractedData = extractHeuristicFields(rawText);
    }

    // ── Step 2: Taxonomy mapping ──────────────────────────────────────────────
    const { data: dbTaxonomy, error: taxonomyError } = await supabase.from("evaluation_criteria_taxonomy").select("*");
    const taxonomy = !taxonomyError && dbTaxonomy?.length ? dbTaxonomy : EVALUATION_CRITERIA_TAXONOMY;
    const taxonomyMappings = mapCriteriaToTaxonomy(extractedData.evaluation_criteria || [], taxonomy);
    extractedData.taxonomy_mappings = taxonomyMappings;

    // ── Step 3: Create workspace if needed ────────────────────────────────────
    if (!workspaceId) {
      const bidTitle = givenBidTitle || `RFP Analysis - ${new Date().toLocaleDateString()}`;
      const { data: newWorkspace, error: workspaceError } = await workspaceDb
        .from("rfp_workspaces")
        .insert({ user_id: user.id, title: bidTitle, status: "analyzing", raw_text: rawText })
        .select().single();
      if (workspaceError) throw new Error(`Failed to provision RFP Workspace: ${workspaceError.message}`);
      workspaceId = newWorkspace.id;
    } else {
      const workspaceCheck = await requireWorkspaceOwner(req, workspaceId);
      if (workspaceCheck.errorResponse) return res.status(workspaceCheck.errorResponse.status).json(workspaceCheck.errorResponse.body);
    }

    // ── Step 4: Build, filter, deduplicate rows ───────────────────────────────
    const rawRows = buildRequirementRows(extractedData, taxonomyMappings);
    const filtered = rawRows.filter((r) => !isHeading(r.requirement_text));
    const deduplicated = deduplicateRows(filtered);
    // Cap at 30 requirements max
    const finalRows = deduplicated.slice(0, 30).map((row) => ({
      workspace_id: workspaceId,
      ...row,
      compliance_status: "partial",
    }));

    // ── Step 5: Save to Supabase ──────────────────────────────────────────────
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
      success: true, workspaceId,
      extracted: extractedData,
      requirements: insertedRequirements,
      count: insertedRequirements.length,
    });
  } catch (err) {
    console.error("RFP analysis error:", err);
    return res.status(500).json({ error: "RFP Analysis system error: " + err.message });
  }
}

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

const unique = (values) => [...new Set(values.filter(Boolean))];
const splitLines = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const extractByRegex = (text, regex) =>
  unique((String(text || "").match(regex) || []).map((item) => String(item).trim()));

const buildRequirementRows = (rawText, extractedData, taxonomyMappings, entities) => {
  const lines = splitLines(rawText);
  const rows = [];
  const add = (text, type, value) => {
    const cleanText = typeof text === "string" ? text.trim() : String(text || "").trim();
    if (!cleanText) return;
    rows.push({
      requirement_text: cleanText,
      requirement_type: type,
      compliance_status: "partial",
      extracted_value: value,
    });
  };

  (extractedData.mandatory_requirements || []).forEach((item) => add(item, "mandatory", "Mandatory Core"));
  (extractedData.compliance_clauses || []).forEach((item) => add(item, "mandatory", "Compliance Clause"));
  taxonomyMappings.forEach((item) => {
    add(
      `${item.source_text} [Mapped Taxonomy: ${item.criteria_name}; Sector: ${item.sector}; Weight: ${item.weight_percentage ?? "N/A"}%]`,
      "evaluation",
      `Taxonomy: ${item.criteria_name} | ${item.sector} | ${item.weight_percentage ?? "N/A"}%`
    );
  });
  if (taxonomyMappings.length === 0) {
    (extractedData.evaluation_criteria || []).forEach((item) => add(item, "evaluation", "Evaluation Metric"));
  }
  (extractedData.question_sections || []).forEach((item) => add(item, "mandatory", "Question Section"));
  if (extractedData.submission_deadline) add(`Submission Deadline Target: ${extractedData.submission_deadline}`, "deadline", String(extractedData.submission_deadline));
  if (extractedData.budget_range) add(`Project Budget Range: ${extractedData.budget_range}`, "evaluation", String(extractedData.budget_range));
  (entities.deadlines || []).forEach((item) => add(`NER Deadline Detected: ${item}`, "deadline", item));
  (entities.budgets || []).forEach((item) => add(`NER Budget Detected: ${item}`, "evaluation", item));
  (entities.mandatory_clauses || []).forEach((item) => add(item, "mandatory", "NER Mandatory Clause"));

  if (rows.length === 0) {
    lines.slice(0, 6).forEach((line, index) => add(line, index === 0 ? "mandatory" : "evaluation", "Fallback Extracted Line"));
  }

  return rows;
};

const extractHeuristicFields = (rawText) => {
  const lines = splitLines(rawText);
  const lowerLines = lines.map((line) => line.toLowerCase());
  const mandatory_requirements = unique(
    lines.filter((line) => /\b(must|shall|required|mandatory|should|compliance|certification|license|registration)\b/i.test(line))
  ).slice(0, 12);

  const evaluation_criteria = unique(
    lines.filter((line) => /\b(criteria|evaluation|weight|scored|scoring|points?|percentage|%)\b/i.test(line))
  ).slice(0, 12);

  const question_sections = unique(
    lines.filter((line) => /\?$/.test(line) || /\b(question|questions|q\/a)\b/i.test(line))
  ).slice(0, 10);

  const submission_deadline =
    lines.find((line) => /\b(deadline|submission date|closing date|submission deadline)\b/i.test(line)) ||
    null;

  const budget_range =
    lines.find((line) => /\b(budget|estimate|pricing|price range|financial limit)\b/i.test(line)) ||
    null;

  const compliance_clauses = unique(
    lines.filter((line) => /\b(certification|certificate|legal|compliance|license|insurance|bond|tax|registration|iso|soc 2)\b/i.test(line))
  ).slice(0, 12);

  return {
    mandatory_requirements,
    evaluation_criteria,
    question_sections,
    submission_deadline,
    budget_range,
    compliance_clauses,
    extracted_entities: extractEntitiesFromText(rawText),
  };
};

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

    const extractedData = extractHeuristicFields(rawText);
    const { data: dbTaxonomy, error: taxonomyError } = await supabase
      .from("evaluation_criteria_taxonomy")
      .select("*");
    const taxonomy = !taxonomyError && dbTaxonomy?.length ? dbTaxonomy : EVALUATION_CRITERIA_TAXONOMY;
    const taxonomyMappings = mapCriteriaToTaxonomy(extractedData.evaluation_criteria || [], taxonomy);
    extractedData.taxonomy_mappings = taxonomyMappings;

    if (!workspaceId) {
      const bidTitle = givenBidTitle || `Corporate RFP Analysis Session - ${new Date().toLocaleDateString()}`;
      const { data: newWorkspace, error: workspaceError } = await workspaceDb
        .from("rfp_workspaces")
        .insert({
          user_id: user.id,
          title: bidTitle,
          status: "analyzing",
          raw_text: rawText || null,
        })
        .select()
        .single();

      if (workspaceError) throw new Error(`Failed to provision RFP Workspace in Supabase: ${workspaceError.message}`);
      workspaceId = newWorkspace.id;
    } else {
      const workspaceCheck = await requireWorkspaceOwner(req, workspaceId);
      if (workspaceCheck.errorResponse) {
        return res.status(workspaceCheck.errorResponse.status).json(workspaceCheck.errorResponse.body);
      }
    }

    const entities = extractedData.extracted_entities || extractEntitiesFromText(rawText);
    const rowsToInsert = buildRequirementRows(rawText, extractedData, taxonomyMappings, entities).map((row) => ({
      workspace_id: workspaceId,
      ...row,
      compliance_status: "partial",
    }));

    let insertedRequirements = [];
    if (rowsToInsert.length > 0) {
      const { data: inserted, error: insertError } = await workspaceDb
        .from("rfp_requirements")
        .insert(rowsToInsert)
        .select();

      if (insertError) {
        throw new Error(`Failed to commit extracted criteria to database: ${insertError.message}`);
      }

      insertedRequirements = inserted || [];
      await workspaceDb
        .from("rfp_workspaces")
        .update({ status: "draft_ready", updated_at: new Date().toISOString() })
        .eq("id", workspaceId)
        .eq("user_id", user.id);
    }

    return res.status(200).json({
      success: true,
      workspaceId,
      extracted: extractedData,
      requirements: insertedRequirements,
    });
  } catch (err) {
    console.error("Critical failure during RFP analysis route:", err);
    return res.status(500).json({ error: "RFP Analysis system error: " + err.message });
  }
}
