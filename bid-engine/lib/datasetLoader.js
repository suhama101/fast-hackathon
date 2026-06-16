import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { CAPABILITY_LIBRARY, BID_HISTORY, EVALUATION_CRITERIA_TAXONOMY } from "./sampleData.js";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

export const DEFAULT_DATASET_PATH = path.resolve(
  process.cwd(),
  "../assets/Problem#1_Sample_Datasets (TEKROWE).xlsx"
);

const clean = (value) => String(value ?? "").trim();

const numberFromText = (value) => {
  const match = clean(value).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const normalizeKey = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/[%()]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const toIsoDate = (value) => {
  const text = clean(value);
  if (!text) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const pick = (row, keys, fallback = "") => {
  for (const key of keys) {
    if (clean(row[key])) return row[key];
  }
  return fallback;
};

const tokenize = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

const inferEvidenceTypes = (text) => {
  const normalized = clean(text).toLowerCase();
  const evidenceTypes = new Set(["Past Project"]);
  if (/methodology|approach|implementation plan|delivery plan/.test(normalized)) evidenceTypes.add("Methodology");
  if (/work plan|timeline|activity plan|schedule/.test(normalized)) evidenceTypes.add("Work Plan");
  if (/certificate|certified|certification/.test(normalized)) evidenceTypes.add("Certification");
  if (/cv|curriculum vitae|team profile/.test(normalized)) evidenceTypes.add("Team CV");
  if (/legal declaration|disclosure|undertaking/.test(normalized)) evidenceTypes.add("Legal Declaration");
  if (/financial statement|audit report|audited account/.test(normalized)) evidenceTypes.add("Financial Statement");
  if (/tax registration|ntn|tax certificate/.test(normalized)) evidenceTypes.add("Tax Document");
  if (/registration certificate|incorporation|secp/.test(normalized)) evidenceTypes.add("Registration Document");
  if (/policy compliance|conflict of interest|related party|anti fraud|anti corruption/.test(normalized)) evidenceTypes.add("Policy Compliance");
  return [...evidenceTypes];
};

const enrichCapability = (item) => {
  const keywords = [...new Set(tokenize([item.project_name, item.description, item.domain, item.client_type, ...(item.skills || []), ...(item.certifications || [])].join(" ")))]
    .slice(0, 24);
  const evidenceTypes = item.evidence_types || inferEvidenceTypes([item.project_name, item.description, item.certification, ...(item.certifications || [])].join(" "));
  return {
    ...item,
    sector: item.sector || item.client_type || item.domain || "General",
    year: item.year_completed || item.year || null,
    certification_name: item.certification || item.certification_name || (item.certifications || [])[0] || "",
    keywords,
    evidence_type: item.evidence_type || evidenceTypes[0] || "Past Project",
    evidence_types: evidenceTypes,
  };
};

const findHeaderIndex = (rows, requiredLabels) =>
  rows.findIndex((row) => {
    const labels = row.map((cell) => clean(cell).toLowerCase());
    return requiredLabels.every((label) => labels.includes(label.toLowerCase()));
  });

const rowsToObjects = (rows, headerIndex) => {
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(normalizeKey);
  return rows.slice(headerIndex + 1).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      if (header) item[header] = row[index] ?? "";
    });
    return item;
  }).filter((item) => Object.values(item).some((value) => clean(value)));
};

const readWorkbookRows = (filePath) => {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const result = {};
  workbook.SheetNames.forEach((sheetName) => {
    result[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });
  });
  return result;
};

