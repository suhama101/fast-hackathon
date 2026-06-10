import React from "react";
import "../src/index.css"; // Link global CSS styles cleanly

export const metadata = {
  title: "BidEngine AI - AI-Powered Bid & Proposal Response Engine",
  description: "Automate technical RFPs extraction, compliance matrix matching, and proposal scoring using high performance llama models.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark h-full bg-slate-950 text-slate-100">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;550&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased h-full flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
        <main className="flex-grow flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
