import { getEmbeddingProviderInfo, runRagHealthCheck } from "../../bid-engine/lib/ragEngine.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const health = await runRagHealthCheck();
    console.info("[RAG] health_check", health);
    return res.status(health.rag_status === "FAILED" ? 500 : 200).json(health);
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
    return res.status(500).json(health);
  }
}
