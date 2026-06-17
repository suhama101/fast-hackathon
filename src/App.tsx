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

const compactText = (value: any, max = 90) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
};

const normalizeRequirement = (row: any, index = 0) => {
  const requirementType = row.requirement_type || row.type || "mandatory";
  const requirementText = row.requirement_text || row.description || row.title || "";
  const extractedValue = row.extracted_value || "";
  const category =
    row.category ||
    (requirementType === "deadline"
      ? "Deadline"
      : requirementType === "evaluation"
        ? "Evaluation"
        : String(extractedValue).includes("Question")
          ? "Question"
          : "Mandatory");
  const prefix = category.slice(0, 3).toUpperCase() || "REQ";
  const status = row.compliance_status || row.status || "partial";

  return {
    ...row,
    id: row.id || row.requirement_id || `REQ-${index + 1}`,
    displayId: row.displayId || row.display_id || `${prefix}-${String(index + 1).padStart(3, "0")}`,
    title: row.title || compactText(requirementText, 72) || `Requirement ${index + 1}`,
    description: requirementText || row.content || "No requirement text was returned.",
    category,
    severity:
      row.severity ||
      (requirementType === "mandatory"
        ? "Critical"
        : requirementType === "deadline"
          ? "Important"
          : "Standard"),
    status,
    compliance_status: status,
    requirement_type: requirementType,
    extracted_value: extractedValue,
  };
};

const normalizeRequirements = (rows: any[] = []) => rows.map((row, index) => normalizeRequirement(row, index));

const gradeFromMatch = (status: string, confidence?: number | null) => {
  if (!status) return "Pending";
  if (status === "pass") return Number(confidence || 0) >= 75 ? "Outstanding" : "Strong";
  if (status === "partial") return "Partial";
  if (status === "fail") return "Poor";
  return "Pending";
};

const buildMatchMatrix = (rows: any[] = []) =>
  rows.reduce((matrix: any, row: any) => {
    const hasMatchEvidence = row.matched_evidence || row.match_reasoning || row.match_confidence !== undefined;
    if (!hasMatchEvidence) return matrix;

    const status = row.compliance_status || row.status || "partial";
    matrix[row.id] = {
      matchGrade: gradeFromMatch(status, row.match_confidence),
      reasoning: row.match_reasoning || "Compliance match was saved for this requirement.",
      recommendation:
        status === "pass"
          ? "Use the matched evidence directly in the proposal response."
          : status === "fail"
            ? "Resolve this gap before final submission or mark it as a delivery risk."
            : "Add stronger supporting proof before approving this response.",
      evidence: row.matched_evidence || row.extracted_value || "No saved evidence text was returned.",
      status,
    };
    return matrix;
  }, {});

