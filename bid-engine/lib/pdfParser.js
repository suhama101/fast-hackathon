const MIN_EXTRACTED_TEXT_LENGTH = 50;

/**
 * Extracts plain text from a PDF buffer.
 * Primary: pdf-parse 1.1.1 (no browser APIs, works in Node / Vercel serverless)
 * Fallback: pure regex stream reader (works even if pdf-parse is unavailable)
 */
export async function extractTextFromPDF(buffer) {
  let text = "";

  try {
    // pdf-parse 1.1.1 — default export is a plain async function, no DOMMatrix
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    text = result?.text || "";
  } catch (err) {
    console.warn("pdf-parse failed, using regex fallback:", err.message);
    text = extractPdfTextViaRegex(buffer);
  }

  return ensureReadableText(text, "PDF");
}

/**
 * Pure Node.js regex-based PDF text extractor.
 * Reads BT/ET text blocks from raw PDF byte stream.
 * No browser APIs needed — works in all serverless environments.
 */
function extractPdfTextViaRegex(buffer) {
  const raw = buffer.toString("latin1");
  const lines = [];

  // Extract text between BT (begin text) … ET (end text) markers
  const btEtRegex = /BT[\s\S]*?ET/g;
  let block;
  while ((block = btEtRegex.exec(raw)) !== null) {
    // (text) Tj operator
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let m;
    while ((m = tjRegex.exec(block[0])) !== null) {
      lines.push(decodePdfString(m[1]));
    }
    // [(text) offset …] TJ operator
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    while ((m = tjArrayRegex.exec(block[0])) !== null) {
      const parts = m[1].match(/\(([^)]*)\)/g) || [];
      parts.forEach((p) => lines.push(decodePdfString(p.slice(1, -1))));
    }
  }

  // Hex-encoded strings: <4865...> Tj
  const hexTjRegex = /<([0-9A-Fa-f]+)>\s*Tj/g;
  let hm;
  while ((hm = hexTjRegex.exec(raw)) !== null) {
    try {
      const hex = hm[1];
      let str = "";
      for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      }
      lines.push(str);
    } catch (_) {}
  }

  return lines.join(" ").replace(/\s{2,}/g, " ").trim();
}

function decodePdfString(str) {
  return str
    .replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
}

/**
 * Extracts plain text from a DOCX buffer using mammoth.
 */
export async function extractTextFromDOCX(buffer) {
  try {
    const mammothModule = await import("mammoth");
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.extractRawText({ buffer });
    return ensureReadableText(result.value, "DOCX file");
  } catch (error) {
    console.error("Error parsing DOCX with mammoth:", error);
    throw new Error("DOCX parsing failed: " + error.message);
  }
}

export function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ensureReadableText(text, fileType) {
  const cleaned = cleanText(text || "");
  if (!cleaned || cleaned.length < MIN_EXTRACTED_TEXT_LENGTH) {
    throw new Error(
      `Could not extract readable text from ${fileType}. ` +
      `The file may be scanned/image-based or password-protected.`
    );
  }
  return cleaned;
}

function getFileExtension(filename = "") {
  return filename.toLowerCase().split(".").pop() || "";
}

/**
 * Main dispatcher — routes to the correct parser by file type.
 */
export async function extractTextFromFile(buffer, filename = "", fileType = "") {
  if (!buffer) throw new Error("No file buffer provided");

  const ext = getFileExtension(filename);
  const mime = fileType ? fileType.toLowerCase() : "";

  if (ext === "pdf" || mime.includes("pdf")) {
    return extractTextFromPDF(buffer);
  }
  if (ext === "docx" || mime.includes("officedocument.wordprocessingml.document")) {
    return extractTextFromDOCX(buffer);
  }
  if (ext === "txt" || ext === "md" || mime.startsWith("text/")) {
    return cleanText(buffer.toString("utf-8"));
  }

  throw new Error("Unsupported file type: " + (ext || fileType || "unknown"));
}

export async function parseRawRfpDocument(buffer, fileType = "application/pdf", filename = "") {
  return extractTextFromFile(buffer, filename, fileType);
}
