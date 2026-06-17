import { Document } from "@langchain/core/documents";
import { RunnableSequence } from "@langchain/core/runnables";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { analyzeWithGroq } from "./groqClient.js";
import { getSupabaseAdminOrNull } from "./supabaseClient.js";
import { inferRequirementMetadata } from "./intelligence.js";

const VECTOR_TABLE = "evidence_documents";
const VECTOR_QUERY_NAME = "match_evidence_documents";
const EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_TOP_K = 6;
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;
const INSERT_BATCH_SIZE = 100;

const FALLBACK_STOPWORDS = new Set([
  "the", "and", "for", "with", "must", "shall", "will", "this", "that", "from", "have", "has",
  "are", "our", "your", "rfp", "rfq", "tender", "proposal", "bid", "response", "project",
  "requirement", "requirements", "document", "documents", "vendor", "supplier", "company",
]);

const unique = (values) => [...new Set(values)];

const ragLog = (message, details = {}) => {
  console.info(`[RAG] ${message}`, details);
};

const ragWarn = (message, details = {}) => {
  console.warn(`[RAG WARNING] ${message}`, details);
};

export const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !FALLBACK_STOPWORDS.has(token));

const hashToken = (token) => {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const normalizeVector = (vector) => {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm) return vector;
  return vector.map((value) => value / norm);
};

export const embedText = (text, dimensions = 96) => {
  const vector = new Array(dimensions).fill(0);
  tokenize(text).forEach((token) => {
    const bucket = hashToken(token) % dimensions;
    vector[bucket] += 1;
  });
  return normalizeVector(vector);
};

export const cosineSimilarity = (left = [], right = []) => {
  const size = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < size; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

const getSupabaseClient = () => {
  const client = getSupabaseAdminOrNull();
  if (!client) {
    throw new Error("Supabase admin client is unavailable. Configure SUPABASE_SERVICE_ROLE_KEY.");
  }
  return client;
};

const getEmbeddings = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for real embeddings.");
  }

  return new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: EMBEDDING_MODEL,
  });
};

