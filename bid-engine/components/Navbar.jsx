"use client";

import React, { useState } from "react";
import { FileText, Award, ShieldAlert, LogOut, CheckCircle, Menu, X, Cpu } from "lucide-react";

export default function Navbar({ activeTab, setActiveTab, userEmail, onSignOut }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: "upload",       step: "1", label: "Upload RFP",        icon: FileText  },
    { id: "requirements", step: "2", label: "Requirements",      icon: CheckCircle },
    { id: "compliance",   step: "3", label: "Compliance Check",  icon: ShieldAlert },
    { id: "draft",        step: "4", label: "AI Draft",          icon: Cpu       },
    { id: "score",        step: "5", label: "Win Score",         icon: Award     },
  ];

  return (
    <nav className="w-full bg-[#0d0d16] border-b border-slate-800/80 sticky top-0 z-50 shadow-lg" id="bid-engine-nav">
      {/* Main nav bar row */}
      <div className="px-6 lg:px-8 h-16 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center space-x-8">
          <div className="flex-shrink-0 flex items-center space-x-2 text-indigo-400">
            <Cpu className="h-8 w-8 animate-pulse text-indigo-500" />
            <span className="font-sans font-extrabold text-xl tracking-tight text-white">
              BidEngine<span className="text-indigo-500">.AI</span>
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center space-x-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab && setActiveTab(item.id)}
                  className={`flex flex-col items-center px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 outline-none cursor-pointer min-w-[90px] ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="font-bold">{item.label}</span>
                  </div>
                  <span className={`text-[9px] font-mono mt-0.5 ${isActive ? "text-indigo-200" : "text-slate-600"}`}>
                    STEP {item.step}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User Section / Access controls */}
        <div className="hidden lg:flex items-center space-x-4">
          {userEmail && (
            <div className="text-slate-400 text-xs font-mono">
              Active Bidding: <span className="text-indigo-400">{userEmail}</span>
            </div>
          )}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-850 hover:bg-red-955 hover:text-red-300 rounded text-xs text-slate-400 border border-slate-855 transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Exit Workspace</span>
            </button>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="lg:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab && setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center space-x-3 w-full px-3 py-3 rounded-md text-base font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>Step {item.step}: {item.label}</span>
              </button>
            );
          })}

          {userEmail && (
            <div className="px-3 py-2 text-slate-500 font-mono text-xs border-t border-slate-800">
              User: <span className="text-indigo-400">{userEmail}</span>
            </div>
          )}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="flex items-center space-x-2 w-full px-3 py-3 text-red-400 hover:bg-slate-800 rounded-md text-base"
            >
              <LogOut className="h-5 w-5" />
              <span>Exit Workspace</span>
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
