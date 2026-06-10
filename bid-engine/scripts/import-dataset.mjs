import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { loadHackathonDataset, datasetSummary } from "../lib/datasetLoader.js";

[
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env.local"),
  path.resolve(process.cwd(), "../.env"),
].forEach((envPath) => {
  dotenv.config({ path: envPath, override: false, quiet: true });
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (/supabase\.com\/dashboard|supabase\.com\/project/i.test(supabaseUrl)) {
  console.error("NEXT_PUBLIC_SUPABASE_URL must be the project API URL, e.g. https://<project-ref>.supabase.co, not a Supabase dashboard URL.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const dataset = loadHackathonDataset();

const upsertChunk = async (table, rows, options = {}) => {
  if (!rows.length) return { count: 0 };
  const { error } = await supabase.from(table).upsert(rows, options);
  if (error) throw new Error(`${table} import failed: ${error.message}`);
  return { count: rows.length };
};

const capabilityRows = dataset.capabilityLibrary.map((item) => ({
  external_id: item.external_id,
  domain: item.domain,
  project_name: item.project_name,
  description: item.description,
  project_summary: item.project_summary,
  certification: item.certification,
  certifications: item.certifications,
  skills: item.skills,
  year_completed: item.year_completed,
  contract_value: item.contract_value,
  duration_months: item.duration_months,
  client_type: item.client_type,
}));

const bidRows = dataset.bidHistory.map((item) => ({
  bid_id: item.bid_id,
  client: item.client,
  sector: item.sector,
  budget: item.budget,
  score_percent: item.score_percent,
  outcome: item.outcome,
  response_time_hrs: item.response_time_hrs,
  compliance_percent: item.compliance_percent,
  doc_pages: item.doc_pages,
  gaps_found: item.gaps_found,
  bid_manager: item.bid_manager,
  submission_date: item.submission_date,
  competitor_presence: item.competitor_presence,
  incumbent_vendor: item.incumbent_vendor,
  technical_score: item.technical_score,
  commercial_score: item.commercial_score,
  risk_score: item.risk_score,
  strategic_fit_score: item.strategic_fit_score,
}));

const criteriaRows = dataset.evaluationCriteria.map((item) => ({
  criteria_name: item.criteria_name,
  sector: item.sector,
  weight_percentage: item.weight_percentage,
  description: item.description,
}));

console.log("Dataset summary:", datasetSummary(dataset));

await upsertChunk("capability_library", capabilityRows, { onConflict: "external_id" });
await upsertChunk("bid_history", bidRows, { onConflict: "bid_id" });
await upsertChunk("evaluation_criteria_taxonomy", criteriaRows, { onConflict: "criteria_name,sector" });

console.log("Dataset import completed.");
