import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

/**
 * Extracts plain text from a PDF buffer using pdf-parse.
 * @param {Buffer} buffer - The file buffer of the PDF.
 * @returns {Promise<string>} - Clean extracted text.
 */
export async function extractTextFromPDF(buffer) {
  try {
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    await parser.destroy();
    return cleanText(data.text || "");
  } catch (error) {
    console.error("Error parsing PDF with pdf-parse:", error);
    throw new Error(`PDF Parsing failed: ${error.message}`);
  }
}

/**
 * Extracts plain text from a DOCX buffer using mammoth.
 * @param {Buffer} buffer - The file buffer of the DOCX.
 * @returns {Promise<string>} - Clean extracted text.
 */
export async function extractTextFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return cleanText(result.value || "");
  } catch (error) {
    console.error("Error parsing DOCX with mammoth:", error);
    throw new Error(`DOCX Parsing failed: ${error.message}`);
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

/**
 * Main dispatcher to parse text depending on document type.
 * Maintains compatibility with standard API endpoints.
 */
export async function parseRawRfpDocument(buffer, fileType = "application/pdf") {
  if (!buffer) return "";
  let text = "";
  
  const mime = fileType ? fileType.toLowerCase() : "";
  
  try {
    if (mime.includes("docx") || mime.includes("officedocument.wordprocessingml.document") || mime.includes("msword")) {
      text = await extractTextFromDOCX(buffer);
    } else if (mime.includes("pdf")) {
      text = await extractTextFromPDF(buffer);
    } else {
      // Fallback: decode directly as plain text
      text = buffer.toString("utf-8");
    }
  } catch (error) {
    console.warn(`Type-specific parsing failed for ${fileType}. Falling back to plain text decoding.`, error);
    try {
      text = buffer.toString("utf-8");
    } catch (fallbackError) {
      throw new Error(`Failed to decode file buffer: ${fallbackError.message}`);
    }
  }

  return cleanText(text);
}
