"use client";

import React, { useState } from "react";
import { Copy, Sparkles, Check, CheckSquare, Edit3, Save, RefreshCw } from "lucide-react";

export default function ProposalDraft({ activeRequirement, onGenerateDraft, draftResponse, isDrafting }) {
  const [tone, setTone] = useState("Deeply Technical and Compliant");
  const [content, setContent] = useState("");
  const [capInfo, setCapInfo] = useState("");
  const [copied, setCopied] = useState(false);

  // Sync loaded draft Response from parent
  React.useEffect(() => {
    if (draftResponse) {
      setContent(draftResponse);
    }
  }, [draftResponse]);

  // Handle local state when activeRequirement shifts
  React.useEffect(() => {
    if (activeRequirement) {
      setCapInfo(`Holds ${activeRequirement.title} capacity, leveraging secure server nodes and standardized operating guarantees.`);
    }
  }, [activeRequirement]);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLocalGenerate = () => {
    if (!activeRequirement) return;
    onGenerateDraft({
      requirement: activeRequirement,
      capabilityInfo: capInfo,
      tone: tone,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="proposal-draft-workspace">
      {/* Parameters & Configuration Column */}
      <div className="lg:col-span-1 bg-[#1a1a2e] p-6 rounded-xl border border-purple-950/40 shadow-xl space-y-5 h-fit">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="text-purple-400 h-5 w-5" />
            Answer Synthesis Parameters
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Configure settings to customize how BidEngine drafts answers to requirements.
          </p>
        </div>

        {activeRequirement ? (
          <div className="p-3 bg-[#0a0a0f] rounded-xl border border-purple-950/25 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase text-purple-450 block">
              Active Focus Target:
            </span>
            <h4 className="text-sm font-bold text-slate-200">{activeRequirement.title}</h4>
            <p className="text-xs text-slate-450 mt-1">{activeRequirement.description}</p>
          </div>
        ) : (
          <div className="p-3 bg-[#0a0a0f] border border-purple-950/20 rounded-xl text-center text-xs text-slate-500">
            Please pick or highlight a requirement from the catalog.
          </div>
        )}

        {/* Tone Picker */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono block">
            Answer Tone Delivery
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full bg-[#0a0a0f] text-slate-300 p-2.5 rounded-lg border border-purple-950/40 focus:outline-none focus:border-purple-500 text-sm cursor-pointer"
          >
            <option>Deeply Technical and Compliant</option>
            <option>Persuasive & Executive Overview</option>
            <option>Conservative & Evidence-Based</option>
            <option>Bold, Award-Winning Narrative</option>
          </select>
        </div>

        {/* Custom Core evidence info */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono block">
            Direct Solution Proof
          </label>
          <textarea
            value={capInfo}
            onChange={(e) => setCapInfo(e.target.value)}
            placeholder="Provide specific technical configurations, model versions, certifications, or statistics to utilize..."
            className="w-full h-32 bg-[#0a0a0f] text-slate-350 p-3 rounded-lg border border-purple-950/40 focus:outline-none focus:border-purple-500 text-xs font-sans leading-relaxed"
          />
        </div>

        <button
          onClick={handleLocalGenerate}
          disabled={isDrafting || !activeRequirement}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white rounded-lg font-semibold text-sm transition cursor-pointer"
        >
          {isDrafting ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin text-white" />
              <span>Drafting Answer via Llama...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Synthesize Response Proposal</span>
            </>
          )}
        </button>
      </div>

      {/* Editor & Generated Output Workspace */}
      <div className="lg:col-span-2 bg-[#1a1a2e] p-6 rounded-xl border border-purple-950/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-purple-955/20">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Edit3 className="text-purple-450 h-4 w-4" />
              Workspace draft Editor
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Verify accuracy and enrich your content response inline before final publication.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {content && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0a0f] hover:bg-purple-950/20 active:bg-purple-900/10 rounded border border-purple-955/20 text-purple-300 text-xs font-semibold tracking-tight transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400 font-mono">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-purple-400" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {content ? (
          <div className="space-y-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-[400px] bg-[#0a0a0f] text-slate-200 p-5 rounded-xl border border-purple-950/40 focus:outline-none focus:border-purple-500 font-mono text-xs leading-relaxed"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Word count: {content.split(/\s+/).filter(Boolean).length} words</span>
              <span className="text-purple-400 font-bold uppercase tracking-wide">✓ Checked for compliance</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 bg-[#0a0a0f]/40 rounded-xl border border-purple-950/10 p-8 text-center space-y-4">
            <Sparkles className="h-12 w-12 text-slate-700 animate-pulse" />
            <div className="space-y-1">
              <p className="text-slate-300 text-sm font-semibold">No response drafted yet</p>
              <p className="text-slate-500 text-xs max-w-sm">
                Pick a compliance item, configure direct proof elements, and generate your compliant answer immediately.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
