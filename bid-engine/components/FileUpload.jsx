"use client";

import React, { useEffect, useState } from "react";
import { UploadCloud, FileText, CheckCircle, AlertCircle, ArrowRight, Loader, FileUp } from "lucide-react";

const SAMPLE_RFPS = [
  { label: "IT Services",    fileName: "rfp-it-services.txt",             path: "/sample-rfps/rfp-it-services.txt" },
  { label: "Cybersecurity",  fileName: "rfp-cybersecurity-deployment.txt",path: "/sample-rfps/rfp-cybersecurity-deployment.txt" },
  { label: "Construction",   fileName: "rfp-construction.txt",            path: "/sample-rfps/rfp-construction.txt" },
  { label: "Logistics",      fileName: "rfp-logistics.txt",               path: "/sample-rfps/rfp-logistics.txt" },
];

const PREVIEW_CHAR_LIMIT = 500;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const SUPPORTED_FILE_TYPES = new Set(["pdf", "docx", "txt", "md"]);

function getPreviewText(text = "") { return text.slice(0, PREVIEW_CHAR_LIMIT); }
function getFileExtension(filename = "") { return filename.toLowerCase().split(".").pop() || ""; }

/**
 * Extract text from PDF entirely in the browser using pdfjs-dist.
 * Runs in browser only — no serverless/DOMMatrix issues.
 */
async function extractPdfInBrowser(file) {
  // Dynamic import so Vite only loads this when needed (lazy)
  const pdfjsLib = await import("pdfjs-dist");

  // Use CDN worker for pdfjs-dist v5 — avoids bundling the 1MB worker file
  const PDFJS_VERSION = "5.4.296";
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str || "").join(" ");
    pageTexts.push(pageText);
  }

  await pdf.destroy();
  return pageTexts.join("\n\n").replace(/[ \t]{3,}/g, " ").trim();
}

