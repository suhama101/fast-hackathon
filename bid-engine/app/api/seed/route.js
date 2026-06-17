import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseClient";
import { loadHackathonDataset, datasetSummary } from "../../../lib/datasetLoader";
import { syncCapabilityCorpus } from "../../../lib/ragEngine";

export async function GET() {
  const dataset = loadHackathonDataset();
  return NextResponse.json({
    success: true,
    message: "Dataset inspection completed.",
    summary: datasetSummary(dataset),
  });
}

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();
    const dataset = loadHackathonDataset();

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
    }));

    const criteriaRows = dataset.evaluationCriteria.map((item) => ({
      criteria_name: item.criteria_name,
      sector: item.sector,
      weight_percentage: item.weight_percentage,
      description: item.description,
    }));

    const results = {};

    const { error: capabilityError } = await supabase
      .from("capability_library")
      .upsert(capabilityRows, { onConflict: "external_id" });
    if (capabilityError) throw capabilityError;
    results.capability_library = capabilityRows.length;

    try {
      const ragSync = await syncCapabilityCorpus(capabilityRows, { force: true });
      results.evidence_documents = ragSync.documentCount || 0;
      results.embedding_provider = ragSync.embeddingProvider;
      results.embedding_model = ragSync.embeddingModel;
      results.vector_dimensions = ragSync.vectorDimensions;
    } catch (ragError) {
      results.evidence_documents = 0;
      results.rag_warning = ragError.message;
    }

    const { error: bidError } = await supabase
      .from("bid_history")
      .upsert(bidRows, { onConflict: "bid_id" });
    if (bidError) throw bidError;
    results.bid_history = bidRows.length;

    const { error: criteriaError } = await supabase
      .from("evaluation_criteria_taxonomy")
      .upsert(criteriaRows, { onConflict: "criteria_name,sector" });
    if (criteriaError) throw criteriaError;
    results.evaluation_criteria_taxonomy = criteriaRows.length;

    return NextResponse.json({
      success: true,
      mode: dataset.source === "excel" ? "dataset" : "sample_mode",
      message: dataset.source === "excel"
        ? "Excel dataset imported into Supabase."
        : "Workbook unavailable; imported bundled sample mode dataset.",
      imported: results,
      summary: datasetSummary(dataset),
    });
  } catch (err) {
    console.error("Dataset seed route error:", err);
    return NextResponse.json({
      success: false,
      mode: "sample_mode_unavailable",
      error: "Failed to import dataset: " + err.message,
    }, { status: 500 });
  }
}
