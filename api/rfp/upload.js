import { extractTextFromFile } from "../../bid-engine/lib/pdfParser.js";
import { requireAuthenticatedUser } from "../_lib/requestAuth.js";
import { getSupabaseAdminOrNull } from "../_lib/supabase.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;

const errorResponse = (res, status, message) =>
  res.status(status).json({ success: false, error: message });

const getHeader = (req, name) => req.headers[name] || req.headers[name.toLowerCase()] || "";

const getFileExtension = (filename = "") => String(filename).toLowerCase().split(".").pop() || "";

const isSupportedUpload = (filename = "", fileType = "") => {
  const ext = getFileExtension(filename);
  const mime = String(fileType || "").toLowerCase();

  return (
    ext === "pdf" ||
    ext === "docx" ||
    ext === "txt" ||
    ext === "md" ||
    mime.includes("pdf") ||
    mime.includes("officedocument.wordprocessingml.document") ||
    mime.startsWith("text/")
  );
};

const looksLikeBinaryData = (text = "") =>
  text.includes("PK!") ||
  text.includes("PK\u0003\u0004") ||
  text.includes("[Content_Types]") ||
  text.includes("\x00") ||
  text.includes("\\x00");

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

const readRequestBuffer = (req) =>
  new Promise((resolve, reject) => {
    if (Buffer.isBuffer(req.body)) {
      resolve(req.body);
      return;
    }

    const contentLength = Number(getHeader(req, "content-length") || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      const error = new Error("File is too large. Upload a PDF or DOCX smaller than 4 MB.");
      error.statusCode = 413;
      reject(error);
      return;
    }

    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_REQUEST_BYTES) {
        const error = new Error("File is too large. Upload a PDF or DOCX smaller than 4 MB.");
        error.statusCode = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const parseContentDisposition = (value = "") => {
  const name = value.match(/name="([^"]+)"/i)?.[1] || "";
  const filename = value.match(/filename="([^"]*)"/i)?.[1] || "";
  return { name, filename };
};

const parseMultipartForm = async (req, contentType) => {
  const boundary = String(contentType).match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] ||
    String(contentType).match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];

  if (!boundary) {
    throw new Error("Invalid multipart upload. Missing form boundary.");
  }

  const body = await readRequestBuffer(req);
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  const fields = {};
  let file = null;
  let cursor = 0;

  while (cursor < body.length) {
    const boundaryStart = body.indexOf(boundaryBuffer, cursor);
    if (boundaryStart === -1) break;

    let partStart = boundaryStart + boundaryBuffer.length;
    if (body.slice(partStart, partStart + 2).toString("latin1") === "--") break;
    if (body.slice(partStart, partStart + 2).toString("latin1") === "\r\n") partStart += 2;

    const nextBoundary = body.indexOf(boundaryBuffer, partStart);
    if (nextBoundary === -1) break;

    let part = body.slice(partStart, nextBoundary);
    if (part.slice(-2).toString("latin1") === "\r\n") part = part.slice(0, -2);

    const headerEnd = part.indexOf(headerSeparator);
    if (headerEnd === -1) {
      cursor = nextBoundary;
      continue;
    }

    const headerText = part.slice(0, headerEnd).toString("latin1");
    const value = part.slice(headerEnd + headerSeparator.length);
    const disposition = headerText.match(/^content-disposition:\s*(.+)$/im)?.[1] || "";
    const contentTypeHeader = headerText.match(/^content-type:\s*(.+)$/im)?.[1]?.trim() || "";
    const { name, filename } = parseContentDisposition(disposition);

    if (!name) {
      cursor = nextBoundary;
      continue;
    }

    if (filename) {
      file = {
        buffer: value,
        fileName: filename,
        fileType: contentTypeHeader || "application/octet-stream",
        fileSize: value.length,
      };
    } else {
      fields[name] = value.toString("utf-8");
    }

    cursor = nextBoundary;
  }

  return { fields, file };
};

const decodeLegacyPayload = (payload = {}) => {
  const fileName = payload.fileName || payload.name || "uploaded-rfp.txt";

  if (payload.rawText) {
    return {
      fields: { title: payload.title || payload.bidTitle || fileName.replace(/\.[^.]+$/, "") },
      file: {
        buffer: Buffer.from(String(payload.rawText), "utf-8"),
        fileName,
        fileType: "text/plain",
        fileSize: Buffer.byteLength(String(payload.rawText), "utf-8"),
      },
    };
  }

  const dataUrl = payload.dataUrl || payload.base64 || "";
  const match = String(dataUrl).match(/^data:(.*?);base64,(.*)$/);
  if (match) {
    const buffer = Buffer.from(match[2], "base64");
    return {
      fields: { title: payload.title || payload.bidTitle || fileName.replace(/\.[^.]+$/, "") },
      file: {
        buffer,
        fileName,
        fileType: match[1] || payload.fileType || payload.type || "application/octet-stream",
        fileSize: buffer.length,
      },
    };
  }

  if (payload.data) {
    const buffer = Buffer.from(String(payload.data), "base64");
    return {
      fields: { title: payload.title || payload.bidTitle || fileName.replace(/\.[^.]+$/, "") },
      file: {
        buffer,
        fileName,
        fileType: payload.fileType || payload.type || "application/octet-stream",
        fileSize: buffer.length,
      },
    };
  }

  return { fields: {}, file: null };
};

