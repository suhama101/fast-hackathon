"use client";

import React, { useState } from "react";
import { ListFilter, ShieldAlert, Award, FileSpreadsheet, Eye, ChevronRight } from "lucide-react";

export default function RequirementsList({ requirements = [], onSelectRequirement }) {
  const [filterCategory, setFilterCategory] = useState("All");

  const categories = ["All", ...new Set(requirements.map((req) => req.category))];

  const filteredRequirements = filterCategory === "All"
    ? requirements
    : requirements.filter((req) => req.category === filterCategory);

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "bg-rose-950/50 text-rose-300 border-rose-900";
      case "important":
        return "bg-amber-950/50 text-amber-300 border-amber-900";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const getCategoryBadge = (category) => {
    switch (category?.toLowerCase()) {
      case "security":
        return "bg-purple-950/40 text-purple-300 border-purple-900";
      case "technical":
        return "bg-sky-950/40 text-sky-300 border-sky-900";
      case "commercial":
        return "bg-emerald-950/40 text-emerald-300 border-emerald-900";
      default:
        return "bg-blue-950/40 text-blue-300 border-blue-900";
    }
  };

  return (
    <div className="bg-slate-850 p-6 rounded-xl border border-slate-800 shadow-xl space-y-6" id="bid-requirements-list">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="text-indigo-400 h-5 w-5" />
            Extracted RFP Requirements List
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Browse strict compliance clauses formulated by Groq AI LLM. Click one to generate standard proposal drafts.
          </p>
        </div>

        {/* Categories Tab Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <ListFilter className="text-slate-500 h-4 w-4 shrink-0" />
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 shrink-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  filterCategory === cat
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredRequirements.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/40 rounded-xl border border-slate-800/80">
          <ShieldAlert className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No extracted requirements match this criteria yet.</p>
          <p className="text-slate-600 text-xs mt-1">Analyze a text document first to populate requirements catalog.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredRequirements.map((req, index) => (
            <div
              key={req.id || index}
              onClick={() => onSelectRequirement && onSelectRequirement(req)}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 hover:bg-slate-800/30 transition-all duration-300 cursor-pointer group"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xs font-mono font-bold text-indigo-400 px-2 py-0.5 bg-indigo-950/50 rounded border border-indigo-900">
                      {req.id || `REQ-${index + 1}`}
                    </span>
                    <span className={`text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded border ${getSeverityBadge(req.severity)}`}>
                      {req.severity || "Standard"}
                    </span>
                    <span className={`text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded border ${getCategoryBadge(req.category)}`}>
                      {req.category || "General"}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-white pt-1">
                    {req.title}
                  </h3>
                </div>
                
                <button className="hidden sm:inline-flex items-center text-xs text-indigo-400 group-hover:text-indigo-300 font-medium shrink-0">
                  <span>Draft Answer</span>
                  <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <p className="text-slate-300 text-sm mt-3 leading-relaxed border-t border-slate-850 pt-2.5">
                {req.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
