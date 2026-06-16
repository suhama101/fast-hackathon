"use client";

import React, { useState } from "react";
import { ClipboardCheck, FileWarning, WandSparkles, Copy, RefreshCw, ShieldAlert } from "lucide-react";

const renderItems = (items = [], emptyText = "No issues detected.") => {
  if (!items || items.length === 0) {
    return <p className="text-xs text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-purple-950/20 bg-[#0a0a0f]/70 p-3 text-xs text-slate-300">
          {typeof item === "string" ? (
            <p>{item}</p>
          ) : (
            <>
              <p className="font-semibold text-white">{item.section_title || item.requirement_id || item.issue || `Issue ${index + 1}`}</p>
              {item.issue && <p className="mt-1 text-slate-400">{item.issue}</p>}
              {item.severity && <p className="mt-1 text-[10px] uppercase tracking-wider text-purple-300 font-mono">Severity: {item.severity}</p>}
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default function ReviewerPanel({
  onRunReview,
  isReviewing,
  reviewResult = null,
}) {
  const [copied, setCopied] = useState(false);
  const finalProposal = reviewResult?.final_proposal || "";

  const handleCopy = async () => {
    if (!finalProposal || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(finalProposal);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="reviewer-panel">
      <div className="lg:col-span-1 bg-[#1a1a2e] p-6 rounded-xl border border-purple-950/40 shadow-xl space-y-4 h-fit">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="text-purple-400 h-5 w-5" />
            Reviewer Agent
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Inspect the draft for weak claims, compliance gaps, and formatting risks before final submission.
          </p>
        </div>

        <button
          onClick={onRunReview}
          disabled={isReviewing}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white rounded-lg font-semibold text-sm transition cursor-pointer"
        >
          {isReviewing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Reviewing Draft...</span>
            </>
          ) : (
            <>
              <WandSparkles className="h-4 w-4" />
              <span>Run Reviewer Agent</span>
            </>
          )}
        </button>

        <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f]/80 p-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-purple-300 block">Final Recommendation</span>
          <div className={`mt-2 inline-flex px-3 py-1 rounded-full text-xs font-bold border ${
            reviewResult?.final_recommendation === "GO"
              ? "bg-emerald-950/40 text-emerald-300 border-emerald-900"
              : "bg-rose-950/40 text-rose-300 border-rose-900"
          }`}>
            {reviewResult?.final_recommendation || "Pending"}
          </div>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            {reviewResult?.rationale || "Run the reviewer to get a final quality pass and remediation summary."}
          </p>
        </div>
      </div>

      <div className="lg:col-span-2 bg-[#1a1a2e] p-6 rounded-xl border border-purple-950/40 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-purple-950/20">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileWarning className="text-purple-400 h-5 w-5" />
              Reviewer Feedback and Final Proposal
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Shows weak sections, unsupported claims, and a cleaned-up proposal draft.
            </p>
          </div>

          {finalProposal && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0a0f] hover:bg-purple-950/20 rounded border border-purple-950/20 text-purple-300 text-xs font-semibold transition cursor-pointer"
            >
              <Copy className="h-4 w-4" />
              <span>{copied ? "Copied" : "Copy Final"}</span>
            </button>
          )}
        </div>

        {!reviewResult ? (
          <div className="rounded-xl border border-dashed border-purple-950/30 bg-[#0a0a0f]/60 p-10 text-center">
            <ShieldAlert className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No reviewer output yet.</p>
            <p className="text-slate-500 text-xs mt-1">Generate the proposal draft first, then run the reviewer agent.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f]/70 p-4">
                <h4 className="text-sm font-bold text-white mb-2">Weak Sections</h4>
                {renderItems(reviewResult.weak_sections, "No weak sections detected.")}
              </div>
              <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f]/70 p-4">
                <h4 className="text-sm font-bold text-white mb-2">Unsupported Claims</h4>
                {renderItems(reviewResult.unsupported_claims, "No unsupported claims detected.")}
              </div>
              <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f]/70 p-4">
                <h4 className="text-sm font-bold text-white mb-2">Missing Compliance</h4>
                {renderItems(reviewResult.missing_compliance_points, "No missing compliance gaps detected.")}
              </div>
              <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f]/70 p-4">
                <h4 className="text-sm font-bold text-white mb-2">Vague Language</h4>
                {renderItems(reviewResult.vague_language, "No vague language detected.")}
              </div>
            </div>

            <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f]/70 p-4">
              <h4 className="text-sm font-bold text-white mb-2">Formatting Issues</h4>
              {renderItems(reviewResult.formatting_issues, "No formatting issues detected.")}
            </div>

            <div className="rounded-xl border border-purple-950/20 bg-[#0a0a0f]/70 p-4">
              <h4 className="text-sm font-bold text-white mb-2">Reviewer Suggestions</h4>
              {renderItems(reviewResult.suggestions, "No suggestions available.")}
            </div>

            <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-4">
              <h4 className="text-sm font-bold text-emerald-300 mb-2">Final Improved Proposal</h4>
              <textarea
                readOnly
                value={finalProposal}
                className="w-full h-[320px] bg-[#0a0a0f] text-slate-200 p-4 rounded-xl border border-emerald-900/30 focus:outline-none font-mono text-xs leading-relaxed"
                placeholder="The reviewer will produce a final improved proposal version here."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