export function loadHackathonDataset(filePath = process.env.DATASET_XLSX_PATH || DEFAULT_DATASET_PATH) {
  if (!fs.existsSync(filePath)) {
    return {
      source: "sample_mode",
      filePath,
      sheets: [],
      capabilityLibrary: CAPABILITY_LIBRARY.map((item) => ({
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
      })).map(enrichCapability),
      bidHistory: BID_HISTORY.map((item) => ({
        bid_id: item.bid_id,
        client: "Sample Client",
        sector: item.sector,
        budget: "",
        score_percent: item.match_score,
        outcome: item.outcome,
        response_time_hrs: null,
        compliance_percent: item.compliance_score,
        doc_pages: null,
        gaps_found: null,
        bid_manager: "Sample Manager",
        submission_date: null,
        competitor_presence: item.outcome === "win" ? "Medium" : "High",
        incumbent_vendor: item.outcome === "win" ? "No" : "Unknown",
        technical_score: item.match_score,
        commercial_score: item.budget_alignment,
        risk_score: item.outcome === "win" ? 18 : 42,
        strategic_fit_score: Math.round((item.match_score + item.compliance_score) / 2),
      })),
      evaluationCriteria: EVALUATION_CRITERIA_TAXONOMY,
    };
  }

  const sheets = readWorkbookRows(filePath);
  const sheetNames = Object.keys(sheets);
  const bidSheetName = sheetNames.find((name) => /bid history/i.test(name)) || sheetNames[0];
  const capabilitySheetName = sheetNames.find((name) => /capability/i.test(name)) || sheetNames[1];
  const criteriaSheetName = sheetNames.find((name) => /evaluation|criteria|taxonomy/i.test(name));

  const bidObjects = rowsToObjects(
    sheets[bidSheetName] || [],
    findHeaderIndex(sheets[bidSheetName] || [], ["Bid ID", "Sector", "Outcome"])
  );
  const capabilityObjects = rowsToObjects(
    sheets[capabilitySheetName] || [],
    findHeaderIndex(sheets[capabilitySheetName] || [], ["Cap ID", "Domain", "Project Summary"])
  );
  const criteriaObjects = criteriaSheetName
    ? rowsToObjects(
        sheets[criteriaSheetName] || [],
        findHeaderIndex(sheets[criteriaSheetName] || [], ["Sector"])
      )
    : [];

  const capabilityLibrary = capabilityObjects.map((row) => {
    const domain = clean(row.domain) || "General";
    const summary = clean(row.project_summary);
    const certification = clean(row.certification) || "N/A";
    return enrichCapability({
      external_id: clean(row.cap_id),
      domain,
      project_name: summary.split(":")[0] || clean(row.cap_id) || "Capability Record",
      description: summary || `${domain} capability evidence`,
      project_summary: summary,
      certification,
      certifications: certification === "N/A" ? [] : certification.split(/[;,]/).map(clean).filter(Boolean),
      skills: [domain, ...summary.split(/\W+/).filter((word) => word.length > 4).slice(0, 8)],
      year_completed: numberFromText(row.year_completed) || new Date().getFullYear(),
      contract_value: clean(row.contract_value),
      duration_months: numberFromText(row.duration_months),
      client_type: clean(row.client_type) || "Unknown",
    });
  });

  const bidHistory = bidObjects.map((row) => {
    const score = numberFromText(pick(row, ["score", "score_percent", "evaluation_score"]));
    const compliance = numberFromText(pick(row, ["compliance", "compliance_percent"]));
    const gaps = numberFromText(row.gaps_found);
    const outcome = clean(row.outcome).toLowerCase() === "win" ? "win" : "loss";
    return {
      bid_id: clean(row.bid_id),
      client: clean(row.client),
      sector: clean(row.sector) || "General",
      budget: clean(row.budget),
      score_percent: score,
      outcome,
      response_time_hrs: numberFromText(row.response_time_hrs),
      compliance_percent: compliance,
      doc_pages: numberFromText(row.doc_pages),
      gaps_found: gaps,
      bid_manager: clean(row.bid_manager),
      submission_date: toIsoDate(row.submission_date),
      competitor_presence: clean(pick(row, ["competitor_presence", "competitors", "competitor"])) || (outcome === "win" ? "Medium" : "High"),
      incumbent_vendor: clean(pick(row, ["incumbent_vendor", "incumbent"])) || "Unknown",
      technical_score: numberFromText(pick(row, ["technical_score", "technical_evaluation_score"])) || score,
      commercial_score: numberFromText(pick(row, ["commercial_score", "commercial_evaluation_score", "budget_alignment_score"])) || Math.max(45, Math.min(95, 100 - (gaps || 3) * 5)),
      risk_score: numberFromText(pick(row, ["risk_score", "risk_rating"])) || Math.min(100, (gaps || 3) * 8 + (outcome === "loss" ? 18 : 0)),
      strategic_fit_score: numberFromText(pick(row, ["strategic_fit_score", "strategic_fit", "relationship_score"])) || Math.round(((score || 65) + (compliance || 70)) / 2),
    };
  }).filter((row) => row.bid_id);

  const evaluationCriteria = criteriaObjects.length
    ? criteriaObjects.map((row, index) => ({
        criteria_name: clean(pick(row, ["criteria_name", "criteria", "evaluation_criteria", "name"])) || `Evaluation Criterion ${index + 1}`,
        sector: clean(row.sector) || "General",
        weight_percentage: numberFromText(pick(row, ["weight_percentage", "weight", "weighting"])),
        description: clean(row.description) || clean(pick(row, ["details", "criteria_description"])) || "Dataset evaluation criterion.",
      }))
    : EVALUATION_CRITERIA_TAXONOMY;

  return {
    source: "excel",
    filePath,
    sheets: sheetNames.map((name) => ({
      name,
      rows: sheets[name]?.length || 0,
      columns: (sheets[name]?.[findHeaderIndex(sheets[name] || [], name === bidSheetName ? ["Bid ID"] : ["Cap ID"])] || []).map(clean),
    })),
    capabilityLibrary,
    bidHistory,
    evaluationCriteria,
  };
}

export function datasetSummary(dataset) {
  return {
    source: dataset.source,
    filePath: dataset.filePath,
    sheets: dataset.sheets,
    capability_library: dataset.capabilityLibrary.length,
    bid_history: dataset.bidHistory.length,
    evaluation_criteria_taxonomy: dataset.evaluationCriteria.length,
  };
}
