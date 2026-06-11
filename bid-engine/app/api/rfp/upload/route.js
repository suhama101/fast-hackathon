import { NextResponse } from "next/server";
import { extractTextFromFile } from "../../../../lib/pdfParser";
import { requireAuthenticatedUser } from "../../../../lib/requestAuth";

export const runtime = "nodejs";

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
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

    const formData = await request.formData();
    const file = formData.get("file");
    const bidTitle = formData.get("title") || "Untitled RFP";

    if (!file || typeof file.arrayBuffer !== "function") {
      return badRequest("No RFP file uploaded.");
    }

    const filename = file.name || "uploaded-rfp";
    const fileType = file.type || "";
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extractedText = await extractTextFromFile(buffer, filename, fileType);

    if (looksLikeBinaryData(extractedText)) {
      return badRequest("Could not read file. Please ensure it is a valid PDF or DOCX document.");
    }

    if (extractedText.trim().length < 100) {
      return badRequest("File appears to be empty or could not be read properly.");
    }

    return NextResponse.json(
      {
        success: true,
        fileName: filename,
        fileType,
        bidTitle,
        characterCount: extractedText.length,
        previewText: extractedText.slice(0, 500),
        rawText: extractedText
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json(
      { error: "Failed to parse uploaded RFP: " + err.message },
      { status: 400 }
    );
  }
}