const getCorpusCount = async (supabase) => {
  const { count, error } = await supabase
    .from(VECTOR_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("source_type", "capability_library");

  if (error) {
    throw new Error(`Failed to inspect RAG corpus: ${error.message}`);
  }

  return Number(count || 0);
};

const inferCapabilityEvidenceTypes = (capability = {}) => {
  const text = buildCapabilityDocument(capability).toLowerCase();
  const evidenceTypes = new Set(["Past Project"]);

  if (/\bcv\b|curriculum vitae|team profile|resource profile/.test(text)) evidenceTypes.add("CV");
  if (/methodology|approach|implementation plan|delivery plan/.test(text)) evidenceTypes.add("Methodology");
  if (/work plan|project schedule|timeline|activity plan/.test(text)) evidenceTypes.add("Work Plan");
  if (/certificate|certified|certification/.test(text)) evidenceTypes.add("Certification");
  if (/legal declaration|disclosure|undertaking/.test(text)) evidenceTypes.add("Legal Declaration");
  if (/financial statement|audit report|audited account|balance sheet/.test(text)) evidenceTypes.add("Financial Statement");
  if (/tax registration|ntn|tax certificate/.test(text)) evidenceTypes.add("Tax Document");
  if (/registration certificate|incorporation|secp/.test(text)) evidenceTypes.add("Registration Document");
  if (/policy compliance|policy|conflict of interest|related party|anti fraud|anti corruption/.test(text)) evidenceTypes.add("Policy Compliance");

  return [...evidenceTypes];
};

const buildCapabilityDocument = (capability = {}) => [
  capability.external_id,
  capability.id,
  capability.project_name,
  capability.project_summary,
  capability.description,
  capability.domain,
  capability.client_type,
  capability.certification,
  capability.certification_name,
  Array.isArray(capability.certifications) ? capability.certifications.join(" ") : capability.certifications,
  Array.isArray(capability.skills) ? capability.skills.join(" ") : capability.skills,
  Array.isArray(capability.keywords) ? capability.keywords.join(" ") : capability.keywords,
  capability.year_completed,
  capability.contract_value,
].filter(Boolean).join(" ");

const enrichCapability = (capability = {}) => {
  const text = buildCapabilityDocument(capability);
  const keywords = unique(tokenize(text)).slice(0, 24);
  const certificationName = Array.isArray(capability.certifications) && capability.certifications.length
    ? capability.certifications[0]
    : capability.certification || capability.certification_name || "";

  return {
    ...capability,
    sector: capability.sector || capability.client_type || capability.domain || "General",
    domain: capability.domain || capability.client_type || "General",
    year: capability.year_completed || capability.year || null,
    certification_name: certificationName || "",
    keywords,
    evidence_type: capability.evidence_type || inferCapabilityEvidenceTypes(capability)[0] || "Past Project",
    evidence_types: capability.evidence_types || inferCapabilityEvidenceTypes(capability),
  };
};

const toMetadata = (capability = {}) => {
  const enriched = enrichCapability(capability);
  return {
    source_type: "capability_library",
    source_id: enriched.external_id || enriched.id || enriched.project_name || "CAPABILITY",
    evidence_type: enriched.evidence_type,
    evidence_types: enriched.evidence_types,
    sector: enriched.sector || "General",
    client_type: enriched.client_type || "Unknown",
    domain: enriched.domain || "General",
    year: enriched.year || null,
    project_name: enriched.project_name || "",
    certification_name: enriched.certification_name || "",
  };
};

const capabilityToDocuments = async (capability = {}) => {
  const metadata = toMetadata(capability);
  const contentParts = [
    `Project: ${capability.project_name || capability.project_summary || capability.description || "Capability Record"}`,
    capability.project_summary || capability.description || "",
    capability.cv || capability.cv_text || "",
    capability.methodology || capability.methodology_text || "",
    capability.financial_document || capability.financial_text || "",
    capability.document_text || capability.documents || "",
    capability.certification || "",
    Array.isArray(capability.certifications) ? capability.certifications.join(", ") : "",
    Array.isArray(capability.skills) ? capability.skills.join(", ") : "",
    capability.contract_value ? `Financial value: ${capability.contract_value}` : "",
    capability.client_type ? `Client type: ${capability.client_type}` : "",
    capability.domain ? `Domain: ${capability.domain}` : "",
    capability.year_completed || capability.year ? `Year: ${capability.year_completed || capability.year}` : "",
  ].filter(Boolean).join("\n\n");

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const documents = await splitter.splitDocuments([
    new Document({
      pageContent: contentParts,
      metadata,
    }),
  ]);

  return documents.map((doc, index) => new Document({
    pageContent: doc.pageContent,
    metadata: {
      ...doc.metadata,
      chunk_index: index,
      chunk_id: `${metadata.source_id}:${index}`,
    },
  }));
};

export const syncCapabilityCorpus = async (capabilities = [], { force = false } = {}) => {
  const supabase = getSupabaseClient();
  const capabilityCount = capabilities.length;
  const existingCount = await getCorpusCount(supabase);

  ragLog("corpus_sync_start", {
    capability_count: capabilityCount,
    existing_rows: existingCount,
    force,
  });

  if (!force && existingCount > 0) {
    ragLog("corpus_sync_skipped", {
      reason: "vector_corpus_present",
      existing_rows: existingCount,
    });
    return {
      synced: false,
      reason: "vector_corpus_present",
      capabilityCount,
      existingRows: existingCount,
      documentsChunked: 0,
      embeddingsGenerated: 0,
      rowsInserted: 0,
    };
  }

  const { error: deleteError } = await supabase
    .from(VECTOR_TABLE)
    .delete()
    .eq("source_type", "capability_library");

  if (deleteError) {
    throw new Error(`Failed to clear old RAG corpus rows: ${deleteError.message}`);
  }

  const documents = [];
  for (const capability of capabilities) {
    const chunks = await capabilityToDocuments(capability);
    documents.push(...chunks);
  }

  ragLog("documents_chunked", {
    capability_count: capabilityCount,
    documents_chunked: documents.length,
  });

  if (!documents.length) {
    ragWarn("corpus_sync_empty_documents", {
      capability_count: capabilityCount,
    });
    return {
      synced: false,
      reason: "no_documents",
      capabilityCount,
      existingRows: existingCount,
      documentsChunked: 0,
      embeddingsGenerated: 0,
      rowsInserted: 0,
    };
  }

  const embeddingsClient = getEmbeddings();
  let embeddings = [];
  try {
    embeddings = await embeddingsClient.embedDocuments(documents.map((doc) => doc.pageContent));
  } catch (error) {
    ragWarn("embedding_generation_failed", {
      capability_count: capabilityCount,
      documents_chunked: documents.length,
      error: error.message,
    });
    throw new Error(`Failed to generate OpenAI embeddings for RAG corpus: ${error.message}`);
  }

  ragLog("embeddings_generated", {
    model: EMBEDDING_MODEL,
    documents_chunked: documents.length,
    embeddings_generated: embeddings.length,
  });

  if (embeddings.length !== documents.length) {
    throw new Error(`Embedding count mismatch: generated ${embeddings.length} for ${documents.length} documents.`);
  }

  const rows = documents.map((doc, index) => ({
    source_type: doc.metadata?.source_type || "capability_library",
    source_id: doc.metadata?.source_id || `CAPABILITY-${index + 1}`,
    workspace_id: doc.metadata?.workspace_id || null,
    chunk_index: Number(doc.metadata?.chunk_index || 0),
    content: doc.pageContent,
    metadata: doc.metadata || {},
    embedding: embeddings[index],
  }));

  let rowsInserted = 0;
  for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
    const batch = rows.slice(start, start + INSERT_BATCH_SIZE);
    const { data, error } = await supabase
      .from(VECTOR_TABLE)
      .insert(batch)
      .select("id");

    if (error) {
      ragWarn("corpus_insert_failed", {
        batch_start: start,
        batch_size: batch.length,
        error: error.message,
      });
      throw new Error(`Failed to insert RAG corpus rows into ${VECTOR_TABLE}: ${error.message}`);
    }

    rowsInserted += data?.length || batch.length;
    ragLog("corpus_insert_batch", {
      batch_start: start,
      batch_size: batch.length,
      rows_inserted_total: rowsInserted,
    });
  }

  const finalCount = await getCorpusCount(supabase);
  ragLog("corpus_sync_complete", {
    capability_count: capabilityCount,
    documents_chunked: documents.length,
    embeddings_generated: embeddings.length,
    rows_inserted: rowsInserted,
    final_rows: finalCount,
  });

  return {
    synced: true,
    documentCount: documents.length,
    capabilityCount,
    existingRows: existingCount,
    documentsChunked: documents.length,
    embeddingsGenerated: embeddings.length,
    rowsInserted,
    finalRows: finalCount,
  };
};

