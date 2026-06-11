"use client";

import React, { useEffect, useState } from "react";
import { UploadCloud, FileText, CheckCircle, AlertCircle, ArrowRight, Loader } from "lucide-react";

const SAMPLE_RFPS = [
  {
    label: "IT Services",
    fileName: "rfp-it-services.txt",
    path: "/sample-rfps/rfp-it-services.txt",
  },
  {
    label: "Construction",
    fileName: "rfp-construction.txt",
    path: "/sample-rfps/rfp-construction.txt",
  },
  {
    label: "Logistics",
    fileName: "rfp-logistics.txt",
    path: "/sample-rfps/rfp-logistics.txt",
  },
];

const PREVIEW_CHAR_LIMIT = 500;

function getPreviewText(text = "") {
  return text.slice(0, PREVIEW_CHAR_LIMIT);
}

export default function FileUpload({ onTextParsed, isProcessing, initialText = "" }) {
  const [dragActive, setDragActive] = useState(false);
  const [rfpText, setRfpText] = useState(initialText);
  const [previewText, setPreviewText] = useState(getPreviewText(initialText));
  const [alertMsg, setAlertMsg] = useState(null);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [selectedSampleRfp, setSelectedSampleRfp] = useState(SAMPLE_RFPS[0].path);

  useEffect(() => {
    setRfpText(initialText || "");
    setPreviewText(getPreviewText(initialText || ""));
  }, [initialText]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePickedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handlePickedFile(e.target.files[0]);
    }
  };

  const handlePickedFile = async (file) => {
    setFileName("");
    setAlertMsg(null);
    setRfpText("");
    setPreviewText("");
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^.]+$/, ""));

      const response = await fetch("/api/rfp/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      setProgress(70);

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Upload parser unavailable.");

      const extractedText = data.rawText || "";
      if (!extractedText.trim()) throw new Error("No readable text was extracted from this file.");

      setRfpText(extractedText);
      setPreviewText(data.previewText || getPreviewText(extractedText));
      setFileName(data.fileName || file.name);
      setProgress(100);
      setAlertMsg({
        type: "success",
        text: `Parsed "${file.name}" on server (${data.characterCount || 0} characters). Click "Analyze RFP" to extract requirements.`
      });
    } catch (err) {
      console.warn("Server upload parser failed.", err);
      setProgress(0);
      setRfpText("");
      setPreviewText("");
      setAlertMsg({ type: "error", text: err.message || "Failed to parse the provided document." });
    }
  };

  const handlePreviewChange = (e) => {
    setRfpText(e.target.value);
    setPreviewText(e.target.value);
  };

  const handleSubmitText = () => {
    if (!rfpText.trim()) {
      setAlertMsg({ type: "error", text: "Please enter or drop an RFP document to analyze." });
      return;
    }
    onTextParsed(rfpText, { fileName });
  };

  const loadSampleRfp = async () => {
    const sample = SAMPLE_RFPS.find((item) => item.path === selectedSampleRfp) || SAMPLE_RFPS[0];
    setAlertMsg(null);
    setProgress(30);

    try {
      const response = await fetch(sample.path);
      if (!response.ok) throw new Error("Sample RFP file could not be loaded.");
      const text = await response.text();
      setFileName(sample.fileName);
      setRfpText(text);
      setPreviewText(getPreviewText(text));
      setProgress(100);
      setAlertMsg({
        type: "success",
        text: `Loaded "${sample.fileName}". Click "Analyze RFP" to trigger AI evaluation.`
      });
    } catch (err) {
      setProgress(0);
      setAlertMsg({ type: "error", text: err.message || "Failed to load sample RFP." });
    }
  };

  return (
    <div className="bg-[#1a1a2e] p-6 rounded-xl border border-purple-950/40 shadow-xl space-y-6" id="file-upload-section">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-purple-950/20 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <UploadCloud className="text-purple-400 h-5 w-5" />
            Upload RFP Document
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Drag and drop your RFP specifications or paste plain-text content to run AI parsing.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={selectedSampleRfp}
            onChange={(e) => setSelectedSampleRfp(e.target.value)}
            className="px-3 py-1.5 bg-[#0a0a0f] border border-purple-950/50 text-purple-300 text-xs font-mono rounded focus:outline-none focus:border-purple-500"
          >
            {SAMPLE_RFPS.map((sample) => (
              <option key={sample.path} value={sample.path}>
                {sample.label}
              </option>
            ))}
          </select>
          <button
            onClick={loadSampleRfp}
            className="px-3.5 py-1.5 bg-[#0a0a0f] border border-purple-950/50 hover:border-purple-500 text-purple-350 hover:text-purple-300 text-xs font-mono font-medium rounded transition"
          >
            Load Sample RFP
          </button>
        </div>
      </div>

      {alertMsg && (
        <div className={`p-4 rounded-lg flex items-start gap-3 text-sm ${
          alertMsg.type === "success" 
            ? "bg-emerald-950/35 text-emerald-300 border border-emerald-900/50" 
            : "bg-rose-950/35 text-rose-300 border border-rose-900/50"
        }`}>
          {alertMsg.type === "success" ? (
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          )}
          <div>{alertMsg.text}</div>
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 relative ${
          dragActive
            ? "border-purple-500 bg-purple-950/20"
            : "border-purple-950/40 bg-[#0a0a0f] hover:border-purple-500/40"
        }`}
      >
        <input
          type="file"
          id="rfp-file-input"
          className="hidden"
          accept=".txt,.md,.pdf,.docx,.doc"
          onChange={handleFileInput}
        />
        <label htmlFor="rfp-file-input" className="cursor-pointer block">
          <UploadCloud className="h-12 w-12 text-purple-400/70 mx-auto mb-3" />
          <p className="text-slate-200 font-medium">
            Drag and drop your PDF or DOCX file here, or{" "}
            <span className="text-purple-400 hover:text-purple-300 underline">browse files</span>
          </p>
          <p className="text-slate-500 text-xs mt-1.5">
            Accepts documents & plain text files. Extracted safely on server.
          </p>
        </label>

        {progress > 0 && (
          <div className="mt-4 max-w-xs mx-auto space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
              <span>Read State:</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-[#1a1a2e] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-purple-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {fileName && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-purple-950/40 border border-purple-900/40 rounded-full text-purple-300 text-xs font-mono">
            <FileText className="h-3.5 w-3.5" />
            <span>Parsed: {fileName}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-purple-300 font-mono block">
          RFP TEXT COGNITIVE PREVIEW
        </label>
        <textarea
          value={previewText}
          onChange={handlePreviewChange}
          placeholder="Or paste literal technical specifications, RFP guidelines, SOW criteria here..."
          className="w-full h-48 bg-[#0a0a0f] text-slate-200 p-4 rounded-xl border border-purple-950/40 focus:outline-none focus:border-purple-500 font-mono text-xs leading-relaxed"
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSubmitText}
          disabled={isProcessing || !rfpText.trim()}
          className="w-full sm:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl transition duration-200 shadow-lg shadow-purple-600/10 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <Loader className="h-5 w-5 animate-spin" />
              <span>AI is analyzing your document...</span>
            </>
          ) : (
            <>
              <span>Analyze RFP</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
