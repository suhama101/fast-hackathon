"use client";

import React, { useState } from "react";
import { Home, History, LogOut, Menu, Settings, Sparkles, X } from "lucide-react";

export default function Navbar({
  activeTab,
  setActiveTab,
  userEmail,
  onSignOut,
  currentWorkspace,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "history", label: "History", icon: History },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const openView = (id) => {
    setActiveTab?.(id);
    setMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl shadow-sm" id="bid-engine-nav">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => openView("home")}
          className="group flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-slate-100"
          aria-label="Go to BidEngine home"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition group-hover:scale-105">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-left">
            <div className="text-lg font-black tracking-tight text-slate-950">
              BidEngine<span className="text-blue-600">.AI</span>
            </div>
            <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:block">
              Procurement Copilot
            </div>
          </div>
        </button>

        <div className="hidden min-w-0 flex-1 justify-center px-8 lg:flex">
          <div className="flex max-w-xl items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
            <span className="truncate">
              {currentWorkspace?.title || "No active workspace"}
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-blue-600 ring-1 ring-slate-200">
              {currentWorkspace?.status || "ready"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 md:block">
            {userEmail || "Authenticated user"}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-600 hover:shadow-md"
              aria-label="Open navigation menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-3 w-64 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10 animate-[fadeIn_160ms_ease-out]">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openView(item.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-50 hover:text-blue-700"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                <div className="my-2 h-px bg-slate-100" />
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
