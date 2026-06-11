import { Groq } from "groq-sdk";

/**
 * Instantiates the Groq client securely using server-side environment variables.
 */
export const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("GROQ_API_KEY is not defined in the environment. Client calls will fail without key.");
  }
  return new Groq({
    apiKey: apiKey || "dummy-key",
  });
};

/**
 * Expert analysis utility utilizing llama-3.3-70b-versatile.
 * Consistently returns structured JSON records.
 * 
 * @param {string} prompt - User request containing target document text or parameters.
 * @param {string} systemPrompt - Guidelines enforcing systemic constraints and structure.
 * @returns {Promise<object>} - Parsed JSON object.
 */
export async function analyzeWithGroq(prompt, systemPrompt) {
  const groq = getGroqClient();
  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      max_tokens: 4000,
      // Request JSON response formatting (Llama-3.3 supports json_object structured mode)
      response_format: { type: "json_object" }
    });

    const outputText = response.choices[0]?.message?.content || "{}";
    
    // Safely parse JSON structure
    return JSON.parse(outputText);
  } catch (error) {
    console.error("Error in analyzeWithGroq:", error);
    
    // Attempt dynamic extraction of JSON blocks if something went weird inside the raw text response
    try {
      const completionText = error.response?.choices?.[0]?.message?.content || "";
      if (completionText) {
        const jsonRegex = /\{[\s\S]*\}/;
        const match = completionText.match(jsonRegex);
        if (match) {
          return JSON.parse(match[0]);
        }
      }
    } catch (innerError) {
      console.error("Fallback json extraction parse failed:", innerError);
    }
    
    // Return standard error container ensuring valid JSON is ALWAYS returned
    return {
      error: true,
      message: error.message || "Failed to parse API outcome with Groq",
      fallback: true
    };
  }
}

/**
 * Utility to run standard chat completions on llama-3.3-70b-versatile
 */
export const runBidCompletion = async (systemPrompt, userPrompt, temperature = 0.2) => {
  const groq = getGroqClient();
  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "llama-3.3-70b-versatile",
      temperature,
    });
    return response.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Groq Completion Error:", error);
    throw new Error(`Failed to consult Groq AI API: ${error.message}`);
  }
};
