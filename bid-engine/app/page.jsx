import React from "react";
import Link from "next/link";
import { Cpu, FileText, CheckCircle, ShieldAlert, Award, ArrowRight, Zap, Play, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex flex-col justify-between" id="landing-page">
      {/* Landing Header */}
      <header className="border-b border-purple-950/20 bg-[#0a0a0f]/80 backdrop-blur sticky top-0 z-50 px-6 py-4 max-w-7xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Cpu className="h-6 w-6 text-purple-500" />
          <span className="font-extrabold text-lg tracking-tight">
            BidEngine<span className="text-purple-500">.AI</span>
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/login" className="text-sm font-medium text-slate-400 hover:text-white transition">
            Sign In
          </Link>
          <Link href="/signup" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-sm font-semibold text-white rounded-lg transition shadow-lg shadow-purple-600/10 flex items-center gap-1.5 cursor-pointer">
            <span>Start Free Trial</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero Visual Section */}
      <section className="relative px-6 py-16 md:py-24 max-w-5xl mx-auto text-center space-y-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-12 w-96 h-96 bg-purple-550/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-950/80 rounded-full border border-purple-900/40 text-purple-350 text-xs font-mono font-semibold">
          <Sparkles className="h-3 w-3 animate-pulse" />
          <span>Cut Your Bid Preparation Time by 50%</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          AI-Powered <br />
          <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Bid Response Engine
          </span>
        </h1>

        <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Parse complex procurement requests, match internal capabilities instantly, draft response documents, and predict winning probability metrics in a unified bidding workstation.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link href="/dashboard" className="w-full sm:w-auto px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition duration-200 shadow-xl shadow-purple-600/20 flex items-center justify-center gap-2">
            <span>Explore Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/signup" className="w-full sm:w-auto px-8 py-4 bg-[#1a1a2e] border border-purple-950/40 hover:border-purple-500 text-slate-300 text-sm font-semibold rounded-xl transition">
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* Live Operational Stats Counter row */}
      <section className="max-w-7xl mx-auto px-6 py-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#1a1a2e] border border-purple-950/20 rounded-2xl p-8 text-center">
          <div className="space-y-1 border-b md:border-b-0 md:border-r border-purple-950/30 pb-4 md:pb-0 md:pr-4">
            <span className="text-3xl md:text-4xl font-extrabold text-purple-400 block font-mono">120+</span>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold font-mono">Bids Analyzed</p>
          </div>
          <div className="space-y-1 border-b md:border-b-0 md:border-r border-purple-950/30 py-4 md:py-0 md:px-4">
            <span className="text-3xl md:text-4xl font-extrabold text-purple-400 block font-mono">50%</span>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold font-mono">Time Saved</p>
          </div>
          <div className="space-y-1 pt-4 md:pt-0 md:pl-4">
            <span className="text-3xl md:text-4xl font-extrabold text-purple-400 block font-mono">85%</span>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold font-mono">Win Rate</p>
          </div>
        </div>
      </section>

      {/* Feature Bento Grid: Auto-Extract, Smart Match, AI Draft */}
      <section className="px-6 py-12 max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: FileText,
            color: "text-purple-400",
            title: "Auto-Extract Requirements",
            desc: "Instantly parse lengthy RFP documents to isolate critical technical deliverables, timelines, and mandatory clauses using Llama LLMs.",
          },
          {
            icon: CheckCircle,
            color: "text-blue-400",
            title: "Smart Match Capability",
            desc: "Map identified prerequisites against your organization's capability library history, identifying operational compliance proof or gaps.",
          },
          {
            icon: Cpu,
            color: "text-indigo-400",
            title: "AI Draft Responses",
            desc: "Write premium, professional response sections dynamically referencing historical contract successes aligned to specific bid criteria.",
          },
        ].map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <div key={idx} className="bg-[#1a1a2e] p-6 rounded-xl border border-purple-950/25 space-y-3 shadow-lg hover:border-purple-500/30 transition duration-300">
              <div className="p-2.5 bg-[#0a0a0f] rounded-lg border border-purple-950/20 w-fit">
                <Icon className={`h-5 w-5 ${feature.color}`} />
              </div>
              <h3 className="text-base font-bold text-white">{feature.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{feature.desc}</p>
            </div>
          );
        })}
      </section>

      {/* Footer */}
      <footer className="border-t border-purple-950/20 bg-[#0a0a0f]/80 py-8 px-6 text-center text-xs text-slate-500 max-w-7xl mx-auto w-full">
        <p>&copy; {new Date().getFullYear()} BidEngine AI. All Rights Reserved.</p>
        <p className="mt-1 text-slate-600 font-mono">Secured and Powered by Llama-3.3-70b-versatile via Groq Cloud Infrastructure.</p>
      </footer>
    </div>
  );
}
