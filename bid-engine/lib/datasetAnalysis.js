const STOPWORDS = new Set([
  "the", "and", "for", "with", "must", "shall", "will", "this", "that", "from", "have", "has",
  "are", "our", "your", "rfp", "bid", "response", "proposal", "project", "service", "services",
  "provide", "candidate", "proposed", "solution", "solutions", "requirement", "requirements"
]);

export const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

const unique = (values) => [...new Set(values)];

const containsPhraseBonus = (requirementText, capabilityText) => {
  const req = requirementText.toLowerCase();
  const cap = capabilityText.toLowerCase();
  let bonus = 0;
  ["iso 27001", "soc 2", "pmp", "99.99", "cybersecurity", "construction", "fleet", "erp", "healthcare"].forEach((phrase) => {
    if (req.includes(phrase) && cap.includes(phrase)) bonus += 12;
  });
  return bonus;
};

export function matchRequirementToCapabilities(requirement, capabilities = []) {
  const requirementText = requirement.requirement_text || requirement.description || requirement.title || "";
  const reqTokens = unique(tokenize(requirementText));

  const scored = capabilities.map((capability) => {
    const capabilityText = [
      capability.domain,
      capability.project_name,
      capability.description,
      capability.project_summary,
      capability.certification,
      capability.client_type,
      ...(capability.skills || []),
      ...(capability.certifications || []),
    ].join(" ");

    const capTokens = new Set(tokenize(capabilityText));
    const overlap = reqTokens.filter((token) => capTokens.has(token));
    const overlapScore = reqTokens.length ? (overlap.length / reqTokens.length) * 100 : 0;
    const score = Math.min(100, Math.round(overlapScore + containsPhraseBonus(requirementText, capabilityText)));

    return {
      capability,
      confidence: score,
      matchedTerms: overlap,
    };
  }).sort((a, b) => b.confidence - a.confidence);

  const best = scored[0];
  const status = !best || best.confidence < 25 ? "fail" : best.confidence >= 55 ? "pass" : "partial";
  const evidence = best
    ? `${best.capability.external_id || best.capability.id || "CAP"}: ${best.capability.project_summary || best.capability.description || best.capability.project_name}`
    : "No capability evidence found.";

  return {
    compliance_status: status,
    confidence: best?.confidence || 0,
    evidence,
    reasoning: best
      ? `Matched ${best.matchedTerms.length} key terms against ${best.capability.domain || "capability"} evidence and certification ${best.capability.certification || "N/A"}.`
      : "No capability record could be compared.",
    capability: best?.capability || null,
  };
}

export function inferSectorFromText(text, sectors = []) {
  const tokens = new Set(tokenize(text));
  let best = { sector: sectors[0] || "General", score: 0 };

  sectors.forEach((sector) => {
    const sectorTokens = tokenize(sector);
    const score = sectorTokens.filter((token) => tokens.has(token)).length;
    if (score > best.score) best = { sector, score };
  });

  return best.sector;
}

export function calculateWinScore({ requirements = [], capabilities = [], bidHistory = [], rawText = "" }) {
  const sectors = unique(bidHistory.map((bid) => bid.sector).filter(Boolean));
  const sector = inferSectorFromText(
    `${rawText} ${requirements.map((req) => req.requirement_text || req.description || "").join(" ")}`,
    sectors
  );

  const sectorBids = bidHistory.filter((bid) => bid.sector === sector);
  const historyBase = sectorBids.length ? sectorBids : bidHistory;
  const wins = historyBase.filter((bid) => String(bid.outcome).toLowerCase() === "win").length;
  const sectorWinRate = historyBase.length ? Math.round((wins / historyBase.length) * 100) : 50;

  const passed = requirements.filter((req) => req.compliance_status === "pass").length;
  const partial = requirements.filter((req) => req.compliance_status === "partial").length;
  const capabilityMatch = requirements.length
    ? Math.round(((passed + partial * 0.55) / requirements.length) * 100)
    : Math.min(90, Math.round((capabilities.length / 50) * 100));

  const mandatory = requirements.filter((req) => req.requirement_type === "mandatory");
  const mandatoryPassed = mandatory.filter((req) => req.compliance_status === "pass").length;
  const mandatoryPartial = mandatory.filter((req) => req.compliance_status === "partial").length;
  const complianceScore = mandatory.length
    ? Math.round(((mandatoryPassed + mandatoryPartial * 0.5) / mandatory.length) * 100)
    : Math.round(historyBase.reduce((sum, bid) => sum + Number(bid.compliance_percent || 0), 0) / Math.max(1, historyBase.length)) || 70;

  const avgHistoryScore = historyBase.length
    ? Math.round(historyBase.reduce((sum, bid) => sum + Number(bid.score_percent || 0), 0) / historyBase.length)
    : 65;

  const budgetNumbers = [rawText, ...requirements.map((req) => req.extracted_value || req.requirement_text || "")]
    .join(" ")
    .match(/\d+(\.\d+)?/g)
    ?.map(Number) || [];
  const budgetAlignment = budgetNumbers.length ? Math.min(100, Math.max(45, 100 - Math.min(55, budgetNumbers[0] / 10))) : 75;

  const similarExperienceScore = Math.min(100, Math.round((capabilities.filter((cap) => cap.domain === sector).length / Math.max(1, capabilities.length)) * 220));
  const totalScore = Math.round(
    capabilityMatch * 0.28 +
    complianceScore * 0.24 +
    sectorWinRate * 0.18 +
    avgHistoryScore * 0.18 +
    budgetAlignment * 0.12
  );

  return {
    sector,
    total_score: Math.max(0, Math.min(100, totalScore)),
    budget_alignment: Math.round(budgetAlignment),
    capability_match: capabilityMatch,
    compliance_score: complianceScore,
    sector_win_rate: sectorWinRate,
    similar_experience_score: similarExperienceScore,
    evaluation_history_score: avgHistoryScore,
    decision: totalScore >= 70 ? "GO" : "NO-GO",
  };
}
