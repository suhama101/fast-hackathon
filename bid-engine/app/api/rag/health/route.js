import { NextResponse } from "next/server";
import { getEmbeddingProviderInfo, runRagHealthCheck } from "../../../../lib/ragEngine";

export async function GET() {
  try {
    const health = await runRagHealthCheck();
    const status = health.rag_status === "FAILED" ? 500 : 200;
    console.info("[RAG] health_check", health);
    return NextResponse.json(health, { status });
  } catch (error) {
    const embeddingInfo = getEmbeddingProviderInfo();
    const health = {
      vector_enabled: false,
      evidence_table_exists: false,
      capability_rows: 0,
      evidence_rows: 0,
      embedding_column_exists: false,
      embedding_generation: "failed",
      vector_insert: "failed",
      vector_search: "failed",
      embedding_provider: embeddingInfo.provider,
      embedding_model: embeddingInfo.model,
      vector_dimensions: embeddingInfo.dimensions,
      real_embeddings: embeddingInfo.real_embeddings,
      rag_status: "FAILED",
      reason: error.message,
    };
    console.error("[RAG] health_check_failed", health);
    return NextResponse.json(health, { status: 500 });
  }
}
