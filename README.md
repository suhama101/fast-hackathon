# BidEngine AI

**AI-Powered Bid & Proposal Response Engine**

BidEngine AI automates the most time-intensive parts of bid preparation — parsing RFP documents, extracting individual requirements, matching them against a capability library, drafting compliant proposal responses, and scoring win probability with a GO/NO-GO decision. Built for procurement, sourcing, and contract management teams.

> Live deployment: [bid-engine-swart.vercel.app](https://bid-engine-swart.vercel.app)

---

## What it does

| Step | Feature | Description |
|------|---------|-------------|
| 1 | **Upload RFP** | Upload PDF or DOCX — PDF parsed in browser (pdfjs-dist), DOCX parsed on server (mammoth) |
| 2 | **Extract Requirements** | Groq LLM (llama-3.3-70b) extracts individual requirements — one item per row, max 150 chars each |
| 3 | **Compliance Check** | Requirements matched against capability library using ratio-based keyword scoring |
| 4 | **AI Draft** | Groq generates structured proposal response sections per requirement |
| 5 | **Win Score** | GO/NO-GO decision based on compliance score, capability match, sector win rate from 120 historical bids |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 + Tailwind CSS v4 |
| AI Engine | Groq Cloud API — `llama-3.3-70b-versatile` |
| PDF Parsing | `pdfjs-dist` v5 (browser-side), `mammoth` v1 (server-side DOCX) |
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| Serverless API | Vercel Functions (`/api/**`) |
| Export | `docx` library — DOCX proposal export |
| Dataset | 120 historical bids + 50 capability records (TEKROWE hackathon dataset) |

---

## Project Structure

```
bidengine-ai/
├── src/
│   └── App.tsx                  # Main React SPA — all screens (landing, login, dashboard)
├── api/                         # Vercel serverless functions
│   ├── _lib/
│   │   ├── requestAuth.js       # JWT auth middleware
│   │   └── supabase.js          # Supabase client factory
│   ├── auth/
│   │   ├── login.js             # POST /api/auth/login
│   │   ├── logout.js            # POST /api/auth/logout
│   │   ├── me.js                # GET  /api/auth/me
│   │   └── signup.js            # POST /api/auth/signup
│   ├── rfp/
│   │   ├── analyze.js           # POST /api/rfp/analyze  — Groq extraction + heuristic fallback
│   │   ├── draft.js             # POST /api/rfp/draft    — Groq proposal drafting
│   │   ├── match.js             # POST /api/rfp/match    — capability matching
│   │   ├── score.js             # POST /api/rfp/score    — win probability scoring
│   │   └── upload.js            # POST /api/rfp/upload   — file upload + workspace creation
│   └── workspaces.js            # GET/POST /api/workspaces
├── bid-engine/                  # Next.js 14 sub-project (components + lib shared by API)
│   ├── components/
│   │   ├── Navbar.jsx           # Single top navbar with Step 1–5 tabs
│   │   ├── FileUpload.jsx       # PDF (browser) + DOCX (server) upload
│   │   ├── RequirementsList.jsx # Extracted requirements table
│   │   ├── ComplianceChecker.jsx
│   │   ├── ProposalDraft.jsx
│   │   └── WinScoreDashboard.jsx
│   └── lib/
│       ├── groqClient.js        # Groq SDK wrapper
│       ├── pdfParser.js         # DOCX server parser (mammoth)
│       ├── datasetAnalysis.js   # Win scoring, capability matching, NER
│       ├── datasetLoader.js     # Loads hackathon dataset (bid history + capabilities)
│       └── sampleData.js        # Evaluation criteria taxonomy
├── public/
│   └── sample-rfps/             # Sample TXT RFPs (IT Services, Construction, Logistics, Cybersecurity)
├── assets/
│   └── Problem#1_Sample_Datasets (TEKROWE).xlsx  # 120 bid history + 50 capability records
├── package.json                 # Root — Vite + React app
├── vite.config.ts               # Vite config with pdfjs-dist optimisation
└── supabase-schema.sql          # Full database schema
```

---

## Local Setup

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Groq Cloud](https://console.groq.com) API key (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/suhama101/-BidEngine.git
cd BidEngine
npm install
```

### 2. Environment variables

Create a `.env` file in the root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Groq
GROQ_API_KEY=your-groq-api-key
```

### 3. Database setup

Run `supabase-schema.sql` in your Supabase SQL Editor. It creates:

| Table | Purpose |
|-------|---------|
| `rfp_workspaces` | One workspace per uploaded RFP |
| `rfp_requirements` | Extracted individual requirements |
| `proposal_drafts` | AI-generated response sections |
| `win_scores` | Stored win probability scores |
| `capability_library` | 50 company past projects |
| `bid_history` | 120 historical bid outcomes |
| `evaluation_criteria_taxonomy` | 15+ RFP evaluation criteria by sector |

### 4. Run locally

```bash
npm run dev
```

Opens at `http://localhost:3000`

---

## API Reference

All endpoints require `Authorization: Bearer <token>` header.

### Upload RFP
```
POST /api/rfp/upload
Content-Type: multipart/form-data   (for DOCX)
Content-Type: application/json      (for pre-extracted text from PDF)

Body (JSON): { rawText, fileName, title }
Body (form): file (DOCX), title

Response: { workspaceId, workspace, rawText, characterCount }
```

### Analyze RFP
```
POST /api/rfp/analyze
Body: { rawText, workspaceId?, bidTitle? }

Response: { workspaceId, requirements[], count }
```
Uses Groq `llama-3.3-70b-versatile` to extract individual requirements.
Falls back to regex heuristics if Groq is unavailable.
Each requirement: max 200 chars, capped at 30 items total.

### Match Capabilities
```
POST /api/rfp/match
Body: { workspaceId }

Response: { matches[], requirements[], capability_count }
```
Ratio-based keyword matching. `matchRatio >= 0.4 → pass`, `>= 0.15 → partial`, else `fail`.

### Generate Draft
```
POST /api/rfp/draft
Body: { workspaceId, requirementId?, tone?, capabilityInfo? }

Response: { drafts[], count }
```

### Score Win Probability
```
POST /api/rfp/score
Body: { workspaceId, rawText? }

Response: { scores, record, decision: "GO"|"NO-GO" }
```
GO/NO-GO threshold: `compliance_score >= 70 → GO`.

### Export Proposal
```
GET /api/rfp/export?workspaceId=<uuid>

Response: DOCX file download
```

---

## Key Design Decisions

**PDF parsed in browser, not server**
`pdfjs-dist` v5 uses browser APIs (`DOMMatrix`) that crash in Node.js serverless. Solution: `FileUpload.jsx` runs `pdfjs-dist` in the browser, extracts text, then POSTs the text as JSON to the API. Server only handles DOCX via `mammoth`.

**Individual requirements, not paragraphs**
The Groq prompt enforces `max 150 chars per item` and `one specific actionable item` per array element. Each array item becomes exactly one database row.

**Real win scoring**
`calculateWinScore()` uses 120 rows of historical bid data from the TEKROWE dataset. GO/NO-GO is driven by `compliance_score` (pass_count / total_mandatory × 100), not a random default.

**Single navbar**
One `<Navbar>` component with Step 1–5 tabs. The duplicate tab strip that previously appeared below the workspace heading has been removed from `App.tsx`.

---

## Environment Variables Reference

| Variable | Required | Used in |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All API routes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Auth client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin DB operations |
| `GROQ_API_KEY` | Yes | `/api/rfp/analyze`, `/api/rfp/draft` |

---

## Sample Data

The `assets/` folder contains the TEKROWE hackathon dataset:

- **Bid History** — 120 historical bids with outcome (Win/Loss), score %, compliance %, response time, sector
- **Capability Library** — 50 past projects with domain, certification, contract value, client type, year

Sample RFPs are available in `public/sample-rfps/` for testing without uploading a real document:
- `rfp-it-services.txt`
- `rfp-construction.txt`
- `rfp-logistics.txt`
- `rfp-cybersecurity-deployment.txt`

---

## Deployment

The app is deployed on Vercel. Push to `main` triggers automatic redeploy.

```bash
git add .
git commit -m "your changes"
git push origin main
```

Set all environment variables in Vercel dashboard → Project Settings → Environment Variables.

---

## License

MIT