const normalizeScore = (payload: any) => {
  const score = payload?.scores || payload?.record || payload?.score || payload;
  if (
    !score ||
    (
      score.total_score === undefined &&
      score.winScore === undefined &&
      score.overall_probability === undefined &&
      score.overallProbability === undefined &&
      score.win_probability === undefined
    )
  ) return null;

  const overallProbability = Number(
    score.total_score ??
    score.winScore ??
    score.overall_probability ??
    score.overallProbability ??
    score.win_probability ??
    0
  );
  const riskPenalty = Number(score.risk_penalty_score ?? score.riskPenalty ?? 0);
  const riskScore = Number(score.risk_score ?? score.riskScore ?? (riskPenalty ? Math.max(0, 100 - riskPenalty) : 0));
  const decision = score.decision || score.go_no_go || score.goNoGo || (overallProbability >= 70 ? "GO" : "NO-GO");
  const scoreComponents = score.score_components || score.components || {};
  const blockers = [
    ...(Array.isArray(score.compliance_blockers) ? score.compliance_blockers : []),
    ...(Array.isArray(score.blockers) ? score.blockers : []),
  ];
  const missingEvidence = [
    ...(Array.isArray(score.missing_evidence) ? score.missing_evidence : []),
    ...(Array.isArray(score.missingEvidence) ? score.missingEvidence : []),
  ];
  const recommendedActions = Array.isArray(score.recommendations)
    ? score.recommendations
    : Array.isArray(score.recommended_actions)
      ? score.recommended_actions
      : [
          decision === "GO"
            ? "Proceed with proposal drafting while keeping final compliance proof attached."
            : "Close failed mandatory gaps before submitting this opportunity.",
          "Review budget alignment, matched evidence, and risk score before final approval.",
        ];

  return {
    winScore: overallProbability,
    benchmarks: {
      budgetAlignment: Number(score.budget_alignment ?? score.budgetAlignment ?? score.budget_sync ?? 0),
      capabilityMatch: Number(score.capability_match ?? score.capabilityMatch ?? score.capability_alignment ?? 0),
      complianceScore: Number(score.compliance_score ?? score.complianceScore ?? score.compliance_density ?? 0),
      evidenceCoverage: Number(score.evidence_coverage ?? score.evidenceCoverage ?? scoreComponents.evidence_coverage ?? score.capability_match ?? 0),
      riskBuffer: riskScore,
    },
    decision,
    mandatoryTotal: Number(score.mandatory_total ?? 0),
    mandatoryPassed: Number(score.mandatory_passed ?? 0),
    mandatoryPartial: Number(score.mandatory_partial ?? 0),
    mandatoryFailed: Number(score.mandatory_failed ?? 0),
    remedialActions: recommendedActions,
    complianceBlockers: blockers,
    missingEvidence,
    raw: score,
  };
};

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
  const [currentWorkspace, setCurrentWorkspace] = useState<any>(null);
  const [rfpText, setRfpText] = useState("");
  const [requirements, setRequirements] = useState<any[]>([]);
  const [selectedRequirement, setSelectedRequirement] = useState<any>(null);
  const [matchMatrix, setMatchMatrix] = useState<any>({});
  const [savedDrafts, setSavedDrafts] = useState<any[]>([]);
  const [activeDraft, setActiveDraft] = useState<any>(null);
  const [activeDraftText, setActiveDraftText] = useState("");
  const [ratingAnalysis, setRatingAnalysis] = useState<any>(null);

  // loading states
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isLoadingScore, setIsLoadingScore] = useState(false);
  const [scoreWorkspaceId, setScoreWorkspaceId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const workflowSteps = [
    { id: "upload", label: "Upload RFP", complete: requirements.length > 0 },
    { id: "requirements", label: "Requirements", complete: requirements.length > 0 },
    { id: "compliance", label: "Compliance Check", complete: Object.keys(matchMatrix).length > 0 },
    { id: "draft", label: "AI Draft", complete: savedDrafts.length > 0 || Boolean(activeDraftText) },
    { id: "score", label: "Win Score", complete: Boolean(ratingAnalysis) },
  ];

  const canAccessStep = (index: number) => {
    const step = workflowSteps[index];
    if (!step) return false;
    if (index === 0 || step.complete) return true;
    if (step.id === "score") {
      return requirements.length > 0 || savedDrafts.length > 0 || Boolean(activeDraftText) || Boolean(ratingAnalysis);
    }
    return workflowSteps[index - 1]?.complete || false;
  };

  const getAuthHeaders = (headers: Record<string, string> = {}) => {
    const token = localStorage.getItem("bid_engine_token");
    return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
  };

  useEffect(() => {
    if (requirements.length === 0) {
      setSelectedRequirement(null);
      return;
    }

    if (!selectedRequirement || !requirements.some((req) => req.id === selectedRequirement.id)) {
      setSelectedRequirement(requirements[0]);
    }
  }, [requirements, selectedRequirement]);

  useEffect(() => {
    if (!selectedRequirement || savedDrafts.length === 0) {
      setActiveDraft(null);
      setActiveDraftText("");
      return;
    }
    const cleanText = (selectedRequirement.description || selectedRequirement.requirement_text || "").slice(0, 30).toLowerCase();
    const matched = savedDrafts.find((d: any) =>
      String(d.section_title || "").toLowerCase().includes(cleanText)
    );
    if (matched) {
      setActiveDraft(matched);
      setActiveDraftText(matched.content || "");
    } else {
      setActiveDraft(null);
      setActiveDraftText("");
    }
  }, [selectedRequirement, savedDrafts]);

  useEffect(() => {
    let cancelled = false;

    const syncSession = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          headers: getAuthHeaders(),
        });
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

  const loadSavedWinScore = async (workspaceId: string) => {
    if (!workspaceId) return;
    setIsLoadingScore(true);
    try {
      const response = await fetch(`/api/rfp/score?workspaceId=${encodeURIComponent(workspaceId)}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data: any = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || `Saved win score load failed (${response.status}).`);
      }
      setRatingAnalysis(normalizeScore(data.record));
      setScoreWorkspaceId(workspaceId);
    } catch (error) {
      setScoreWorkspaceId(workspaceId);
    } finally {
      setIsLoadingScore(false);
    }
  };

  const loadWorkspaceDetails = async (workspaceId: string) => {
    if (!workspaceId) return;

    const response = await fetch(`/api/workspaces?workspaceId=${encodeURIComponent(workspaceId)}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    });
    const data: any = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(data.error || `Failed to load workspace (${response.status}).`);
    }

    const normalizedRequirements = normalizeRequirements(data.requirements || []);
    const drafts = data.drafts || [];
    const firstDraft = drafts[0] || null;

    setCurrentWorkspace(data.workspace || null);
    setRfpText(data.workspace?.raw_text || "");
    setRequirements(normalizedRequirements);
    setMatchMatrix(buildMatchMatrix(normalizedRequirements));
    setSavedDrafts(drafts);
    setActiveDraft(firstDraft);
    setActiveDraftText(firstDraft?.content || "");
    setRatingAnalysis(normalizeScore(data.score));
    setScoreWorkspaceId(data.score ? workspaceId : null);
  };

  useEffect(() => {
    if (activeTab === "score" && currentWorkspace?.id && scoreWorkspaceId !== currentWorkspace.id) {
      void loadSavedWinScore(currentWorkspace.id);
    }
  }, [activeTab, currentWorkspace?.id, scoreWorkspaceId]);

  const loadLatestWorkspace = async () => {
    if (!isAuthenticated) return;

    setIsLoadingWorkspace(true);
    try {
      const response = await fetch("/api/workspaces", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data: any = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || `Failed to load workspaces (${response.status}).`);
      }

      const latest = data.workspaces?.[0];
      if (latest?.id) {
        await loadWorkspaceDetails(latest.id);
      } else {
        setCurrentWorkspace(null);
        setRfpText("");
        setRequirements([]);
        setMatchMatrix({});
        setSavedDrafts([]);
        setActiveDraft(null);
        setActiveDraftText("");
        setRatingAnalysis(null);
      }
    } catch (error: any) {
      setAlert({ type: "error", text: error.message || "Could not load saved workspace data." });
    } finally {
      setIsLoadingWorkspace(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadLatestWorkspace();
    }
  }, [isAuthenticated]);

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
      setCurrentWorkspace(null);
      setRfpText("");
      setRequirements([]);
      setMatchMatrix({});
      setSavedDrafts([]);
      setActiveDraft(null);
      setActiveDraftText("");
      setRatingAnalysis(null);
      setScoreWorkspaceId(null);
      setScreen("landing");
    }
  };

  // 1. Text Parsing & RFP Extraction
  const executeRfpAnalysis = async (text: string, meta: any = {}) => {
    setIsAnalyzing(true);
    setRfpText(text);
    setAlert(null);

    try {
      const response = await fetch("/api/rfp/analyze", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          rawText: text,
          workspaceId: meta.workspaceId || meta.workspace?.id || null,
          bidTitle: meta.fileName || currentWorkspace?.title || `RFP Workspace - ${new Date().toLocaleDateString()}`,
        }),
      });
      const data: any = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || `RFP analysis failed (${response.status}).`);
      }

      await loadWorkspaceDetails(data.workspaceId);
      setAlert({
        type: "success",
        text: `Saved workspace and ${data.requirements?.length || 0} extracted requirements to Supabase.`,
      });
      setActiveTab("requirements");
    } catch (error: any) {
      setAlert({ type: "error", text: error.message || "RFP analysis failed." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 2. Map Capabilites
  const executeMatching = async (capsList: string[]) => {
    if (!currentWorkspace?.id) {
      setAlert({ type: "error", text: "Analyze an RFP first so the workspace exists in Supabase." });
      return;
    }

    setIsMatching(true);
    setAlert(null);

    try {
      const response = await fetch("/api/rfp/match", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          capabilityNotes: capsList.join("\n"),
        }),
      });
      const data: any = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || `Compliance matching failed (${response.status}).`);
      }

      const normalizedRequirements = normalizeRequirements(data.requirements || []);
      setRequirements(normalizedRequirements);
      setMatchMatrix(buildMatchMatrix(normalizedRequirements));
      setAlert({
        type: "success",
        text: `Saved compliance matches for ${data.matches?.length || normalizedRequirements.length} requirements.`,
      });
      setActiveTab("compliance");
    } catch (error: any) {
      setAlert({ type: "error", text: error.message || "Compliance matching failed." });
    } finally {
      setIsMatching(false);
    }
  };

  // 3. Draft Responses
  const executeDrafting = async (params: any) => {
    if (!currentWorkspace?.id) {
      setAlert({ type: "error", text: "Analyze an RFP first so a draft can be saved to Supabase." });
      return;
    }

    setIsDrafting(true);
    setAlert(null);

    try {
      const response = await fetch("/api/rfp/draft", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          requirementId: params.requirement?.id,
          tone: params.tone,
          capabilityInfo: params.capabilityInfo,
        }),
      });
      const data: any = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || `Proposal drafting failed (${response.status}).`);
      }

      const drafts = data.drafts || [];
      const draft =
        drafts.find((item: any) =>
          params.requirement?.description &&
          String(item.section_title || "").includes(compactText(params.requirement.description, 30))
        ) || drafts[0] || null;

      setSavedDrafts(drafts);
      setActiveDraft(draft);
      setActiveDraftText(draft?.content || "");
      setAlert({ type: "success", text: `Generated and saved ${drafts.length || 0} proposal draft sections.` });
      setActiveTab("draft");
    } catch (error: any) {
      setAlert({ type: "error", text: error.message || "Proposal drafting failed." });
    } finally {
      setIsDrafting(false);
    }
  };

  // 4. Rate Bid
  const executePredictScore = async () => {
    if (!currentWorkspace?.id) {
      setAlert({ type: "error", text: "Analyze an RFP first so the win score can be saved to Supabase." });
      return;
    }

    setIsPredicting(true);
    setAlert(null);

    try {
      const response = await fetch("/api/rfp/score", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          rawText: rfpText,
        }),
      });
      const data: any = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || `Win score failed (${response.status}).`);
      }

      setRatingAnalysis(normalizeScore(data.scores || data.record));
      setScoreWorkspaceId(currentWorkspace.id);
      setAlert({ type: "success", text: "Calculated and saved win probability plus GO/NO-GO decision." });
      setActiveTab("score");
    } catch (error: any) {
      setAlert({ type: "error", text: error.message || "Win probability scoring failed." });
    } finally {
      setIsPredicting(false);
    }
  };

  const handleSaveDraft = async (content: string) => {
    if (!activeDraft?.id) {
      setAlert({ type: "error", text: "Generate a draft first before saving edits." });
      return;
    }

    setIsSavingDraft(true);
    setAlert(null);

    try {
      const response = await fetch("/api/rfp/draft", {
        method: "PATCH",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          draftId: activeDraft.id,
          content,
          status: "edited",
        }),
      });
      const data: any = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || `Saving draft failed (${response.status}).`);
      }

      setActiveDraft(data.draft);
      setActiveDraftText(data.draft?.content || content);
      setSavedDrafts((drafts) => drafts.map((draft) => (draft.id === data.draft?.id ? data.draft : draft)));
      setAlert({ type: "success", text: "Draft edits saved to Supabase." });
    } catch (error: any) {
      setAlert({ type: "error", text: error.message || "Saving draft failed." });
    } finally {
      setIsSavingDraft(false);
    }
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
            workflowSteps={workflowSteps}
            canAccessStep={canAccessStep}
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
              
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="px-3.5 py-2 bg-[#1a1a2e] border border-purple-955/20 rounded-lg flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${currentWorkspace?.id ? "bg-emerald-500" : "bg-amber-400"} animate-pulse shrink-0`} />
                  <div className="text-xs font-mono">
                    <span className="text-slate-500">Supabase workspace: </span>
                    <span className={currentWorkspace?.id ? "text-emerald-400 font-bold" : "text-amber-300 font-bold"}>
                      {isLoadingWorkspace
                        ? "LOADING"
                        : currentWorkspace?.title
                          ? compactText(currentWorkspace.title, 34)
                          : "NEW RFP"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab("score")}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold border border-purple-500 shadow-lg shadow-purple-950/30 transition"
                >
                  <Award className="h-4 w-4" />
                  Win Score / GO-NO-GO
                </button>
              </div>
            </div>

            <div className="bg-[#1a1a2e] border border-purple-950/40 rounded-xl p-4 shadow-xl">
              <div className="flex flex-wrap gap-2">
                {workflowSteps.map((step, index) => {
                  const isActive = activeTab === step.id;
                  const isLocked = !canAccessStep(index);
                  return (
                    <button
                      key={step.id}
                      onClick={() => !isLocked && setActiveTab(step.id)}
                      disabled={isLocked}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                        isActive
                          ? "bg-purple-600 text-white border-purple-500"
                          : step.complete
                            ? "bg-emerald-950/30 text-emerald-300 border-emerald-900/50 hover:border-emerald-600"
                            : isLocked
                              ? "bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed"
                              : "bg-[#0a0a0f]/60 text-slate-300 border-slate-800 hover:border-purple-700"
                      }`}
                    >
                      {step.complete ? "Done " : isLocked ? "Locked " : `${index + 1}. `}
                      {step.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab !== "score" && (
              <div className="bg-purple-950/25 border border-purple-800/50 rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-xl">
                <div>
                  <h3 className="text-sm font-bold text-white">Win Score Calculator</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Open the GO / NO-GO calculator to calculate or view the saved win probability.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("score")}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition"
                >
                  <Award className="h-4 w-4" />
                  Open Win Score Calculator
                </button>
              </div>
            )}

            {/* Tab content */}
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
                  activeDraft={activeDraft}
                  onGenerateDraft={executeDrafting}
                  onSaveDraft={handleSaveDraft}
                  draftResponse={activeDraftText}
                  isDrafting={isDrafting}
                  isSavingDraft={isSavingDraft}
                />
              )}

              {activeTab === "score" && (
                <WinScoreDashboard
                  activeBidTitle={currentWorkspace?.title || "RFP Bid Response Pipeline"}
                  ratingAnalysis={ratingAnalysis}
                  onPredictScore={executePredictScore}
                  isPredicting={isPredicting}
                  isLoadingScore={isLoadingScore}
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