const createVectorStore = async (capabilities = [], options = {}) => {
  const supabase = getSupabaseClient();
  const syncStats = await syncCapabilityCorpus(capabilities, { force: Boolean(options.forceSync) });
  const finalCount = syncStats.finalRows ?? await getCorpusCount(supabase);

  if (capabilities.length > 0 && finalCount === 0) {
    throw new Error("RAG corpus is empty after synchronization. Compliance Check cannot use vector retrieval.");
  }

  const vectorStore = new SupabaseVectorStore(getEmbeddings(), {
    client: supabase,
    tableName: VECTOR_TABLE,
    queryName: VECTOR_QUERY_NAME,
  });

  return { vectorStore, syncStats: { ...syncStats, finalRows: finalCount } };
};

const rerankEvidence = async ({ requirementText, requirementMeta, candidates = [] }) => {
  if (!candidates.length) return [];

  const systemPrompt = "You are a strict evidence reranker. Return JSON only.";
  const userPrompt = `You must decide whether each evidence chunk actually supports the requirement.

Requirement:
${requirementText}

Requirement metadata:
${JSON.stringify(requirementMeta)}

Evidence candidates:
${JSON.stringify(candidates.map((item, index) => ({
  index,
  id: item.id || item.metadata?.chunk_id || item.metadata?.source_id || `cand-${index + 1}`,
  content: item.pageContent || item.content || "",
  similarity: item.similarity,
  metadata: item.metadata || {},
})))}

Return JSON in this exact shape:
{
  "ranked_candidates": [
    {
      "id": "",
      "support": "YES or NO",
      "score": 0,
      "reason": "short explanation"
    }
  ]
}

Rules:
- Reject weak semantic matches.
- "Related but not proving the requirement" must be NO.
- Only score YES when the evidence actually supports the requirement.`;

  const result = await analyzeWithGroq(userPrompt, systemPrompt);
  const ranked = Array.isArray(result?.ranked_candidates) ? result.ranked_candidates : [];
  const rankedMap = new Map(ranked.map((item) => [String(item.id || ""), item]));

  return candidates.map((candidate, index) => {
    const key = String(candidate.id || candidate.metadata?.chunk_id || candidate.metadata?.source_id || `cand-${index + 1}`);
    const reranked = rankedMap.get(key) || {};
    return {
      ...candidate,
      rerank_support: String(reranked.support || "NO").toUpperCase() === "YES",
      rerank_score: Number(reranked.score ?? candidate.similarity ?? 0),
      rerank_reason: String(reranked.reason || ""),
    };
  }).sort((left, right) => Number(right.rerank_score || 0) - Number(left.rerank_score || 0));
};

