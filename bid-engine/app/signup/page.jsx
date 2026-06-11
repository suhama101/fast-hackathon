"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Cpu, Mail, Lock, User, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleSignup = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMsg(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to configure account.");
      }

      if (data.token) {
        localStorage.setItem("bid_engine_token", data.token);
      }

      setMsg({ type: "success", text: "Successfully registered! Redirecting to setup..." });
      setTimeout(() => {
        window.location.href = data.token ? "/dashboard" : "/login";
      }, 1500);
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Registration failed." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6" id="signup-panel">
      <div className="absolute top-1/4 left-1/2 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl -z-10" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-850 p-8 rounded-2xl shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 text-indigo-400 font-extrabold text-2xl">
            <Cpu className="h-6 w-6" />
            <span>BidEngine.AI</span>
          </Link>
          <h2 className="text-lg font-bold text-white tracking-tight">Register Team seat</h2>
          <p className="text-xs text-slate-400">
            Sign up to build, analyze, and draft automated RFP responses with team seats.
          </p>
        </div>

        {msg && (
          <div className={`p-4 rounded-lg flex items-start gap-3 text-xs ${
            msg.type === "success" 
              ? "bg-emerald-950/40 text-emerald-300 border border-emerald-900" 
              : "bg-rose-950/40 text-rose-300 border border-rose-900"
          }`}>
            {msg.type === "success" ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-400" /> : <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-450" />}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g., John Doe"
                required
                className="w-full bg-slate-950 text-slate-200 pl-11 pr-4 py-3 rounded-lg border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm font-sans"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950 text-slate-200 pl-11 pr-4 py-3 rounded-lg border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm font-sans"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Secure Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950 text-slate-200 pl-11 pr-4 py-3 rounded-lg border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm font-sans"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2"
          >
            <span>{isSubmitting ? "Generating team seat..." : "Create Team Seat"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-850">
          <span>Already hold a team workspace? </span>
          <Link href="/login" className="text-indigo-400 hover:underline">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}
