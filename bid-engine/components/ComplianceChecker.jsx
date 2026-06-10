"use client";

import React, { useState } from "react";
import { CheckCircle2, ShieldAlert, AlertTriangle, Play, HelpCircle, Lightbulb } from "lucide-react";

export default function ComplianceChecker({ requirements = [], matchMatrix = {}, onRunMatch, isMatching }) {
  const [capabilitiesInput, setCapabilitiesInput] = useState(
    "1. Holds verified AICPA SOC 2 Type II assurance certificate.\n2. Implements military-grade TLS 1.3 protocol encryption for all in-transit structures.\n3. Uptime operational SLA guarantee specified at 99.9% uptime limits.\n4. Scalable distributed servers capable of handling extensive API data loads."
  );

  const getGradeStyle = (grade) => {
    switch (grade?.toLowerCase()) {
      case "outstanding":
        return {
          bg: "bg-emerald-950/40 border-emerald-900 text-emerald-300",
          dots: "bg-emerald-400",
          icon: CheckCircle2,
        };
      case "strong":
        return {
          bg: "bg-purple-950/45 border-purple-900 text-purple-300",
          dots: "bg-purple-400",
          icon: CheckCircle2,
        };
      case "partial":
        return {
          bg: "bg-amber-950/45 border-amber-900 text-amber-300",
          dots: "bg-amber-400",
          icon: AlertTriangle,
        };
      case "poor":
        return {
          bg: "bg-rose-950/40 border-rose-900 text-rose-300",
          dots: "bg-rose-400",
          icon: ShieldAlert,
        };
      default:
        return {
          bg: "bg-slate-800/60 border-slate-700 text-slate-300",
          dots: "bg-slate-400",
          icon: HelpCircle,
        };
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="compliance-checklist-container">
      {/* Capability Profile Setup */}
      <div className="lg:col-span-1 bg-[#1a1a2e] p-6 rounded-xl border border-purple-950/40 shadow-xl space-y-4 h-fit">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Lightbulb className="text-purple-400 h-5 w-5" />
            Evidence & Capability
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Configure past experience details and capability certifications to run AI-powered evidence checking.
          </p>
        </div>

        <div className="space-y-1">
          <textarea
            value={capabilitiesInput}
            onChange={(e) => setCapabilitiesInput(e.target.value)}
            className="w-full h-80 bg-[#0a0a0f] text-slate-300 p-3 rounded-lg border border-purple-950/40 focus:outline-none focus:border-purple-500 font-sans text-xs leading-relaxed"
          />
        </div>

        <button
          onClick={() => onRunMatch && onRunMatch(capabilitiesInput.split("\n").filter(Boolean))}
          disabled={isMatching || requirements.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white rounded-lg font-medium text-sm transition cursor-pointer"
        >
          {isMatching ? (
            <span className="flex items-center gap-1">
              <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
              Checking compliance...
            </span>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>Evaluate Match Grades</span>
            </>
          )}
        </button>
      </div>

      {/* Compliance / Gap Matrix Display */}
      <div className="lg:col-span-2 bg-[#1a1a2e] p-6 rounded-xl border border-purple-950/40 shadow-xl space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">Compliance & Gap Matrix Results</h3>
          <p className="text-xs text-slate-400 mt-1">
            Visualizes compliance levels based on evidence matches. Identify gaps that could impact success score.
          </p>
        </div>

        {requirements.length === 0 ? (
          <div className="text-center py-24 bg-[#0a0a0f] rounded-xl border border-purple-950/20">
            <ShieldAlert className="h-10 w-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-xs text-center">Analyze an RFP document to establish requirements catalog first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requirements.map((req) => {
              const matrixItem = matchMatrix[req.id] || {
                matchGrade: "Pending",
                reasoning: "Awaiting capability evaluation.",
                recommendation: "Run capability matching to view strategic advisory comments.",
              };
              const style = getGradeStyle(matrixItem.matchGrade);
              const GradeIcon = style.icon;

              return (
                <div key={req.id} className="p-4 bg-[#0a0a0f]/80 rounded-xl border border-purple-950/15 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-955/20 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold bg-purple-950 px-1.5 py-0.5 rounded text-purple-450 border border-purple-900/40 animate-pulse">
                        {req.id}
                      </span>
                      <h4 className="text-sm font-bold text-slate-200">{req.title}</h4>
                    </div>

                    {/* Match Badge */}
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-mono font-semibold ${style.bg}`}>
                      <GradeIcon className="h-4 w-4 shrink-0 text-current" />
                      <span>{matrixItem.matchGrade}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block font-mono">
                        Requirement Target:
                      </span>
                      <p className="text-slate-300 mt-1 leading-relaxed">{req.description}</p>
                    </div>

                    <div className="bg-[#1a1a2e]/40 p-3 rounded-lg border border-purple-950/10">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block font-mono">
                        Winning advisory:
                      </span>
                      <p className="text-amber-200/90 mt-1 leading-relaxed">
                        {matrixItem.recommendation || "Maintain close technical coordination around compliance schedules."}
                      </p>
                    </div>
                  </div>

                  {matrixItem.reasoning && matrixItem.matchGrade !== "Pending" && (
                    <div className="text-xs bg-purple-950/15 p-2 rounded-lg border border-purple-900/20 text-slate-400">
                      <span className="font-semibold text-slate-350 font-mono">Fit Reasoning:</span> {matrixItem.reasoning}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