const buildRagUnavailableResponse = (requirementMeta, queryText, warning, details = {}) => ({
  compliance_status: "fail",
  match_status: "No Match",
  confidence_score: 0,
  match_score: 0,
  evidence_type: requirementMeta.expected_evidence_type,
  matched_evidence: "RAG unavailable: no verified vector evidence was retrieved.",
  evidence: "RAG unavailable: no verified vector evidence was retrieved.",
  reason: warning,
  source: "",
  evidence_items: [],
  source_references: [],
  matched_terms: [],
  requirement_category: requirementMeta.category,
  expected_evidence_type: requirementMeta.expected_evidence_type,
  rag_warning: warning,
  rag_details: details,
  traceability: {
    query: queryText,
    approved_evidence: null,
    rejected_candidates: [],
    rag_warning: warning,
    rag_details: details,
  },
});

const buildEvidenceResponse = (requirementMeta, best, ranked, queryText, syncStats = null) => {
  if (!best) {
    return {
      compliance_status: "fail",
      match_status: "No Match",
      confidence_score: 0,
      match_score: 0,
      evidence_type: requirementMeta.expected_evidence_type,
      matched_evidence: "No verified supporting evidence available.",
      evidence: "No verified supporting evidence available.",
      reason: "No evidence passed the vector search and reranking thresholds.",
      source: "",
      evidence_items: [],
      source_references: [],
      matched_terms: [],
      requirement_category: requirementMeta.category,
      expected_evidence_type: requirementMeta.expected_evidence_type,
      rag_warning: ranked.length ? null : "RAG vector search returned no candidates.",
      rag_details: syncStats,
      traceability: {
        query: queryText,
        approved_evidence: null,
        rejected_candidates: ranked,
        rag_details: syncStats,
      },
    };
  }

  const evidenceText = best.pageContent || best.content || "No verified supporting evidence available.";
  const sourceReference = best.metadata?.source_id || best.metadata?.chunk_id || best.id || "EVIDENCE";
  const supportReason = best.rerank_support
    ? `Direct semantic support found in ${sourceReference}.`
    : `Evidence was retrieved but reranking judged it insufficient for direct support.`;

  return {
    compliance_status: best.rerank_support ? "pass" : "partial",
    match_status: best.rerank_support ? "Strong Match" : "Partial Match",
    confidence_score: Math.round(Number(best.rerank_score || best.similarity || 0) * 100),
    match_score: Number(best.rerank_score || best.similarity || 0),
    evidence_type: best.metadata?.evidence_type || requirementMeta.expected_evidence_type,
    matched_evidence: `${sourceReference}: ${evidenceText.slice(0, 420)}`,
    evidence: `${sourceReference}: ${evidenceText.slice(0, 420)}`,
    reason: `${supportReason} Best source: ${best.metadata?.project_name || best.metadata?.source_id || "Capability record"}.`,
    source: best.metadata?.project_name || best.metadata?.source_id || best.id || "",
    evidence_items: ranked.slice(0, 3).map((item) => ({
      source_reference: item.metadata?.source_id || item.metadata?.chunk_id || item.id || "EVIDENCE",
      project_name: item.metadata?.project_name || item.metadata?.source_id || "Capability Record",
      summary: (item.pageContent || item.content || "").slice(0, 500),
      evidence_type: item.metadata?.evidence_type || "Past Project",
      match_score: Math.round(Number(item.rerank_score || item.similarity || 0) * 100),
      matched_terms: unique(tokenize(item.pageContent || item.content || queryText)).slice(0, 12),
      domain: item.metadata?.domain || "General",
      sector: item.metadata?.sector || "General",
      year: item.metadata?.year || null,
      certification_name: item.metadata?.certification_name || "",
      keywords: unique(tokenize(item.pageContent || item.content || "")).slice(0, 24),
    })),
    source_references: ranked.slice(0, 3).map((item) => item.metadata?.source_id || item.metadata?.chunk_id || item.id || "EVIDENCE"),
    matched_terms: unique(tokenize(evidenceText)).slice(0, 12),
    requirement_category: requirementMeta.category,
    expected_evidence_type: requirementMeta.expected_evidence_type,
    rag_warning: null,
    rag_details: syncStats,
    traceability: {
      query: queryText,
      approved_evidence: best,
      rejected_candidates: ranked.filter((item) => !item.rerank_support),
      rag_details: syncStats,
    },
  };
};

