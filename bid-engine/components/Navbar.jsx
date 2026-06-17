"use client";

import React, { useState } from "react";
import { LogOut, Menu, X, Cpu, Home, Settings } from "lucide-react";

export default function Navbar({ activeTab, setActiveTab, userEmail, onSignOut }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: "upload", label: "Home", icon: Home },
    { id: "requirements", label: "Current RFP", icon: Cpu },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="w-full bg-[#0d0d16] border-b border-slate-800/80 sticky top-0 z-50 shadow-lg" id="bid-engine-nav">
      <div className="px-6 lg:px-8 h-16 flex items-center justify-between max-w-7xl mx-auto w-full">
        <button
          onClick={() => setActiveTab && setActiveTab("upload")}
          className="flex-shrink-0 flex items-center space-x-2 text-indigo-400 hover:text-indigo-300 transition"
        >
            <Cpu className="h-8 w-8 animate-pulse text-indigo-500" />
            <span className="font-sans font-extrabold text-xl tracking-tight text-white">
              BidEngine<span className="text-indigo-500">.AI</span>
            </span>
        </button>

        <div className="hidden lg:flex items-center space-x-4">
          {userEmail && (
            <div className="text-slate-400 text-xs font-mono">
              Active Bidding: <span className="text-indigo-400">{userEmail}</span>
            </div>
          )}
          <div className="relative">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              Menu
            </button>
            {mobileMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-800 bg-slate-950 p-2 shadow-2xl">
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
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition ${
                        isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="mt-1 flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-950/30"
                  >
                    <LogOut className="h-4 w-4" />
                    Exit Workspace
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

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
                <span>{item.label}</span>
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
