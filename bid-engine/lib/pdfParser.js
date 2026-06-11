const MIN_EXTRACTED_TEXT_LENGTH = 50;

/**
 * Extracts plain text from a PDF buffer using pdf-parse.
 * @param {Buffer} buffer - The file buffer of the PDF.
 * @returns {Promise<string>} - Clean extracted text.
 */
export async function extractTextFromPDF(buffer) {
  let parser;

  try {
    const { PDFParse } = await import("pdf-parse");
    parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    return ensureReadableText(data.text, "PDF");
  } catch (error) {
    console.error("Error parsing PDF with pdf-parse:", error);
    throw new Error("PDF parsing failed: " + error.message);
  } finally {
    if (parser) {
      await parser.destroy().catch((destroyError) => {
        console.warn("Error cleaning up PDF parser:", destroyError);
      });
    }
  }
}

/**
 * Extracts plain text from a DOCX buffer using mammoth.
 * @param {Buffer} buffer - The file buffer of the DOCX.
 * @returns {Promise<string>} - Clean extracted text.
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

/**
 * Clean textual data by removing control characters, normalizing line-breaks,
 * and trimming excess whitespace.
 * @param {string} text - The raw extracted text.
 * @returns {string} - The cleaned text.
 */
export function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "") // remove control chars except tab/newline
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // fold multiple sequential newlines for cleaner prompts
    .trim();
}

function ensureReadableText(text, fileType) {
  const cleanedText = cleanText(text || "");

  if (!cleanedText || cleanedText.trim().length < MIN_EXTRACTED_TEXT_LENGTH) {
    throw new Error(`Could not extract text from ${fileType}`);
  }

  return cleanedText;
}

function getFileExtension(filename = "") {
  return filename.toLowerCase().split(".").pop() || "";
}

/**
 * Main dispatcher to parse text depending on document type.
 * Maintains compatibility with standard API endpoints.
 */
export async function extractTextFromFile(buffer, filename = "", fileType = "") {
  if (!buffer) {
    throw new Error("No file buffer provided");
  }

  const ext = getFileExtension(filename);
  const mime = fileType ? fileType.toLowerCase() : "";

  if (ext === "pdf" || mime.includes("pdf")) {
    return extractTextFromPDF(buffer);
  }

  if (
    ext === "docx" ||
    mime.includes("officedocument.wordprocessingml.document")
  ) {
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