const readUpload = async (req) => {
  const contentType = String(getHeader(req, "content-type") || "");
  if (contentType.toLowerCase().startsWith("multipart/form-data")) {
    return parseMultipartForm(req, contentType);
  }

  return decodeLegacyPayload(readBody(req));
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return errorResponse(res, 405, "Method not allowed");
    }

    const auth = await requireAuthenticatedUser(req);
    if (auth.errorResponse) {
      return res.status(auth.errorResponse.status).json(auth.errorResponse.body);
    }

    const { supabase, user } = auth;
    const workspaceDb = getSupabaseAdminOrNull() || supabase;
    const contentType = String(getHeader(req, "content-type") || "");

    // ── JSON path: client already extracted text (PDF parsed in browser) ──────
    if (contentType.includes("application/json")) {
      let body = {};
      try {
        const raw = await new Promise((resolve, reject) => {
          const chunks = [];
          req.on("data", (c) => chunks.push(c));
          req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
          req.on("error", reject);
        });
        body = JSON.parse(raw);
      } catch (_) {
        body = req.body || {};
      }

      const rawText = String(body.rawText || "").trim();
      const fileName = String(body.fileName || "uploaded-rfp.txt");
      const bidTitle = String(body.title || body.bidTitle || fileName.replace(/\.[^.]+$/, "") || "Untitled RFP").trim();

      if (!rawText || rawText.length < 50) {
        return errorResponse(res, 400, "No readable text provided.");
      }

      const { data: workspace, error: workspaceError } = await workspaceDb
        .from("rfp_workspaces")
        .insert({ user_id: user.id, title: bidTitle, status: "uploaded", raw_text: rawText, file_name: fileName })
        .select("id,user_id,title,status,raw_text,file_name,created_at,updated_at")
        .single();

      if (workspaceError || !workspace?.id) {
        const message = workspaceError?.message || "Unknown Supabase insert error";
        const isPermissionError = /permission|policy|rls|row-level|violates row-level/i.test(message);
        return errorResponse(res, isPermissionError ? 403 : 500,
          isPermissionError
            ? "Text received but Supabase rejected the workspace insert. Check RLS policies."
            : "Text received but workspace could not be saved: " + message);
      }

      return res.status(200).json({
        success: true, fileName, fileType: "text/plain", fileSize: rawText.length,
        bidTitle, characterCount: rawText.length, previewText: rawText.slice(0, 500),
        rawText, workspaceId: workspace.id, workspace,
      });
    }

    // ── Multipart path: DOCX / TXT file uploaded directly ────────────────────
    const { fields, file } = await readUpload(req);

    if (!file?.buffer?.length) {
      return errorResponse(res, 400, "No RFP file uploaded.");
    }

    const fileName = file.fileName || "uploaded-rfp";
    const fileType = file.fileType || "application/octet-stream";
    const bidTitle = String(fields.title || fields.bidTitle || fileName.replace(/\.[^.]+$/, "") || "Untitled RFP").trim();

    if (file.fileSize > MAX_UPLOAD_BYTES) {
      return errorResponse(res, 413, "File is too large. Upload a file smaller than 4 MB.");
    }

    if (!isSupportedUpload(fileName, fileType)) {
      return errorResponse(res, 400, "Unsupported file type. Please upload a PDF, DOCX, or plain text RFP.");
    }

    const rawText = await extractTextFromFile(file.buffer, fileName, fileType);

    if (looksLikeBinaryData(rawText)) {
      return errorResponse(res, 400, "Could not read file. Please ensure it is a valid DOCX document.");
    }

    if (rawText.trim().length < 100) {
      return errorResponse(res, 400, "File appears to be empty or could not be read properly.");
    }

    const { data: workspace, error: workspaceError } = await workspaceDb
      .from("rfp_workspaces")
      .insert({ user_id: user.id, title: bidTitle, status: "uploaded", raw_text: rawText, file_name: fileName })
      .select("id,user_id,title,status,raw_text,file_name,created_at,updated_at")
      .single();

    if (workspaceError || !workspace?.id) {
      const message = workspaceError?.message || "Unknown Supabase insert error";
      const isPermissionError = /permission|policy|rls|row-level|violates row-level/i.test(message);
      return errorResponse(res, isPermissionError ? 403 : 500,
        isPermissionError
          ? "Uploaded text was extracted, but Supabase rejected the workspace insert. Check rfp_workspaces RLS insert policy."
          : "Uploaded text was extracted, but the workspace could not be saved: " + message);
    }

    return res.status(200).json({
      success: true, fileName, fileType, fileSize: file.fileSize, bidTitle,
      characterCount: rawText.length, previewText: rawText.slice(0, 500),
      rawText, workspaceId: workspace.id, workspace,
    });
  } catch (err) {
    console.error("Upload route error:", err);
    return errorResponse(res, err.statusCode || 500, "Failed to parse uploaded RFP: " + err.message);
  }
}
