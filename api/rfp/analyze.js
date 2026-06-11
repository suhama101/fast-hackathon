import { extractEntitiesFromText, mapCriteriaToTaxonomy } from "../../bid-engine/lib/datasetAnalysis.js";
import { EVALUATION_CRITERIA_TAXONOMY } from "../../bid-engine/lib/sampleData.js";
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
