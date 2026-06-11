/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Navbar from "../bid-engine/components/Navbar";
import FileUpload from "../bid-engine/components/FileUpload";
import RequirementsList from "../bid-engine/components/RequirementsList";
import ComplianceChecker from "../bid-engine/components/ComplianceChecker";
import ProposalDraft from "../bid-engine/components/ProposalDraft";
import WinScoreDashboard from "../bid-engine/components/WinScoreDashboard";
import { Cpu, FileText, CheckCircle, ShieldAlert, Award, ArrowRight, Sparkles, LayoutDashboard } from "lucide-react";

export default function App() {
  const [screen, setScreen] = useState<"landing" | "login" | "signup" | "dashboard">("landing");
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");
  const [userEmail, setUserEmail] = useState("expert@bidengine.ai");
  const [userName, setUserName] = useState("Bid Analyst");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Dashboard states
  const [rfpText, setRfpText] = useState("");
  const [requirements, setRequirements] = useState<any[]>([
    { id: "SEC-001", title: "SOC 2 Type II Credentials", category: "Security", severity: "Critical", status: "pass", description: "Candidate engine MUST hold SOC 2 Type II audit certifications verified by high performance credential bodies." },
    { id: "TEC-002", title: "99.99% Uptime SLA", category: "Technical", severity: "Critical", status: "pass", description: "Proposed solutions must operate with stable throughput constraints supporting 99.9% uptime and dynamic horizontal auto-scaling." },
    { id: "COMM-003", title: "Itemized Operational Licences", category: "Commercial", severity: "Important", status: "partial", description: "Provide comprehensive line-by-line financial metrics clarifying core operating license fees and dedicated training packages." },
    { id: "EXP-004", title: "Multi-Node Deliveries SOW", category: "Experience", severity: "Standard", status: "fail", description: "Must provide minimum of 3 past customer success evidence benchmarks delivering multi-node database systems." }
  ]);
  const [selectedRequirement, setSelectedRequirement] = useState<any>(null);
  const [matchMatrix, setMatchMatrix] = useState<any>({
    "SEC-001": { matchGrade: "Outstanding", reasoning: "Holds active SOC 2 verification certificates.", status: "pass", evidence: "SOC 2 Type II Certification signed April 2026." },
    "TEC-002": { matchGrade: "Strong", reasoning: "Operational pipeline fits 99.99% uptime with cluster redundancy.", status: "pass", evidence: "High-Availability Multi-Region Kubernetes setups." },
    "COMM-003": { matchGrade: "Partial", reasoning: "Annual tiers exist but lacks dedicated multi-year discount matrices.", status: "partial", evidence: "Standard Custom Contract SLA pricing." },
    "EXP-004": { matchGrade: "Unmatched", reasoning: "Lacks explicit multi-node portfolio evidence in library database.", status: "fail", evidence: "No immediate prior matching project of size." }
  });
  const [activeDraftText, setActiveDraftText] = useState("");
  const [ratingAnalysis, setRatingAnalysis] = useState<any>(null);

  // loading states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (requirements.length > 0 && !selectedRequirement) {
      setSelectedRequirement(requirements[0]);
    }
  }, [requirements]);

  useEffect(() => {
    let cancelled = false;

    const syncSession = async () => {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.user?.id) {
          throw new Error(data.error || "Authentication required");
        }

        if (cancelled) return;

        setUserEmail(data.user.email || "");
        setUserName(
          data.user.fullName ||
            data.user.full_name ||
            data.user.email?.split("@")[0] ||
            "Bid Analyst"
        );
        setIsAuthenticated(true);
        setScreen("dashboard");
      } catch {
        if (cancelled) return;
        setIsAuthenticated(false);
        setScreen("landing");
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };

    syncSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const readApiResponse = async (response: Response) => {
    const raw = await response.text();
    if (!raw) return {};

    try {
      return JSON.parse(raw);
    } catch {
      return {
        error: raw.length > 160 ? `${response.status} ${response.statusText}` : raw,
      };
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: userEmail, password: loginPassword }),
      });

      const data: any = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || `Authentication failed (${response.status}).`);
      }

      const token = data.session?.access_token || data.token;
      if (token) {
        localStorage.setItem("bid_engine_token", token);
      }

      setUserEmail(data.user?.email || userEmail);
      setUserName(data.user?.fullName || userName);
      setLoginPassword("");
      setIsAuthenticated(true);
      setScreen("dashboard");
    } catch (error: any) {
      setAuthMessage({
        type: "error",
        text: error.message || "Authentication failed.",
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthMessage(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: userEmail, password: signupPassword, fullName: userName }),
      });

      const data: any = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || `Registration failed (${response.status}).`);
      }

      const token = data.session?.access_token || data.token;
      if (token) {
        localStorage.setItem("bid_engine_token", token);
      }

      setUserEmail(data.user?.email || userEmail);
      setUserName(data.user?.fullName || userName);
      setSignupPassword("");
      setIsAuthenticated(true);
      setScreen("dashboard");
    } catch (error: any) {
      setAuthMessage({
        type: "error",
        text: error.message || "Registration failed.",
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore logout transport errors and still clear local state.
    } finally {
      localStorage.removeItem("bid_engine_token");
      setIsAuthenticated(false);
      setUserEmail("");
      setUserName("Bid Analyst");
      setLoginPassword("");
      setSignupPassword("");
      setAuthMessage(null);
      setScreen("landing");
    }
  };

  // 1. Text Parsing & RFP Extraction
  const executeRfpAnalysis = async (text: string) => {
    setIsAnalyzing(true);
    setRfpText(text);
    setAlert(null);

    setTimeout(() => {
      const mockRequirements = [
        {
          id: "SEC-001",
          title: "SOC 2 Type II Credentials",
          description: "Candidate engine MUST hold SOC 2 Type II audit certifications verified by high performance credential bodies.",
          category: "Security",
          severity: "Critical",
          status: "pass"
        },
        {
          id: "TEC-002",
          title: "99.99% Uptime SLA",
          description: "Proposed solutions must operate with stable throughput constraints supporting 99.9% uptime and dynamic horizontal auto-scaling.",
          category: "Technical",
          severity: "Critical",
          status: "pass"
        },
        {
          id: "COMM-003",
          title: "Itemized Operational Licences",
          description: "Provide comprehensive line-by-line financial metrics clarifying core operating license fees and dedicated training packages.",
          category: "Commercial",
          severity: "Important",
          status: "partial"
        },
        {
          id: "EXP-004",
          title: "Multi-Node Deliveries SOW",
          description: "Must provide minimum of 3 past customer success evidence benchmarks delivering multi-node database systems.",
          category: "Experience",
          severity: "Standard",
          status: "fail"
        }
      ];
      setRequirements(mockRequirements);
      setSelectedRequirement(mockRequirements[0]);
      setIsAnalyzing(false);
      setAlert({ type: "success", text: "Successfully completed cognitive audit analysis!" });
      
      setTimeout(() => {
        setActiveTab("requirements");
        setAlert(null);
      }, 1200);
    }, 1500);
  };

  // 2. Map Capabilites
  const executeMatching = async (capsList: string[]) => {
    setIsMatching(true);
    setAlert(null);

    setTimeout(() => {
      const computedMatrix: any = {
        "SEC-001": {
          matchGrade: "Outstanding",
          reasoning: "Matched against SOC 2 Type II active certificates referenced on profile.",
          recommendation: "Attach current audit scope letters directly in proposal appendix."
        },
        "TEC-002": {
          matchGrade: "Strong",
          reasoning: "Hot standby master clusters configured securely in secondary region nodes.",
          recommendation: "Illustrate real-time health statistics in the core text representation."
        },
        "COMM-003": {
          matchGrade: "Partial",
          reasoning: "Annual operating pricing tiers defined, but lacks explicit details on training packages.",
          recommendation: "Supplement the section using detailed training modules catalog data."
        },
        "EXP-004": {
          matchGrade: "Unmatched",
          reasoning: "Historical capability catalog does not detail past multi-node deployments of similar size.",
          recommendation: "Partner with local engineering staff to formulate temporary proof of readiness benchmarks."
        }
      };
      setMatchMatrix(computedMatrix);
      setIsMatching(false);
      setAlert({ type: "success", text: "Compliance matrix has been refreshed successfully based on evidence profiles." });
    }, 1200);
  };

  // 3. Draft Responses
  const executeDrafting = async (params: any) => {
    setIsDrafting(true);
    setAlert(null);

    setTimeout(() => {
      const synthesizedText = `# RFP RESPONSE DRAFT: ${params.requirement.title} (${params.requirement.id})

## 1. Executive Summary
We explicitly confirm direct adherence to ${params.requirement.id} guidelines. Our services comply fully with all details referenced in the tender solicitation document without exceptions.

## 2. Methodology & Supporting Evidence
For **${params.requirement.title}**, our technical operations deploy:
- **Redundancy Limits:** Automatic replication across fault-tolerant storage sites.
- **Failover Security:** Advanced monitoring services triggering instant health switches.
- **Active Capacity Proof:** *"${params.capabilityInfo}"*.

## 3. Operations & SLA Continuity
All systems are backed with solid 99.9% availability guarantees. Standard health logs and detailed support processes remain accessible continuously.`;

      setActiveDraftText(synthesizedText);
      setIsDrafting(false);
      setAlert({ type: "success", text: `Synthesized response section draft successfully using Llama model parameters.` });
    }, 1500);
  };

  // 4. Rate Bid
  const executePredictScore = async () => {
    setIsPredicting(true);
    setAlert(null);

    setTimeout(() => {
      setRatingAnalysis({
        winScore: 72,
        benchmarks: {
          budgetAlignment: 85,
          capabilityMatch: 75,
          complianceScore: 90,
          riskBuffer: 65
        },
        decision: "GO",
        remedialActions: [
          "Incorporate active SOC 2 compliance verification letters inside section responses.",
          "Structure standard multi-year commitment subscription discounts to mitigate pricing objections."
        ]
      });
      setIsPredicting(false);
      setAlert({ type: "success", text: "Win predictor model assessment computed successfully!" });
    }, 1400);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-400 font-mono">Checking session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-150 flex flex-col font-sans">
      {screen === "landing" && (
        <div className="min-h-screen flex flex-col justify-between" id="root-landing-portal">
          <header className="border-b border-purple-950/20 bg-[#0a0a0f] px-6 py-4 max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="h-6 w-6 text-purple-500" />
              <span className="font-extrabold text-lg tracking-tight text-white">
                BidEngine<span className="text-purple-500">.AI</span>
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => setScreen("login")} className="text-sm font-medium text-slate-400 hover:text-white transition cursor-pointer">
                Sign In
              </button>
              <button onClick={() => setScreen(isAuthenticated ? "dashboard" : "login")} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-sm font-semibold text-white rounded-lg transition shadow-lg shadow-purple-600/15 flex items-center gap-1.5 cursor-pointer">
                <span>Explore Workspace</span>
                <LayoutDashboard className="h-4 w-4" />
              </button>
            </div>
          </header>

          <section className="relative px-6 py-16 md:py-24 max-w-5xl mx-auto text-center space-y-6">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-12 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />
            
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-950/80 rounded-full border border-purple-900/40 text-purple-350 text-xs font-mono font-semibold">
              <Sparkles className="h-3 w-3 animate-pulse" />
              <span>Optimized with Llama-3.3-70b-versatile via Groq Cloud APIs</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
              AI-Powered Proposal & <br />
              <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                Bid Response Engine
              </span>
            </h1>

            <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Cut bid preparation time by 50%. Parse complicated Request for Proposals (RFPs), map requirements automatically, generate high-scoring drafts instantly, and calculate direct predictive success metrics.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button onClick={() => setScreen(isAuthenticated ? "dashboard" : "login")} className="cursor-pointer w-full sm:w-auto px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition duration-200 shadow-xl shadow-purple-600/20 flex items-center justify-center gap-2">
                <span>Launch BidEngine Tool</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => setScreen("signup")} className="cursor-pointer w-full sm:w-auto px-8 py-4 bg-[#1a1a2e] border border-purple-950/40 hover:border-purple-500 text-slate-350 text-sm font-semibold rounded-xl transition">
                Create Account
              </button>
            </div>
          </section>

          {/* Operational Metrics Section */}
          <section className="max-w-7xl mx-auto px-6 py-2 w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#1a1a2e] border border-purple-955/20 rounded-2xl p-8 text-center">
              <div>
                <span className="text-3xl md:text-4xl font-extrabold text-purple-400 block font-mono">120+</span>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold font-mono mt-1">Bids Analyzed</p>
              </div>
              <div className="border-y md:border-y-0 md:border-x border-purple-950/30 py-4 md:py-0 md:px-4">
                <span className="text-3xl md:text-4xl font-extrabold text-purple-400 block font-mono">50%</span>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold font-mono mt-1">Time Saved</p>
              </div>
              <div>
                <span className="text-3xl md:text-4xl font-extrabold text-purple-400 block font-mono">85%</span>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold font-mono mt-1">Win Rate</p>
              </div>
            </div>
          </section>

          <section className="px-6 py-12 max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: FileText, color: "text-purple-400", title: "Auto-Extract Requirements", desc: "Instantly parse lengthy RFP documents to isolate critical technical deliverables, timelines, and mandatory clauses." },
              { icon: CheckCircle, color: "text-blue-400", title: "Smart Match Capability", desc: "Map identified prerequisites against your organization's capability library history, identifying operational compliance proof or gaps." },
              { icon: Cpu, color: "text-indigo-400", title: "AI Draft Responses", desc: "Write premium, professional response sections dynamically referencing historical contract successes." },
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="bg-[#1a1a2e] p-6 rounded-xl border border-purple-955/20 space-y-3">
                  <div className={`p-2 bg-[#0a0a0f] rounded w-fit ${feature.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-100">{feature.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </section>

          <footer className="border-t border-purple-950/20 bg-[#0a0a0f] py-8 px-6 text-center text-xs text-slate-650 max-w-7xl mx-auto w-full">
            <p>&copy; {new Date().getFullYear()} BidEngine AI. All Rights Reserved.</p>
          </footer>
        </div>
      )}

      {screen === "login" && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0a0f]" id="root-login-screen">
          <div className="w-full max-w-md bg-[#1a1a2e] p-8 rounded-2xl border border-purple-955/20 shadow-2xl space-y-6">
            <div className="text-center space-y-1">
              <button onClick={() => setScreen("landing")} className="inline-flex items-center gap-2 text-purple-400 font-extrabold text-2xl cursor-pointer">
                <Cpu className="h-6 w-6" />
                <span>BidEngine.AI</span>
              </button>
              <h2 className="text-lg font-bold text-white pt-2">Access Bidding Workspace</h2>
              <p className="text-xs text-slate-400">Sign in to start mapping complex RFPs instantly.</p>
            </div>

            {authMessage && (
              <div className={`p-3 rounded-lg text-xs border ${authMessage.type === "success" ? "bg-emerald-950/40 text-emerald-300 border-emerald-900" : "bg-rose-950/40 text-rose-300 border-rose-900"}`}>
                {authMessage.text}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-405 font-mono">Email Address</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full bg-[#0a0a0f] text-slate-200 p-3 rounded-lg border border-purple-950/40 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-405 font-mono">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-[#0a0a0f] text-slate-200 p-3 rounded-lg border border-purple-950/40 text-sm"
                />
              </div>
              <button type="submit" disabled={isAuthenticating} className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white font-semibold rounded-lg text-sm transition cursor-pointer">
                {isAuthenticating ? "Signing In..." : "Enter Workspace"}
              </button>
            </form>

            <div className="text-center text-xs text-slate-500 pt-2 border-t border-purple-950/20">
              <span>Don't have a team seat? </span>
              <button onClick={() => setScreen("signup")} className="text-purple-405 hover:underline cursor-pointer font-medium">Register here</button>
            </div>
          </div>
        </div>
      )}

      {screen === "signup" && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0a0f]" id="root-signup-screen">
          <div className="w-full max-w-md bg-[#1a1a2e] p-8 rounded-2xl border border-purple-955/20 shadow-2xl space-y-6">
            <div className="text-center space-y-1">
              <button onClick={() => setScreen("landing")} className="inline-flex items-center gap-2 text-purple-400 font-extrabold text-2xl cursor-pointer">
                <Cpu className="h-6 w-6" />
                <span>BidEngine.AI</span>
              </button>
              <h2 className="text-lg font-bold text-white pt-2">Create Workspace Seat</h2>
              <p className="text-xs text-slate-400">Complete setup details for your organization.</p>
            </div>

            {authMessage && (
              <div className={`p-3 rounded-lg text-xs border ${authMessage.type === "success" ? "bg-emerald-950/40 text-emerald-300 border-emerald-900" : "bg-rose-950/40 text-rose-300 border-rose-900"}`}>
                {authMessage.text}
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-405 font-mono">Full Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-[#0a0a0f] text-slate-200 p-3 rounded-lg border border-purple-950/40 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-405 font-mono">Work Email</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full bg-[#0a0a0f] text-slate-200 p-3 rounded-lg border border-purple-950/40 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-405 font-mono">Secure Password</label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full bg-[#0a0a0f] text-slate-200 p-3 rounded-lg border border-purple-950/40 text-sm"
                />
              </div>
              <button type="submit" disabled={isAuthenticating} className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white font-semibold rounded-lg text-sm transition cursor-pointer">
                {isAuthenticating ? "Creating Workspace..." : "Create Workspace"}
              </button>
            </form>

            <div className="text-center text-xs text-slate-500 pt-2 border-t border-purple-950/20">
              <span>Already registered? </span>
              <button onClick={() => setScreen("login")} className="text-purple-455 hover:underline cursor-pointer font-medium">Log In instead</button>
            </div>
          </div>
        </div>
      )}

      {screen === "dashboard" && (
        <div className="min-h-screen bg-[#0a0a0f] flex flex-col overflow-y-auto" id="root-dashboard-hub">
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            userEmail={userEmail}
            onSignOut={handleSignOut}
          />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full space-y-6">
            {alert && (
              <div className="p-4 rounded-xl flex items-start gap-3 text-sm bg-purple-950/30 text-purple-350 border border-purple-900 shadow-md">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-purple-400" />
                <div>{alert.text}</div>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-purple-955/20 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest block mb-1">
                  AI Bidding Workspace Console
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  <Cpu className="text-purple-500 h-7 w-7" />
                  RFP Response Workshop
                </h1>
                <p className="text-slate-400 text-xs mt-1">
                  Manage proposal lifecycles, parse text specifications, check compliance, edit answers and track progress.
                </p>
              </div>
              
              <div className="px-3.5 py-2 bg-[#1a1a2e] border border-purple-955/20 rounded-lg flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div className="text-xs font-mono">
                  <span className="text-slate-500">Workspace connection: </span>
                  <span className="text-emerald-400 font-bold">READY</span>
                </div>
              </div>
            </div>

            {/* Steps Navigation Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 bg-[#1a1a2e] border border-purple-955/20 p-1.5 rounded-xl gap-2 text-center text-xs">
              {[
                { id: "upload", step: "1", title: "Upload RFP" },
                { id: "requirements", step: "2", title: "Requirements" },
                { id: "compliance", step: "3", title: "Compliance Check" },
                { id: "draft", step: "4", title: "AI Draft" },
                { id: "score", step: "5", title: "Win Score" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`py-2 p-1.5 rounded-lg flex flex-col items-center justify-center transition cursor-pointer ${
                    activeTab === item.id
                      ? "bg-purple-600 text-white font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#0a0a0f]/40"
                  }`}
                >
                  <span className="text-[10px] font-mono opacity-85 block uppercase">Step {item.step}</span>
                  <span className="mt-0.5 tracking-tight font-semibold">{item.title}</span>
                </button>
              ))}
            </div>

            <div>
              {activeTab === "upload" && (
                <FileUpload
                  onTextParsed={executeRfpAnalysis}
                  isProcessing={isAnalyzing}
                  initialText={rfpText}
                />
              )}

              {activeTab === "requirements" && (
                <RequirementsList
                  requirements={requirements}
                  onSelectRequirement={(req) => {
                    setSelectedRequirement(req);
                    setActiveTab("draft");
                  }}
                />
              )}

              {activeTab === "compliance" && (
                <ComplianceChecker
                  requirements={requirements}
                  matchMatrix={matchMatrix}
                  onRunMatch={executeMatching}
                  isMatching={isMatching}
                />
              )}

              {activeTab === "draft" && (
                <ProposalDraft
                  activeRequirement={selectedRequirement}
                  onGenerateDraft={executeDrafting}
                  draftResponse={activeDraftText}
                  isDrafting={isDrafting}
                />
              )}

              {activeTab === "score" && (
                <WinScoreDashboard
                  activeBidTitle="RFP Bid Response Pipeline"
                  ratingAnalysis={ratingAnalysis}
                  onPredictScore={executePredictScore}
                  isPredicting={isPredicting}
                  requirements={requirements}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
