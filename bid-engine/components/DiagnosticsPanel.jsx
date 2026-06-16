"use client";

import React from "react";
import { BarChart3, ShieldCheck, ShieldAlert, AlertTriangle, Target } from "lucide-react";

const bucketStatus = (match = {}) => {
  const status = String(match.matchStatus || match.match_status || "").toLowerCase();
  if (status.includes("strong")) return "strong";
  if (status.includes("partial")) return "partial";
  if (status.includes("no")) return "none";
  if (String(match.compliance_status || "").toLowerCase() === "pass") return "strong";
  if (String(match.compliance_status || "").toLowerCase() === "partial") return "partial";
  return "none";
};

export default function DiagnosticsPanel({ requirements = [], matchMatrix = {} }) {
  const stats = requirements.reduce(
    (accumulator, requirement) => {
      const match = matchMatrix[requirement.id] || {};
      const status = bucketStatus(match);
      const score = Number(match.confidenceScore ?? match.confidence_score ?? match.match_score ?? 0);

      accumulator.total += 1;
      accumulator.byCategory[requirement.category || "Unknown"] =
        (accumulator.byCategory[requirement.category || "Unknown"] || 0) + 1;
      accumulator.averageScore += score;

      if (status === "strong") accumulator.strong += 1;
      else if (status === "partial") accumulator.partial += 1;
      else accumulator.none += 1;

      if (score > 0 && score < 60) {
        accumulator.lowConfidence.push({
          id: requirement.id,
          text: requirement.description || requirement.requirement_text || requirement.title || "",
          score,
        });
      }

      if (status === "none") {
        accumulator.noEvidence.push({
          id: requirement.id,
          text: requirement.description || requirement.requirement_text || requirement.title || "",
        });
      }

      return accumulator;
    },
    {
      total: 0,
      strong: 0,
      partial: 0,
      none: 0,
      averageScore: 0,
      byCategory: {},
      lowConfidence: [],
      noEvidence: [],
    }
  );

  const averageMatchScore = stats.total ? Math.round(stats.averageScore / stats.total) : 0;

  return (
    <div className="bg-[#1a1a2e] p-6 rounded-xl border border-purple-950/40 shadow-xl space-y-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-purple-400" />
        <div>
          <h3 className="text-lg font-bold text-white">Accuracy Diagnostics</h3>
          <p className="text-xs text-slate-400 mt-1">Quick view of extraction coverage and retrieval quality.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Requirements", value: stats.total, icon: Target },
          { label: "Strong Evidence", value: stats.strong, icon: ShieldCheck },
          { label: "Partial Evidence", value: stats.partial, icon: AlertTriangle },
          { label: "No Evidence", value: stats.none, icon: ShieldAlert },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-purple-950/20 bg-[#0a0a0f]/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">{item.label}</span>
                <Icon className="h-4 w-4 text-purple-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-white">{item.value}</div>
            </div>
          );
        })}
        <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f]/70 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Avg Match Score</span>
            <BarChart3 className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">{averageMatchScore}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f]/70 p-4">
          <h4 className="text-sm font-bold text-white mb-3">Requirements by Category</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byCategory).map(([category, count]) => (
              <span key={category} className="px-3 py-1 rounded-full border border-purple-900/30 bg-purple-950/25 text-xs text-purple-200">
                {category}: {count}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f]/70 p-4">
          <h4 className="text-sm font-bold text-white mb-3">Low-Confidence Matches</h4>
          <div className="space-y-2 max-h-48 overflow-auto pr-1">
            {stats.lowConfidence.length === 0 ? (
              <p className="text-xs text-slate-500">No low-confidence matches detected.</p>
            ) : (
              stats.lowConfidence.map((item) => (
                <div key={item.id} className="rounded-lg border border-amber-900/30 bg-amber-950/10 p-3 text-xs text-slate-300">
                  <div className="font-semibold text-white">{item.id}</div>
                  <div className="mt-1">{item.text}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-amber-300 font-mono">{item.score}%</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f]/70 p-4">
        <h4 className="text-sm font-bold text-white mb-3">Requirements With No Evidence</h4>
        <div className="space-y-2 max-h-56 overflow-auto pr-1">
          {stats.noEvidence.length === 0 ? (
            <p className="text-xs text-slate-500">Every requirement has at least partial evidence.</p>
          ) : (
            stats.noEvidence.map((item) => (
              <div key={item.id} className="rounded-lg border border-rose-900/30 bg-rose-950/10 p-3 text-xs text-slate-300">
                <div className="font-semibold text-white">{item.id}</div>
                <div className="mt-1">{item.text}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