export default function FileUpload({ onTextParsed, isProcessing, initialText = "" }) {
  const [dragActive, setDragActive]       = useState(false);
  const [rfpText, setRfpText]             = useState(initialText);
  const [previewText, setPreviewText]     = useState(getPreviewText(initialText));
  const [alertMsg, setAlertMsg]           = useState(null);
  const [fileName, setFileName]           = useState("");
  const [uploadedWorkspace, setUploadedWorkspace] = useState(null);
  const [progress, setProgress]           = useState(0);
  const [selectedSampleRfp, setSelectedSampleRfp] = useState(SAMPLE_RFPS[0].path);

  useEffect(() => {
    setRfpText(initialText || "");
    setPreviewText(getPreviewText(initialText || ""));
  }, [initialText]);

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handlePickedFile(e.dataTransfer.files[0]);
  };

  const handleFileInput = (e) => {
    if (e.target.files?.[0]) handlePickedFile(e.target.files[0]);
  };

  const handlePickedFile = async (file) => {
    setFileName(""); setUploadedWorkspace(null); setAlertMsg(null);
    setRfpText(""); setPreviewText(""); setProgress(10);

    try {
      const ext = getFileExtension(file.name);
      if (!SUPPORTED_FILE_TYPES.has(ext)) {
        throw new Error("Unsupported file type. Please upload a PDF, DOCX, or plain text file.");
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error("File is too large. Please upload a file smaller than 4 MB.");
      }

      const authToken = typeof window !== "undefined" ? localStorage.getItem("bid_engine_token") : "";
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

      let extractedText = "";
      let workspaceData = null;

      if (ext === "pdf") {
        // ── PDF: parse in browser, send text to API ──────────────────────────
        setProgress(20);
        extractedText = await extractPdfInBrowser(file);
        setProgress(60);

        if (!extractedText || extractedText.trim().length < 50) {
          throw new Error("Could not extract text from this PDF. It may be scanned or image-based.");
        }

        // Send extracted text as JSON to create a workspace
        const response = await fetch("/api/rfp/upload", {
          method: "POST",
          credentials: "include",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            rawText: extractedText,
            fileName: file.name,
            title: file.name.replace(/\.[^.]+$/, ""),
          }),
        });
        setProgress(85);

        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
          ? await response.json().catch(() => ({}))
          : { error: await response.text().catch(() => "") };

        if (!response.ok) throw new Error(data.error || "Failed to save workspace.");
        workspaceData = data.workspace || null;

      } else if (ext === "docx") {
        // ── DOCX: send file to server, mammoth parses it ──────────────────────
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name.replace(/\.[^.]+$/, ""));

        const response = await fetch("/api/rfp/upload", {
          method: "POST",
          credentials: "include",
          headers,
          body: formData,
        });
        setProgress(80);

        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
          ? await response.json().catch(() => ({}))
          : { error: await response.text().catch(() => "") };

        if (!response.ok) throw new Error(data.error || "Upload failed.");
        extractedText = data.rawText || "";
        workspaceData = data.workspace || null;

      } else {
        // ── TXT / MD: read directly in browser ───────────────────────────────
        extractedText = await file.text();

        const response = await fetch("/api/rfp/upload", {
          method: "POST",
          credentials: "include",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            rawText: extractedText,
            fileName: file.name,
            title: file.name.replace(/\.[^.]+$/, ""),
          }),
        });
        setProgress(80);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Failed to save workspace.");
        workspaceData = data.workspace || null;
      }

      if (!extractedText.trim()) throw new Error("No readable text was extracted from this file.");

      setRfpText(extractedText);
      setPreviewText(getPreviewText(extractedText));
      setFileName(file.name);
      setUploadedWorkspace(workspaceData);
      setProgress(100);
      setAlertMsg({
        type: "success",
        text: `Parsed "${file.name}" (${extractedText.length.toLocaleString()} characters). Click "Analyze RFP" to extract requirements.`,
      });
    } catch (err) {
      console.error("File parse error:", err);
      setProgress(0);
      setRfpText(""); setPreviewText(""); setUploadedWorkspace(null);
      setAlertMsg({ type: "error", text: err.message || "Failed to parse the document." });
    }
  };

  const handlePreviewChange = (e) => {
    setRfpText(e.target.value);
    setPreviewText(e.target.value);
    setUploadedWorkspace(null);
  };

  const handleSubmitText = () => {
    if (!rfpText.trim()) {
      setAlertMsg({ type: "error", text: "Please upload or paste an RFP document first." });
      return;
    }
    onTextParsed(rfpText, {
      fileName,
      workspaceId: uploadedWorkspace?.id || null,
      workspace: uploadedWorkspace,
    });
  };

  const loadSampleRfp = async () => {
    const sample = SAMPLE_RFPS.find((item) => item.path === selectedSampleRfp) || SAMPLE_RFPS[0];
    setAlertMsg(null); setProgress(30);
    try {
      const response = await fetch(sample.path);
      if (!response.ok) throw new Error("Sample RFP file could not be loaded.");
      const text = await response.text();
      setFileName(sample.fileName);
      setUploadedWorkspace(null);
      setRfpText(text);
      setPreviewText(getPreviewText(text));
      setProgress(100);
      setAlertMsg({ type: "success", text: `Loaded "${sample.fileName}". Click "Analyze RFP" to run AI evaluation.` });
    } catch (err) {
      setProgress(0);
      setAlertMsg({ type: "error", text: err.message || "Failed to load sample RFP." });
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70 space-y-6" id="file-upload-section">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950 tracking-tight flex items-center gap-2">
            <UploadCloud className="text-blue-600 h-5 w-5" />
            Upload RFP Document
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Upload a PDF or DOCX file — text is extracted automatically before AI analysis.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={selectedSampleRfp}
            onChange={(e) => setSelectedSampleRfp(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-400"
          >
            {SAMPLE_RFPS.map((s) => (
              <option key={s.path} value={s.path}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={loadSampleRfp}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-blue-700 text-xs font-bold rounded-xl transition"
          >
            Load Sample RFP
          </button>
        </div>
      </div>

      {/* Alert */}
      {alertMsg && (
        <div className={`p-4 rounded-lg flex items-start gap-3 text-sm ${
          alertMsg.type === "success"
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
            : "bg-rose-50 text-rose-700 border border-rose-200"
        }`}>
          {alertMsg.type === "success"
            ? <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
            : <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />}
          <div>{alertMsg.text}</div>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag} onDragOver={handleDrag}
        onDragLeave={handleDrag} onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
          dragActive
            ? "border-blue-500 bg-blue-50 scale-[1.01] shadow-lg shadow-blue-100"
            : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-white hover:shadow-md"
        }`}
      >
        <input
          type="file" id="rfp-file-input" className="hidden"
          accept=".txt,.md,.pdf,.docx"
          onChange={handleFileInput}
        />
        <label htmlFor="rfp-file-input" className="cursor-pointer block">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
            <FileUp className="h-8 w-8" />
          </div>
          <p className="text-slate-800 font-semibold">
            Drag and drop your <strong>PDF</strong> or <strong>DOCX</strong> here, or{" "}
            <span className="text-blue-600 hover:text-blue-700 underline">browse files</span>
          </p>
          <p className="text-slate-500 text-xs mt-1.5">
            PDF parsed in browser · DOCX parsed on server · Max 4 MB
          </p>
        </label>

        {progress > 0 && progress < 100 && (
          <div className="mt-4 max-w-xs mx-auto space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>Extracting text...</span><span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {fileName && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-xs font-semibold">
            <FileText className="h-3.5 w-3.5" />
            <span>Ready: {fileName}</span>
          </div>
        )}
      </div>

      {/* Text Preview */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono block">
          Extracted Text Preview (editable)
        </label>
        <textarea
          value={previewText}
          onChange={handlePreviewChange}
          placeholder="Or paste RFP text directly here..."
          className="w-full h-48 bg-slate-50 text-slate-800 p-4 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-400 focus:bg-white font-mono text-xs leading-relaxed"
        />
      </div>

      {/* Analyze Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSubmitText}
          disabled={isProcessing || !rfpText.trim()}
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-500 text-white font-semibold rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 hover:-translate-y-0.5"
        >
          {isProcessing ? (
            <><Loader className="h-5 w-5 animate-spin" /><span>AI is analyzing your document...</span></>
          ) : (
            <><span>Analyze RFP</span><ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}
