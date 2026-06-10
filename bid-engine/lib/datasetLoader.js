import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { CAPABILITY_LIBRARY, BID_HISTORY, EVALUATION_CRITERIA_TAXONOMY } from "./sampleData";

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
      })),
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
      })),
      evaluationCriteria: EVALUATION_CRITERIA_TAXONOMY,
    };
  }

  const sheets = readWorkbookRows(filePath);
  const sheetNames = Object.keys(sheets);
  const bidSheetName = sheetNames.find((name) => /bid history/i.test(name)) || sheetNames[0];
  const capabilitySheetName = sheetNames.find((name) => /capability/i.test(name)) || sheetNames[1];

  const bidObjects = rowsToObjects(
    sheets[bidSheetName] || [],
    findHeaderIndex(sheets[bidSheetName] || [], ["Bid ID", "Sector", "Outcome"])
  );
  const capabilityObjects = rowsToObjects(
    sheets[capabilitySheetName] || [],
    findHeaderIndex(sheets[capabilitySheetName] || [], ["Cap ID", "Domain", "Project Summary"])
  );

  const capabilityLibrary = capabilityObjects.map((row) => {
    const domain = clean(row.domain) || "General";
    const summary = clean(row.project_summary);
    const certification = clean(row.certification) || "N/A";
    return {
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
    };
  });

  const bidHistory = bidObjects.map((row) => ({
    bid_id: clean(row.bid_id),
    client: clean(row.client),
    sector: clean(row.sector) || "General",
    budget: clean(row.budget),
    score_percent: numberFromText(row.score),
    outcome: clean(row.outcome).toLowerCase() === "win" ? "win" : "loss",
    response_time_hrs: numberFromText(row.response_time_hrs),
    compliance_percent: numberFromText(row.compliance),
    doc_pages: numberFromText(row.doc_pages),
    gaps_found: numberFromText(row.gaps_found),
    bid_manager: clean(row.bid_manager),
    submission_date: toIsoDate(row.submission_date),
  })).filter((row) => row.bid_id);

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
    evaluationCriteria: EVALUATION_CRITERIA_TAXONOMY,
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
