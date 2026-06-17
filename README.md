# BidEngine.AI — AI-Powered Bid & Proposal Response Engine

**Transform raw RFP documents into structured, evidence-backed proposal responses using a real AI pipeline.**

> Live deployment: [bid-engine-swart.vercel.app](https://bid-engine-swart.vercel.app)

---

## One-Line Summary

BidEngine.AI parses uploaded RFP documents (PDF/DOCX), extracts atomic procurement requirements using Groq LLM + heuristic NLP, matches each requirement against a capability library via a real LangChain + Supabase pgvector RAG pipeline (with Groq LLM reranking), generates structured proposal draft sections, runs an AI reviewer audit, and produces a GO/NO-GO win score — all persisted per-user in Supabase.

---

## Problem Statement

Bid managers and proposal teams spend days reading through dense RFP documents, manually mapping requirements to past project evidence, and drafting compliant proposal sections. A single RFP may contain 40–80 discrete requirements across eligibility, technical, financial, legal, and submission categories. Missing one mandatory item disqualifies the bid.

BidEngine.AI automates the auditable, repetitive parts of this process: requirement extraction, evidence retrieval, compliance checking, draft generation, quality review, and win probability scoring — leaving the human manager to make the final judgment call.

---

## Features (All Verified in Code)

| Feature | Status | File |
|---------|--------|------|
| PDF upload (browser-side parsing via pdfjs-dist) | ✅ Real | `components/FileUpload.jsx` |
| DOCX upload (server-side via mammoth) | ✅ Real | `lib/pdfParser.js` |
| Requirement extraction — Groq LLM (llama-3.3-70b) | ✅ Real | `app/api/rfp/analyze/route.js` |
| Heuristic NLP requirement extraction (fallback) | ✅ Real | `lib/intelligence.js` |
| CrewAI extraction agent (primary, with JS fallback) | ✅ Real | `ai_worker/crew_pipeline.py`, `lib/crewBridge.js` |
| LangChain RAG pipeline (pgvector + reranker) | ✅ Real | `lib/ragEngine.js` |
| Supabase pgvector evidence_documents table | ✅ Real | `supabase-schema.sql` |
| Groq LLM reranking of retrieved evidence chunks | ✅ Real | `lib/ragEngine.js` (rerankEvidence) |
| AI Draft generation (Groq) | ✅ Real | `app/api/rfp/draft/route.js` |
| Reviewer/auditor agent (Groq) | ✅ Real | `lib/reviewerAgent.js` |
| Win Score / GO-NO-GO calculation | ✅ Real | `lib/datasetAnalysis.js` |
| Supabase workspace persistence per user | ✅ Real | `rfp_workspaces`, `rfp_requirements`, `proposal_drafts` tables |
| AI decision trace (full traceability log) | ✅ Real | `ai_decision_trace` table |
| DOCX export of proposal | ✅ Real | `app/api/rfp/export/route.js` |
| Auth (JWT via Supabase) | ✅ Real | `lib/requestAuth.js` |

---

## AI Architecture

### LLM: Groq (llama-3.3-70b-versatile)

Groq is the **only LLM provider** used. It is called in four places:

1. **Requirement extraction** — `POST /api/rfp/analyze` → `analyzeWithGroq()` extracts structured JSON of requirement categories from raw RFP text.
2. **Evidence reranking** — `rerankEvidence()` in `ragEngine.js` sends retrieved RAG candidates to Groq and asks it to judge YES/NO whether each chunk actually supports the requirement. This is a real LLM reranking step, not a score threshold.
3. **Proposal draft generation** — `POST /api/rfp/draft` generates structured proposal response sections from workspace requirements + evidence.
4. **Reviewer/auditor** — `POST /api/rfp/review` → `reviewProposalWithGroq()` audits the draft for unsupported claims, weak sections, vague language, and missing compliance points, returning GO/NO-GO.

### RAG Pipeline (Real and Active)

The RAG pipeline in `lib/ragEngine.js` is real and runs at compliance-check time:

```
capability_library (Supabase)
  → RecursiveCharacterTextSplitter (LangChain, chunk_size=900, overlap=120)
  → Embedding provider (see below)
  → SupabaseVectorStore (LangChain) → evidence_documents table (pgvector)
  → vectorStore.asRetriever(top_k=6)
  → RunnableSequence (LangChain) → retrieve docs → rerankEvidence() (Groq LLM)
  → buildEvidenceResponse() → compliance_status: pass / partial / fail
```

**This pipeline is active at runtime.** Every call to `POST /api/rfp/match` triggers `syncCapabilityCorpus()` followed by `retrieveCapabilityEvidence()` for each requirement that needs capability evidence.

### Embeddings

The embedding provider is determined at runtime by environment variables, in priority order:

| Priority | Provider | Env Var | Model |
|----------|----------|---------|-------|
| 1 | **Jina** | `JINA_API_KEY` | `jina-embeddings-v3` (1024d → padded to 1536) |
| 2 | **HuggingFace** | `HUGGINGFACE_API_KEY` / `HF_TOKEN` | `BAAI/bge-small-en-v1.5` |
| 3 | **Voyage** | `VOYAGE_API_KEY` | `voyage-3-lite` |
| 4 | **OpenAI** | `OPENAI_API_KEY` | `text-embedding-3-small` |
| 5 | **Local hash** | `ALLOW_LOCAL_HASH_EMBEDDINGS=true` | Deterministic 1536-dim hash (not semantic) |

**If none are configured, RAG is disabled and compliance check fails hard** (no silent fallback to fake data).

**Vector dimensions: 1536** (all providers normalised to this).

**Important limitation:** If using local hash embeddings (`ALLOW_LOCAL_HASH_EMBEDDINGS=true`), retrieval is based on token bucket hashing — not semantic similarity. Retrieved chunks may be irrelevant. This is a prototype fallback only.

### LangChain Components Used

| Component | Used | Where |
|-----------|------|-------|
| `Document` | ✅ Yes | `ragEngine.js` — capability chunks |
| `RecursiveCharacterTextSplitter` | ✅ Yes | `ragEngine.js` — chunk capabilities |
| `SupabaseVectorStore` | ✅ Yes | `ragEngine.js` — pgvector store + retriever |
| `RunnableSequence` | ✅ Yes | `ragEngine.js` — retrieval → reranking chain |
| `vectorStore.asRetriever()` | ✅ Yes | `ragEngine.js` — top-k retriever |
| LangChain LLMs / ChatModels | ❌ No | Groq called directly via `groq-sdk` |
| LangChain Agents | ❌ No | Agents use CrewAI Python subprocess |

### Multi-Agent (CrewAI)

CrewAI is a **real Python subprocess** called from Next.js via `lib/crewBridge.js` using `child_process.spawn`. The Python script `ai_worker/crew_pipeline.py` defines:

| Agent | Role |
|-------|------|
| `RequirementExtractionAgent` | Extracts requirements from raw RFP text |
| `EvidenceMatchingAgent` | Validates/rejects weak evidence |
| `ComplianceAgent` | Classifies each requirement pass/partial/fail |
| `ProposalWriterAgent` | Drafts proposal sections from approved evidence |
| `ReviewerAgent` | Red-team audit of draft |
| `BidStrategyAgent` | GO/NO-GO decision + win probability |

**Deployment limitation:** `child_process.spawn` (Python subprocess) **cannot run on Vercel serverless functions** due to the read-only filesystem and absent Python runtime. On Vercel, CrewAI extraction silently falls back to the direct Groq JS call. The review stage always uses the JS `reviewerAgent.js` (Groq directly). CrewAI only runs locally when Python + crewai package are installed.

---

## System Workflow

```
User uploads PDF or DOCX
        │
        ▼
  FileUpload.jsx (browser)
  PDF → pdfjs-dist (browser-side text extraction)
  DOCX → POST /api/rfp/upload → mammoth (server-side)
        │
        ▼
  POST /api/rfp/analyze
  ├── Try: CrewAI Python subprocess (RequirementExtractionAgent)
  │         ↓ (fails on Vercel → fallback)
  └── analyzeWithGroq() → llama-3.3-70b → structured JSON
  + extractSectionAwareRequirements() — heuristic NLP scanner
  + mergeRequirementCandidates() — dedup + validate
  → INSERT into rfp_requirements (Supabase)
        │
        ▼
  POST /api/rfp/match
  ├── Load capability_library from Supabase (or dataset fallback)
  ├── syncCapabilityCorpus() → chunk + embed → INSERT evidence_documents
  ├── For each requirement needing evidence:
  │   ├── vectorStore.asRetriever().invoke(query) → pgvector cosine search
  │   ├── rerankEvidence() → Groq LLM YES/NO per candidate
  │   └── buildEvidenceResponse() → compliance_status
  └── UPDATE rfp_requirements + INSERT ai_decision_trace
        │
        ▼
  POST /api/rfp/draft
  ├── Load requirements + evidence from workspace
  └── analyzeWithGroq() → llama-3.3-70b → proposal sections
  → INSERT proposal_drafts (Supabase)
        │
        ▼
  POST /api/rfp/review
  └── reviewProposalWithGroq() → Groq audits draft
  → Returns GO/NO-GO + weak sections + improved proposal
        │
        ▼
  POST /api/rfp/score
  └── calculateWinScore() → compliance %, capability match, sector win rate
  → INSERT win_scores (Supabase)
        │
        ▼
  GET /api/rfp/export
  └── docx library → DOCX proposal download
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), React, Tailwind CSS |
| **Backend** | Next.js API Routes (serverless) |
| **Database** | Supabase (PostgreSQL + pgvector extension + Row Level Security) |
| **LLM** | Groq Cloud API — `llama-3.3-70b-versatile` |
| **RAG** | LangChain (`@langchain/core`, `@langchain/community`, `@langchain/textsplitters`) + Supabase pgvector |
| **Embeddings** | Jina / HuggingFace / Voyage / OpenAI (runtime-selected) or local hash fallback |
| **Multi-Agent** | CrewAI ≥ 0.86 (Python subprocess, local only) |
| **PDF Parsing** | `pdfjs-dist` v5 (browser), `mammoth` (server DOCX) |
| **Export** | `docx` npm package — DOCX proposal export |
| **Auth** | Supabase JWT |
| **Dataset** | 120 historical bids + 50 capability records (TEKROWE hackathon dataset) |
| **Deployment** | Vercel (Next.js) |

---

## Environment Variables

### Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Groq (required for LLM)
GROQ_API_KEY=your-groq-api-key
```

### Embedding Provider (one required for real RAG)

```env
# Option 1: Jina (recommended)
JINA_API_KEY=your-jina-api-key

# Option 2: HuggingFace
HUGGINGFACE_API_KEY=your-hf-api-key

# Option 3: Voyage
VOYAGE_API_KEY=your-voyage-api-key

# Option 4: OpenAI
OPENAI_API_KEY=your-openai-api-key

# Option 5: Local hash (prototype only — not semantic)
ALLOW_LOCAL_HASH_EMBEDDINGS=true
```

### Optional (CrewAI, local only)

```env
CREWAI_PYTHON=python3          # Path to Python with crewai installed
CREWAI_MODEL=llama-3.3-70b-versatile
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

---

## Supabase Setup

Run `bid-engine/supabase-schema.sql` in your Supabase SQL Editor.

### Tables

| Table | Purpose |
|-------|---------|
| `rfp_workspaces` | One workspace per uploaded RFP; stores title, status, raw_text |
| `rfp_requirements` | Extracted atomic requirements; stores compliance_status, match results |
| `proposal_drafts` | AI-generated proposal sections per workspace |
| `win_scores` | Calculated win probability + GO/NO-GO decision |
| `evidence_documents` | **pgvector table** — capability chunks with 1536-dim embeddings |
| `ai_decision_trace` | Full RAG traceability log per requirement |
| `capability_library` | 50 company past projects (seeded from dataset) |
| `bid_history` | 120 historical bid outcomes (used for win scoring) |
| `evaluation_criteria_taxonomy` | 15+ RFP evaluation criteria by sector |

### pgvector Function

The SQL creates `match_evidence_documents()` — a stored function that performs cosine similarity search:
```sql
1 - (embedding <=> query_embedding) AS similarity
```
This is called by `SupabaseVectorStore.asRetriever()` via `VECTOR_QUERY_NAME = "match_evidence_documents"`.

---

## How to Run Locally

### Prerequisites

- Node.js 18+
- Supabase project with schema applied
- Groq API key
- Python 3.10+ with `crewai` installed (optional — only for local CrewAI agents)

### Install and Run

```bash
# From the Next.js app directory
cd bid-engine
npm install
npm run dev
```

Opens at `http://localhost:3000`

### CrewAI (Optional — Local Only)

```bash
cd bid-engine/ai_worker
pip install -r requirements.txt
```

Then set `CREWAI_PYTHON=python3` in your `.env`.

---

## Deployment

The app is deployed on Vercel as a Next.js project from the `bid-engine/` subdirectory.

```bash
# Set root directory to bid-engine/ in Vercel project settings
git push origin main
```

Set all environment variables in Vercel → Project Settings → Environment Variables.

**Note:** CrewAI Python subprocess will not run on Vercel. The analyze route automatically falls back to direct Groq JS calls. All other pipeline stages work fully on Vercel.

---

## Known Limitations (Honest)

| Limitation | Detail |
|-----------|--------|
| **Local hash embeddings** | If `ALLOW_LOCAL_HASH_EMBEDDINGS=true` and no real provider configured, retrieval is deterministic hashing — not semantic similarity. Evidence retrieved may be wrong. |
| **CrewAI on Vercel** | Python subprocess (`child_process.spawn`) cannot run on Vercel serverless. CrewAI only works locally. Groq JS is the fallback and works correctly. |
| **Scanned PDFs** | `pdfjs-dist` only extracts text from text-layer PDFs. Image-only/scanned PDFs will produce empty text — no OCR support. |
| **Requirement extraction quality** | LLM extraction quality depends on RFP structure. Badly formatted or image-heavy RFPs may produce fewer/lower-quality requirements. Human review recommended. |
| **Win score is decision-support** | The GO/NO-GO score is derived from compliance % + historical dataset patterns. It is not a guaranteed prediction of bid outcome. |
| **RAG quality with small corpus** | With only 50 capability records, the RAG corpus is small. Some requirements will return no strong match even with a real embedding provider. |
| **Reranker cost** | Every compliance check calls Groq LLM once per evidence-requiring requirement for reranking. A 40-requirement RFP = ~40 Groq calls during matching. |
| **No streaming** | LLM responses are not streamed — the UI waits for full completion before displaying results. |

---

## Demo Flow

1. **Sign up / Login** → creates Supabase-authenticated session
2. **Upload RFP** → upload PDF (browser parsing) or DOCX (server parsing)
3. **Click "Analyze RFP"** → Groq extracts 20–60 atomic requirements → saved to Supabase
4. **Requirements tab** → review extracted requirement matrix (category, priority, section)
5. **Click "Run Compliance Check"** → RAG pipeline runs:
   - Capability library chunked + embedded → stored in `evidence_documents`
   - Cosine search retrieves top-6 evidence chunks per requirement
   - Groq reranks each candidate (YES/NO)
   - compliance_status = pass / partial / fail per requirement
6. **Compliance tab** → review evidence matches, confidence scores, source references
7. **Click "Generate AI Draft"** → Groq writes structured proposal sections → saved to `proposal_drafts`
8. **Draft tab** → read, edit, approve individual draft sections
9. **Click "Run Reviewer"** → Groq audits for unsupported claims, weak sections, missing compliance points → GO/NO-GO recommendation
10. **Reviewer tab** → review audit findings, improved proposal text
11. **Click "Calculate Win Score"** → compliance %, capability match, sector win rate computed
12. **Win Score tab** → view GO/NO-GO decision with score breakdown
13. **Export** → download DOCX proposal

---

## Hackathon Judge Notes

### What Is Technically Real

- **Real pgvector RAG pipeline** — `SupabaseVectorStore`, cosine similarity search via stored SQL function, `RunnableSequence`, top-6 retrieval.
- **Real LangChain usage** — `Document`, `RecursiveCharacterTextSplitter`, `SupabaseVectorStore`, `RunnableSequence`, `asRetriever()` — all imported and executed.
- **Real Groq LLM reranking** — after vector retrieval, each candidate is sent to `llama-3.3-70b` with a strict YES/NO prompt. This is a real second-pass LLM reranking step.
- **Real CrewAI agents** — 6 agents defined with real Groq LLM, running as Python subprocess locally.
- **Real Supabase persistence** — all workflow state (workspaces, requirements, drafts, scores, trace) stored per-user with RLS.
- **Real AI decision trace** — every compliance match inserts a full traceability row into `ai_decision_trace` including the RAG chunk ID, rerank score, and evidence text.
- **Multi-provider embedding system** — runtime-selectable embedding provider with graceful degradation and mismatch detection (re-index if provider changes).

### What Is Prototype-Level

- **Local hash embeddings** — deterministic, not semantic. If configured, RAG retrieval quality is low.
- **CrewAI on Vercel** — Python subprocess cannot run. The multi-agent pipeline is a local-only feature.
- **Win score formula** — heuristic combination of compliance %, dataset-derived win rate, and capability match score. Not a trained ML model.
- **50 capability records** — the corpus is small. In a production system it would be thousands of past project records.

### What Should NOT Be Claimed

- ❌ "CrewAI runs in production on Vercel" — it does not. Python subprocess is blocked.
- ❌ "Semantic retrieval is guaranteed" — only if a real embedding provider key is configured. Local hash embeddings are not semantic.
- ❌ "Win score predicts bid outcome" — it is decision-support tooling, not a ML predictor.
- ❌ "OCR/scanned PDF support" — not implemented. Text-layer PDFs only.

---

## Environment Variables Reference

| Variable | Required | Used in |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All API routes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Auth client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | RAG corpus seeding, admin DB ops |
| `GROQ_API_KEY` | Yes | Extraction, reranking, drafting, review |
| `JINA_API_KEY` | One of these | Real semantic embeddings |
| `HUGGINGFACE_API_KEY` / `HF_TOKEN` | One of these | Real semantic embeddings |
| `VOYAGE_API_KEY` | One of these | Real semantic embeddings |
| `OPENAI_API_KEY` | One of these | Real semantic embeddings |
| `ALLOW_LOCAL_HASH_EMBEDDINGS` | Optional | Hash fallback (prototype) |
| `CREWAI_PYTHON` | Optional | Local CrewAI subprocess |

---

## License

MIT
