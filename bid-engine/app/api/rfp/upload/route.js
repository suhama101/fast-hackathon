import { NextResponse } from "next/server";
import { extractTextFromFile } from "../../../../lib/pdfParser";
import { requireAuthenticatedUser } from "../../../../lib/requestAuth";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function errorResponse(message, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function getFileExtension(filename = "") {
  return filename.toLowerCase().split(".").pop() || "";
}

function isSupportedUpload(filename = "", fileType = "") {
  const ext = getFileExtension(filename);
  const mime = fileType.toLowerCase();

  return (
    ext === "pdf" ||
    ext === "docx" ||
    ext === "txt" ||
    ext === "md" ||
    mime.includes("pdf") ||
    mime.includes("officedocument.wordprocessingml.document") ||
    mime.startsWith("text/")
  );
}

function looksLikeBinaryData(text = "") {
  return (
    text.includes("PK!") ||
    text.includes("PK\u0003\u0004") ||
    text.includes("[Content_Types]") ||
    text.includes("\x00") ||
    text.includes("\\x00")
  );
}

/**
 * Handles multipart file uploads (RFPs) and converts them to readable text strings.
 */
export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.errorResponse) return auth.errorResponse;
    const { supabase, user } = auth;

    const formData = await request.formData();
    const file = formData.get("file");
    const bidTitle = String(formData.get("title") || "Untitled RFP").trim() || "Untitled RFP";

    if (!file || typeof file.arrayBuffer !== "function") {
      return errorResponse("No RFP file uploaded.");
    }

    const filename = file.name || "uploaded-rfp";
    const fileType = file.type || "";
    const fileSize = Number(file.size || 0);

    if (fileSize > MAX_UPLOAD_BYTES) {
      return errorResponse("File is too large. Upload a PDF or DOCX smaller than 4 MB.", 413);
    }

    if (!isSupportedUpload(filename, fileType)) {
      return errorResponse("Unsupported file type. Please upload a PDF, DOCX, or plain text RFP.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extractedText = await extractTextFromFile(buffer, filename, fileType);

    if (looksLikeBinaryData(extractedText)) {
      return errorResponse("Could not read file. Please ensure it is a valid PDF or DOCX document.");
    }

    if (extractedText.trim().length < 100) {
      return errorResponse("File appears to be empty or could not be read properly.");
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("rfp_workspaces")
      .insert({
        user_id: user.id,
        title: bidTitle,
        status: "uploaded",
        raw_text: extractedText,
        file_name: filename,
      })
      .select("id,user_id,title,status,raw_text,file_name,created_at,updated_at")
      .single();

    if (workspaceError || !workspace?.id) {
      const message = workspaceError?.message || "Unknown Supabase insert error";
      const isPermissionError = /permission|policy|rls|row-level|violates row-level/i.test(message);
      return errorResponse(
        isPermissionError
          ? "Uploaded text was extracted, but Supabase rejected the workspace insert. Check rfp_workspaces RLS insert policy for authenticated users."
          : "Uploaded text was extracted, but the workspace could not be saved: " + message,
        isPermissionError ? 403 : 500
      );
    }

    return NextResponse.json(
      {
        success: true,
        fileName: filename,
        fileType,
        fileSize,
        bidTitle,
        characterCount: extractedText.length,
        previewText: extractedText.slice(0, 500),
        rawText: extractedText,
        workspaceId: workspace.id,
        workspace
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Upload route error:", err);
    return errorResponse("Failed to parse uploaded RFP: " + err.message);
  }
}
