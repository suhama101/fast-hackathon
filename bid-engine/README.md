# BidEngine AI 🚀
### An AI-Powered Bid & Proposal Response Engine

BidEngine AI is an enterprise-grade automation engine designed to parse Requests for Proposals (RFPs), extract explicit and implicit requirements, perform automated compliance checking, generate high-scoring draft answers using llama-3.3-70b-versatile, and calculate real-time proposal win ratings.

---

## 🛠 Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + Lucide Icons
- **AI Engine:** Groq Cloud API (`llama-3.3-70b-versatile`)
- **Database & Auth:** Supabase (PostgreSQL, Client & Service clients)
- **Deployment:** Vercel

---

## 📁 Key Directory Structure
```
bid-engine/
├── app/                  # Next.js 14 App Router pages and APIs
│   ├── layout.jsx        # Root Layout & Tailwind Theme provider
│   ├── page.jsx          # Landing Page
│   ├── dashboard/        # Interactive Bid & Response Workspace
│   ├── login/            # Authentication
│   └── api/              # Server-side App Router API routes
├── components/           # Modular UX Components
│   ├── Navbar.jsx        # App Header
│   ├── FileUpload.jsx    # Drag and Drop RFP Parser UI
│   ├── RequirementsList.jsx
│   ├── ComplianceChecker.jsx
│   └── WinScoreDashboard.jsx
└── lib/                  # Server utilities & SDK client instances
```

---

## ⚙️ Initial Setup

1. **Clone & Install Dependencies**
   ```bash
   cd bid-engine
   npm install
   ```

2. **Configure Environment Variables**
   Create a `.env.local` file by copying `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your:
   - Supabase URL & Anon Key (from API settings)
   - Supabase Service Role Key
   - Groq API Key

3. **Supabase Database Schema Setup**
   Run the following SQL in your Supabase SQL Editor to establish standard bid tracking:
   
   ```sql
   -- Create biddings table
   create table biddings (
     id uuid default gen_random_uuid() primary key,
     user_id uuid references auth.users(id),
     title text not null,
     industry text,
     budget text,
     deadline timestamptz,
     raw_text text,
     requirements jsonb default '[]'::jsonb,
     win_score integer default 0,
     score_insights jsonb default '{}'::jsonb,
     draft_sections jsonb default '{}'::jsonb,
     created_at timestamptz default timezone('utc'::text, now()) not null
   );
   ```

4. **Running Locally**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to interact with the Next.js App!
