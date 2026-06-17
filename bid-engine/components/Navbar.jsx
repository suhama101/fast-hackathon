"use client";

import React, { useState } from "react";
import { LogOut, Menu, X, Cpu, Check, Lock } from "lucide-react";

/**
 * Navbar with embedded workflow progress tracker.
 *
 * Props:
 *  activeTab        – current active tab id
 *  setActiveTab     – setter to change the active tab
 *  workflowSteps    – array of { id, label, complete } from parent
 *  canAccessStep    – fn(index) => boolean from parent
 *  userEmail        – authenticated user email
 *  onSignOut        – sign-out handler
 */
export default function Navbar({
  activeTab,
  setActiveTab,
  workflowSteps = [],
  canAccessStep,
  userEmail,
  onSignOut,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleStepClick = (step, index) => {
    if (!canAccessStep || canAccessStep(index)) {
      setActiveTab && setActiveTab(step.id);
    }
  };

  return (
    <nav
      className="w-full bg-[#0d0d16] border-b border-slate-800/80 sticky top-0 z-50 shadow-lg"
      id="bid-engine-nav"
    >
      {/* ── Top bar ── */}
      <div className="px-4 lg:px-8 h-14 flex items-center justify-between max-w-7xl mx-auto w-full gap-4">
        {/* Logo */}
        <button
          onClick={() => setActiveTab && setActiveTab("upload")}
          className="flex-shrink-0 flex items-center gap-2 hover:opacity-80 transition"
        >
          <Cpu className="h-6 w-6 text-indigo-500 animate-pulse" />
          <span className="font-extrabold text-lg tracking-tight text-white hidden sm:inline">
            BidEngine<span className="text-indigo-500">.AI</span>
          </span>
        </button>

        {/* ── Workflow step tracker (desktop) ── */}
        {workflowSteps.length > 0 && (
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {workflowSteps.map((step, index) => {
              const isActive = activeTab === step.id;
              const isComplete = step.complete;
              const isLocked = canAccessStep ? !canAccessStep(index) : false;

              return (
                <React.Fragment key={step.id}>
                  {/* Connector line */}
                  {index > 0 && (
                    <div
                      className={`h-px w-5 lg:w-8 flex-shrink-0 ${
                        workflowSteps[index - 1]?.complete
                          ? "bg-emerald-700"
                          : "bg-slate-700"
                      }`}
                    />
                  )}

                  {/* Step pill */}
                  <button
                    onClick={() => handleStepClick(step, index)}
                    disabled={isLocked}
                    title={isLocked ? `Complete previous steps to unlock ${step.label}` : step.label}
                    className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all select-none ${
                      isActive
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-900/40"
                        : isComplete
                        ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:border-emerald-500 cursor-pointer"
                        : isLocked
                        ? "bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed"
                        : "bg-slate-900/60 border-slate-700 text-slate-400 hover:border-indigo-600 hover:text-slate-200 cursor-pointer"
                    }`}
                  >
                    <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0 ${
                      isActive
                        ? "bg-white/20"
                        : isComplete
                        ? "bg-emerald-700/40"
                        : isLocked
                        ? "bg-slate-800"
                        : "bg-slate-800"
                    }`}>
                      {isComplete ? (
                        <Check className="h-2.5 w-2.5" />
                      ) : isLocked ? (
                        <Lock className="h-2.5 w-2.5" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="hidden lg:inline whitespace-nowrap">{step.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* ── Right side: user + menu ── */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {userEmail && (
            <span className="hidden lg:block text-[11px] font-mono text-slate-500 max-w-[160px] truncate">
              {userEmail}
            </span>
          )}

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition"
              aria-label="Open menu"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-800 bg-[#0d0d16] shadow-2xl p-2 z-50">
                {userEmail && (
                  <div className="px-3 py-2 text-[11px] font-mono text-slate-500 border-b border-slate-800 mb-1 truncate">
                    {userEmail}
                  </div>
                )}
                {onSignOut && (
                  <button
                    onClick={() => { setMenuOpen(false); onSignOut(); }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-950/30 transition"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile workflow steps (below top bar) ── */}
      {workflowSteps.length > 0 && (
        <div className="md:hidden border-t border-slate-800/60 px-4 py-2 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {workflowSteps.map((step, index) => {
              const isActive = activeTab === step.id;
              const isComplete = step.complete;
              const isLocked = canAccessStep ? !canAccessStep(index) : false;

              return (
                <React.Fragment key={step.id}>
                  {index > 0 && (
                    <div className={`h-px w-4 flex-shrink-0 ${
                      workflowSteps[index - 1]?.complete ? "bg-emerald-700" : "bg-slate-700"
                    }`} />
                  )}
                  <button
                    onClick={() => handleStepClick(step, index)}
                    disabled={isLocked}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border whitespace-nowrap transition ${
                      isActive
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : isComplete
                        ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                        : isLocked
                        ? "bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed"
                        : "bg-slate-900/60 border-slate-700 text-slate-400"
                    }`}
                  >
                    {isComplete ? (
                      <Check className="h-2.5 w-2.5 flex-shrink-0" />
                    ) : isLocked ? (
                      <Lock className="h-2.5 w-2.5 flex-shrink-0" />
                    ) : (
                      <span className="text-[10px] font-mono">{index + 1}</span>
                    )}
                    {step.label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
