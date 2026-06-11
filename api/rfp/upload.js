import { parseRawRfpDocument } from "../../bid-engine/lib/pdfParser.js";

const readBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
};

const decodePayload = (payload = {}) => {
  if (payload.rawText) {
    return {
      buffer: Buffer.from(String(payload.rawText), "utf-8"),
      fileType: "text/plain",
    };
  }

  const dataUrl = payload.dataUrl || payload.base64 || "";
  const match = String(dataUrl).match(/^data:(.*?);base64,(.*)$/);
  if (match) {
    return {
      buffer: Buffer.from(match[2], "base64"),
      fileType: match[1] || payload.fileType || payload.type || "application/octet-stream",
    };
  }

  if (payload.data) {
    return {
      buffer: Buffer.from(String(payload.data), "base64"),
      fileType: payload.fileType || payload.type || "application/octet-stream",
    };
  }

  return { buffer: null, fileType: payload.fileType || payload.type || "application/octet-stream" };
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: "Method not allowed" });
    }

    const payload = readBody(req);
    const bidTitle = payload.title || payload.bidTitle || "Untitled RFP";
    const fileName = payload.fileName || payload.name || "uploaded-rfp";

    const { buffer, fileType } = decodePayload(payload);
    if (!buffer) {
      return res.status(400).json({ error: "No RFP file uploaded." });
    }

    const rawText = await parseRawRfpDocument(buffer, fileType);

    return res.status(200).json({
      success: true,
      fileName,
      fileType,
      bidTitle,
      characterCount: rawText.length,
      rawText: rawText || "Extracted content was empty or unparseable. Try a PDF or text-based document.",
    });
  } catch (err) {
    console.error("Upload route error:", err);
    return res.status(500).json({ error: "Failed to parse uploaded RFP: " + err.message });
  }
}
