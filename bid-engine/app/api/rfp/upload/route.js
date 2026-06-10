import { NextResponse } from "next/server";
import { parseRawRfpDocument } from "../../../../lib/pdfParser";

/**
 * Handles multipart file uploads (RFPs) and converts them to readable text strings.
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const bidTitle = formData.get("title") || "Untitled RFP";

    if (!file) {
      return NextResponse.json(
        { error: "No RFP file uploaded." },
        { status: 400 }
      );
    }

    // Convert file content to array buffer & invoke custom parser tool
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const rawText = await parseRawRfpDocument(buffer, file.type);

    return NextResponse.json(
      {
        success: true,
        fileName: file.name,
        fileType: file.type,
        bidTitle,
        characterCount: rawText.length,
        rawText: rawText || "Extracted content was empty or unparseable. Try a PDF or text-based document."
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json(
      { error: "Failed to parse uploaded RFP: " + err.message },
      { status: 500 }
    );
  }
}
