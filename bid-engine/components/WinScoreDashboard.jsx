"use client";

import React from "react";
import { Award, BarChart3, RefreshCw, ShieldAlert, Target, TrendingUp } from "lucide-react";

const numberValue = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : fallback;
};

const listFrom = (...values) =>
  values.flatMap((value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return [];
  });

const itemText = (item) => {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return String(item || "");
  return item.title || item.issue || item.requirement || item.description || item.action || JSON.stringify(item);
};

export default function WinScoreDashboard({
  activeBidTitle,
  ratingAnalysis = null,
  onPredictScore,
  isPredicting,
  isLoadingScore = false,
  requirements = [],
}) {
  const analysis = ratingAnalysis;
  const winScore = numberValue(
    analysis?.winScore ??
      analysis?.overall_probability ??
      analysis?.overallProbability ??
      analysis?.total_score
  );
  const decision = analysis?.decision || analysis?.go_no_go || (winScore >= 70 ? "GO" : "NO-GO");
  const benchmarks = analysis?.benchmarks || {};
  const complianceScore = numberValue(benchmarks.complianceScore ?? analysis?.compliance_score);
  const capabilityScore = numberValue(benchmarks.capabilityMatch ?? analysis?.capability_match);
  const evidenceCoverage = numberValue(benchmarks.evidenceCoverage ?? analysis?.evidence_coverage ?? capabilityScore);
  const budgetAlignment = numberValue(benchmarks.budgetAlignment ?? analysis?.budget_alignment);
  const riskScore = numberValue(benchmarks.riskBuffer ?? analysis?.risk_score ?? analysis?.risk_mitigation);
  const hasScore = Boolean(analysis);
  const failedRequirements = requirements.filter((requirement) =>
    ["fail", "no match", "non-compliant"].includes(
      String(requirement.status || requirement.compliance_status || "").toLowerCase()
    )
  );
  const blockers = listFrom(
    analysis?.complianceBlockers,
    analysis?.compliance_blockers,
    failedRequirements.map((requirement) => requirement.title || requirement.description)
  );
  const missingEvidence = listFrom(analysis?.missingEvidence, analysis?.missing_evidence);
  const recommendedActions = listFrom(
    analysis?.remedialActions,
    analysis?.recommendations,
    analysis?.recommended_actions
  );
  const defaultActions = [
    decision === "GO"
      ? "Proceed with final bid review and keep supporting evidence attached."
      : "Close failed mandatory gaps before submitting this opportunity.",
    "Review budget alignment, matched evidence, and risk score before final approval.",
  ];
  const scoreButtonLabel = hasScore ? "Recalculate Win Score" : "Calculate Win Score";

  return (
    <section className="bg-[#1a1a2e] border border-purple-950/40 rounded-xl shadow-xl p-6 space-y-6" id="win-score-calculator">
      <div className="flex flex-col gap-4 border-b border-purple-950/30 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-purple-300 font-bold">Win Score</p>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Award className="h-6 w-6 text-purple-400" />
            Win Score / GO-NO-GO Calculator
          </h2>
          <p className="text-sm text-slate-400 mt-1">{activeBidTitle || "RFP Bid Response Pipeline"}</p>
        </div>

        <button
          onClick={onPredictScore}
          disabled={isPredicting || isLoadingScore}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-sm transition"
        >
          <RefreshCw className={`h-4 w-4 ${isPredicting || isLoadingScore ? "animate-spin" : ""}`} />
          <span>{isPredicting ? "Calculating..." : scoreButtonLabel}</span>
        </button>
      </div>

      {isLoadingScore ? (
        <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f] p-12 text-center">
          <RefreshCw className="h-10 w-10 text-purple-400 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-slate-400">Loading saved Win Score...</p>
        </div>
      ) : !hasScore ? (
        <div className="rounded-xl border border-dashed border-purple-900/40 bg-[#0a0a0f] p-12 text-center">
          <ShieldAlert className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-300">Win Score has not been calculated yet</p>
          <p className="text-xs text-slate-500 mt-1">Run the calculator to save and display the GO / NO-GO result.</p>
          <button
            onClick={onPredictScore}
            disabled={isPredicting}
            className="mt-5 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-sm transition"
          >
            <RefreshCw className={`h-4 w-4 ${isPredicting ? "animate-spin" : ""}`} />
            <span>Calculate Win Score</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 rounded-xl border border-purple-900/30 bg-[#0a0a0f] p-6 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-mono">Overall Win Probability</p>
              <div className="mt-4 text-6xl font-extrabold text-white">{winScore}%</div>
              <div className={`mt-4 inline-flex px-4 py-1.5 rounded-full text-sm font-extrabold border ${
                decision === "GO"
                  ? "bg-emerald-950/50 text-emerald-300 border-emerald-800"
                  : "bg-rose-950/50 text-rose-300 border-rose-800"
              }`}>
                {decision}
              </div>
              <p className="mt-3 text-xs text-slate-500">GO / NO-GO decision</p>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Compliance Density / Compliance Score", value: complianceScore, icon: Target },
                { label: "Capability Alignment / Evidence Coverage", value: Math.max(capabilityScore, evidenceCoverage), icon: TrendingUp },
                { label: "Budget Alignment", value: budgetAlignment, icon: BarChart3 },
                { label: "Risk Mitigation / Risk Score", value: riskScore, icon: ShieldAlert },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border border-purple-950/20 bg-[#0a0a0f] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Icon className="h-5 w-5 text-purple-400" />
                      <span className="text-xl font-extrabold text-white">{item.value}%</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-300">{item.label}</p>
                    <div className="mt-3 h-2 rounded-full bg-[#1a1a2e] overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500" style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f] p-5">
            <h3 className="text-sm font-bold text-white">Strategic Remediation Matrix</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 text-sm">
              <div>
                <p className="font-semibold text-purple-300 mb-2">Compliance blockers</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  {(blockers.length ? blockers : ["No compliance blockers are currently flagged."]).slice(0, 5).map((item, index) => (
                    <li key={`${itemText(item)}-${index}`}>{itemText(item)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-purple-300 mb-2">Missing evidence</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  {(missingEvidence.length ? missingEvidence : ["No missing evidence warnings are currently flagged."]).slice(0, 5).map((item, index) => (
                    <li key={`${itemText(item)}-${index}`}>{itemText(item)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-purple-300 mb-2">Required bidding actions</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  {(recommendedActions.length ? recommendedActions : defaultActions).slice(0, 5).map((item, index) => (
                    <li key={`${itemText(item)}-${index}`}>{itemText(item)}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
