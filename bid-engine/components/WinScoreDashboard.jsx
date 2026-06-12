"use client";

import React from "react";
import { Award, ShieldAlert, RefreshCw, BarChart3, Info, Check, X } from "lucide-react";

export default function WinScoreDashboard({
  activeBidTitle,
  ratingAnalysis = null,
  onPredictScore,
  isPredicting,
  requirements = []
}) {
  const analysis = ratingAnalysis;
  const winScore = Number(analysis?.winScore || 0);
  const decision = analysis?.decision || (winScore > 70 ? "GO" : "NO-GO");

  return (
    <div className="bg-[#1a1a2e] p-6 rounded-xl border border-purple-950/40 shadow-xl space-y-6" id="win-score-panel">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-purple-950/20 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Award className="text-purple-400 h-5 w-5" />
            Win Score Dashboard
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Predict potential win coefficients, assess risks, and track organizational preparedness.
          </p>
        </div>

        <button
          onClick={onPredictScore}
          disabled={isPredicting || requirements.length === 0}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white font-semibold rounded-lg text-xs transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {isPredicting ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Calculating Model Fit...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3" />
              <span>Recalculate Win Score</span>
            </>
          )}
        </button>
      </div>

      {requirements.length === 0 ? (
        <div className="text-center py-20 bg-[#0a0a0f] rounded-xl border border-purple-950/10">
          <ShieldAlert className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No analysis history found for this workspace.</p>
          <p className="text-slate-500 text-xs mt-1">Please upload & extract requirements in Step 1 to compute win coefficients.</p>
        </div>
      ) : !analysis ? (
        <div className="text-center py-20 bg-[#0a0a0f] rounded-xl border border-purple-950/10">
          <ShieldAlert className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No saved win score for this workspace yet.</p>
          <p className="text-slate-500 text-xs mt-1">
            Click Recalculate Win Score to call the backend scoring API and save the GO/NO-GO result.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Circular Score & GO/NO-GO Display row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Circle Progress */}
            <div className="bg-[#0a0a0f] rounded-xl border border-purple-950/20 p-6 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block mb-4">
                Overall Probability
              </span>

              <div className="relative flex items-center justify-center">
                <svg className="w-40 h-40">
                  <circle
                    className="text-slate-900"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                    r="68"
                    cx="80"
                    cy="80"
                  />
                  <circle
                    className="text-purple-500"
                    strokeWidth="10"
                    strokeDasharray={427}
                    strokeDashoffset={427 - (427 * winScore) / 100}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="68"
                    cx="80"
                    cy="80"
                    transform="rotate(-90 80 80)"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold text-white">{winScore}%</span>
                  <span className="text-[10px] font-mono text-slate-500 mt-1">WIN CHANCE</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-slate-400">Decision Gateway:</span>
                <span className={`px-3 py-1 text-xs font-extrabold rounded-full ${
                  decision === "GO" 
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-rose-950 text-rose-300 border border-rose-800"
                }`}>
                  {decision}
                </span>
              </div>

              {/* Show real compliance counts if available */}
              {analysis.mandatoryTotal > 0 && (
                <div className="mt-3 text-[10px] font-mono text-slate-500 space-y-0.5 border-t border-purple-950/20 pt-3 w-full text-left">
                  <div className="flex justify-between">
                    <span>Mandatory Total:</span>
                    <span className="text-slate-300">{analysis.mandatoryTotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-400">Passed:</span>
                    <span className="text-emerald-300">{analysis.mandatoryPassed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-400">Partial:</span>
                    <span className="text-amber-300">{analysis.mandatoryPartial}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-rose-400">Failed:</span>
                    <span className="text-rose-300">{analysis.mandatoryFailed}</span>
                  </div>
                  <div className="flex justify-between border-t border-purple-950/20 pt-1 mt-1">
                    <span className="text-purple-300">Compliance:</span>
                    <span className="text-purple-200 font-bold">{analysis.benchmarks?.complianceScore}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Metric breakdown bars */}
            <div className="bg-[#0a0a0f] rounded-xl border border-purple-950/20 p-6 col-span-2 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 font-mono flex items-center gap-1.5 border-b border-purple-950/45 pb-2">
                <BarChart3 className="h-4 w-4 text-purple-400" />
                Core Performance Sub-scores
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {[
                  { label: "Budget Alignment Score", val: analysis.benchmarks?.budgetAlignment || 85, color: "bg-purple-500", desc: "SOW pricing threshold fit" },
                  { label: "Capability Match Coverage", val: analysis.benchmarks?.capabilityMatch || 75, color: "bg-blue-500", desc: "Evidence coverage depth" },
                  { label: "Compliance & SLA Support", val: analysis.benchmarks?.complianceScore || 90, color: "bg-emerald-500", desc: "Mandatory clauses satisfied" },
                  { label: "Overall Risk Buffer Score", val: analysis.benchmarks?.riskBuffer || 65, color: "bg-rose-500", desc: "Mitigated delivery risk factor" }
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#1a1a2e]/40 p-3 rounded-lg border border-purple-950/10 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-300">{item.label}</span>
                      <span className="font-mono font-bold text-white">{item.val}%</span>
                    </div>
                    {/* Bar Chart representation */}
                    <div className="w-full bg-[#1a1a2e] h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${item.val}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono block">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* AI Decision Recommendations box */}
          <div className="bg-[#0a0a0f] rounded-xl border border-purple-950/20 p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 font-mono flex items-center gap-1.5 border-b border-purple-950/45 pb-2">
              <Info className="h-4 w-4 text-purple-400" />
              Strategic AI Recommendations & Remediation
            </h3>
            
            <div className="mt-4 space-y-3 font-sans text-xs">
              {decision === "GO" ? (
                <div className="p-3 bg-emerald-950/20 border border-emerald-905/30 rounded-lg text-emerald-300">
                  <div className="font-bold mb-1 flex items-center gap-1">
                    <Check className="h-4 w-4 text-emerald-400" />
                    Winning Position Identified
                  </div>
                  This bid displays strongly. Your organizational capability library provides deep verified project evidence that satisfies over 70% of mandatory constraints with strong SLA parameters. Proceed to final compliance review.
                </div>
              ) : (
                <div className="p-3 bg-rose-950/20 border border-rose-905/30 rounded-lg text-rose-300">
                  <div className="font-bold mb-1 flex items-center gap-1">
                    <X className="h-4 w-4 text-rose-400" />
                    Compliance Barriers Found
                  </div>
                  This bid score falls below the standard GO threshold (70%). Strategic remediation is advised specifically under pricing structures and team profiles to raise likelihoods of compliance acceptance.
                </div>
              )}

              <div className="space-y-2 pt-2">
                <span className="font-bold tracking-tight text-slate-300 block">Required Bidding Actions:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1 leading-relaxed">
                  {analysis.remedialActions?.map((action, key) => (
                    <li key={key}>{action}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