export const buildCapabilityIndex = (capabilities = []) => capabilities.map((capability) => {
  const enriched = enrichCapability(capability);
  return {
    ...enriched,
    source_reference: capability.external_id || capability.id || capability.project_name || "CAPABILITY",
    vector_ready: Boolean(process.env.OPENAI_API_KEY),
  };
});

export const retrieveCapabilityEvidence = async (requirement, capabilities = [], options = {}) => {
  const requirementText = String(
    requirement?.requirement_text
      || requirement?.requirement
      || requirement?.description
      || requirement?.title
      || requirement?.text
      || ""
  );
  const requirementMeta = inferRequirementMetadata(
    requirementText,
    requirement?.source_section || "",
    requirement?.source_text || ""
  );
  const queryText = [
    requirementText,
    requirement?.source_section || "",
    requirementMeta.category,
    requirementMeta.expected_evidence_type,
    ...(options.entities?.deadlines || []),
    ...(options.entities?.budgets || []),
    ...(options.entities?.mandatory_clauses || []),
  ].join(" ").trim();

  try {
    if (!process.env.OPENAI_API_KEY) {
      const warning = "RAG disabled: OPENAI_API_KEY is missing, so embeddings cannot be generated.";
      ragWarn("retrieval_blocked", { reason: warning });
      return buildRagUnavailableResponse(requirementMeta, queryText, warning, {
        capability_count: capabilities.length,
        corpus_ready: false,
      });
    }

    const { vectorStore, syncStats } = await createVectorStore(capabilities, options);
    const retriever = vectorStore.asRetriever(DEFAULT_TOP_K);
    const retrievalChain = RunnableSequence.from([
      async (input) => ({ ...input, query: input.query || queryText }),
      async (input) => {
        const docs = await retriever.invoke(input.query);
        return { ...input, docs };
      },
      async (input) => {
        const candidates = (input.docs || []).map((doc) => ({
          id: doc.metadata?.chunk_id || doc.metadata?.source_id,
          pageContent: doc.pageContent,
          metadata: doc.metadata,
          similarity: doc.metadata?.similarity || 0,
        }));
        const reranked = await rerankEvidence({
          requirementText,
          requirementMeta,
          candidates,
        });
        return { ...input, reranked };
      },
    ]);

    const chainResult = await retrievalChain.invoke({ query: queryText });
    const ranked = chainResult.reranked || [];
    const approved = ranked.filter((item) => item.rerank_support && Number(item.rerank_score || 0) >= 0.15);
    const best = approved[0] || ranked[0] || null;

    if (!best || (!best.rerank_support && Number(best.rerank_score || 0) < 0.15)) {
      return buildEvidenceResponse(requirementMeta, null, ranked, queryText, syncStats);
    }

    return buildEvidenceResponse(requirementMeta, best, ranked, queryText, syncStats);
  } catch (error) {
    const warning = `RAG retrieval failed: ${error.message}`;
    ragWarn("retrieval_failed", {
      capability_count: capabilities.length,
      error: error.message,
    });
    return buildRagUnavailableResponse(requirementMeta, queryText, warning, {
      capability_count: capabilities.length,
      corpus_ready: false,
    });
  }
};

export const buildEvidenceContext = (evidenceItems = []) =>
  evidenceItems
    .map((item) => `${item.source_reference}: ${item.project_name} | ${item.summary}`)
    .join("\n");
