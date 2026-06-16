import { analyzeWithGroq } from "./groqClient";

const normalizeArray = (items = []) => Array.isArray(items)
  ? items.filter((item) => item !== null && item !== undefined)
  : [];

const formatSection = (title, body) => {
  const text = String(body || "").trim();
  if (!text) return "";
  return `## ${title}\n\n${text}\n`;
};

const buildFallbackReview = ({ proposalDrafts = [], matches = [], requirements = [], score = null }) => {
  const weakSections = proposalDrafts
    .filter((draft) => String(draft.content || "").split(/\s+/).filter(Boolean).length < 80)
    .map((draft) => ({
      section_title: draft.section_title || "Untitled Section",
      issue: "Section is too short to be persuasive or complete.",
      severity: "medium",
    }));

  const unsupportedClaims = matches.flatMap((match) => {
    const confidence = Number(match.match_confidence || match.confidence_score || 0);
    return confidence < 40
      ? [{
          requirement_id: match.id || match.requirement_id,
          issue: "Claim is weakly supported by evidence.",
          severity: "high",
        }]
      : [];
  });

  const missingCompliancePoints = requirements
    .filter((req) => String(req.compliance_status || "").toLowerCase() !== "pass")
    .slice(0, 10)
    .map((req) => ({
      requirement_id: req.id,
      issue: `Compliance status is ${String(req.compliance_status || "partial").toLowerCase()}.`,
      severity: "medium",
    }));

  const vagueLanguage = proposalDrafts
    .filter((draft) => /\b(innovative|robust|cutting-edge|seamless|world-class)\b/i.test(String(draft.content || "")))
    .map((draft) => ({
      section_title: draft.section_title || "Untitled Section",
      issue: "Contains marketing language without quantified proof.",
      severity: "low",
    }));

  const formattingIssues = proposalDrafts.some((draft) => !String(draft.content || "").includes("\n"))
    ? [{ issue: "Proposal is not structured into readable sections.", severity: "medium" }]
    : [];

  const suggestions = normalizeArray([
    weakSections.length ? "Expand short sections with evidence-backed specifics." : "Strengthen compliance evidence throughout the draft.",
    unsupportedClaims.length ? "Remove or qualify unsupported capability claims." : "Reference evidence explicitly in every material claim.",
    score && Number(score.compliance_score || 0) < 70 ? "Address mandatory compliance gaps before submission." : "Tighten the final copy and verify submission formatting.",
  ]);

  const improvedProposal = [
    formatSection("Executive Summary", "This proposal responds to the RFP using only evidence-backed claims from the capability library. Each response should be validated against mandatory requirements before submission."),
    formatSection("Understanding of Requirements", "The submission is organized around mandatory requirements, technical criteria, financial constraints, deadlines, and required documentation."),
    formatSection("Technical Approach", "The recommended approach should be concise, traceable, and aligned to the matched evidence records."),
    formatSection("Relevant Experience", "Relevant past projects and certifications should be cited directly against each requirement."),
    formatSection("Compliance Response", "All mandatory items should be explicitly marked compliant, partially compliant, or non-compliant with reasons."),
    formatSection("Implementation Approach", "The delivery plan should explain governance, review checkpoints, and submission ownership."),
    formatSection("Conclusion", "Proceed only if the compliance gap review is acceptable and the evidence package is complete."),
  ].join("\n");

  return {
    weak_sections: weakSections,
    unsupported_claims: unsupportedClaims,
    missing_compliance_points: missingCompliancePoints,
    vague_language: vagueLanguage,
    formatting_issues: formattingIssues,
    suggestions,
    improved_proposal: improvedProposal,
    final_recommendation: (score && Number(score.compliance_score || 0) >= 70 && unsupportedClaims.length === 0) ? "GO" : "NO-GO",
    rationale: score && Number(score.compliance_score || 0) < 70
      ? "Mandatory compliance is below the submission threshold."
      : unsupportedClaims.length > 0
        ? "The draft contains claims that are not sufficiently backed by capability evidence."
        : "The proposal is structurally acceptable and the evidence coverage is adequate.",
  };
};

export async function reviewProposalWithGroq({
  proposalDrafts = [],
  matches = [],
  requirements = [],
  score = null,
  workspaceTitle = "RFP Proposal",
}) {
  const systemPrompt = "You are an expert proposal reviewer and compliance auditor. Return JSON only.";
  const userPrompt = `Review this proposal for compliance risk, unsupported claims, weak language, and formatting issues.

WORKSPACE TITLE:
${workspaceTitle}

REQUIREMENTS:
${JSON.stringify(requirements.map((item) => ({
  id: item.id,
  text: item.requirement_text || item.description || "",
  compliance_status: item.compliance_status,
  matched_evidence: item.matched_evidence,
  match_confidence: item.match_confidence,
  match_reasoning: item.match_reasoning,
})))}

MATCH RESULTS:
${JSON.stringify(matches)}

SCORE SUMMARY:
${JSON.stringify(score || {})}

PROPOSAL DRAFTS:
${JSON.stringify(proposalDrafts.map((draft) => ({
  id: draft.id,
  section_title: draft.section_title,
  content: draft.content,
  status: draft.status,
})))}

Return valid JSON with this shape:
{
  "weak_sections": [{"section_title":"", "issue":"", "severity":"low|medium|high"}],
  "unsupported_claims": [{"requirement_id":"", "issue":"", "severity":"low|medium|high"}],
  "missing_compliance_points": [{"requirement_id":"", "issue":"", "severity":"low|medium|high"}],
  "vague_language": [{"section_title":"", "issue":"", "severity":"low|medium|high"}],
  "formatting_issues": [{"issue":"", "severity":"low|medium|high"}],
  "suggestions": ["..."],
  "improved_proposal": "Markdown text",
  "final_recommendation": "GO or NO-GO",
  "rationale": "short explanation"
}`;

  const aiResult = await analyzeWithGroq(userPrompt, systemPrompt);
  if (aiResult && !aiResult.error) {
    return {
      weak_sections: normalizeArray(aiResult.weak_sections || []),
      unsupported_claims: normalizeArray(aiResult.unsupported_claims || []),
      missing_compliance_points: normalizeArray(aiResult.missing_compliance_points || []),
      vague_language: normalizeArray(aiResult.vague_language || []),
      formatting_issues: normalizeArray(aiResult.formatting_issues || []),
      suggestions: normalizeArray(aiResult.suggestions || []),
      improved_proposal: String(aiResult.improved_proposal || "").trim(),
      final_recommendation: String(aiResult.final_recommendation || "NO-GO").trim().toUpperCase() === "GO" ? "GO" : "NO-GO",
      rationale: String(aiResult.rationale || "").trim(),
    };
  }

  return buildFallbackReview({ proposalDrafts, matches, requirements, score });
}
