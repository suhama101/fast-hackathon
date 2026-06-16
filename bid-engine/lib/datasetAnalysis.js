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

const numberFromText = (value) => {
  const match = String(value || "").replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
};

export const parseBudgetAmount = (value) => {
  const text = String(value || "").toLowerCase().replace(/,/g, "");
  const amount = numberFromText(text);
  if (!amount) return null;
  if (/\b(bn|billion)\b/.test(text)) return amount * 1000000000;
  if (/\b(m|mn|million)\b/.test(text)) return amount * 1000000;
  if (/\b(k|thousand)\b/.test(text)) return amount * 1000;
  return amount;
};

export function extractEntitiesFromText(rawText = "") {
  const text = String(rawText || "");
  const dateMatches = [
    ...text.matchAll(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi),
  ].map((match) => match[0]);

  const budgetMatches = [
    ...text.matchAll(/\b(?:pkr|usd|\$|rs\.?)\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|mn|million|bn|billion)?\b/gi),
    ...text.matchAll(/\b\d[\d,]*(?:\.\d+)?\s?(?:pkr|usd|dollars?|rupees?|million|mn|bn|billion)\b/gi),
  ].map((match) => match[0]);

  const mandatoryClauses = text
    .split(/\r?\n|(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter((line) => /\b(shall|must|required|mandatory|compliant|certified|submit|deadline)\b/i.test(line))
    .slice(0, 12);

  return {
    deadlines: unique(dateMatches).slice(0, 8),
    budgets: unique(budgetMatches).slice(0, 8),
    mandatory_clauses: unique(mandatoryClauses).slice(0, 12),
  };
}

export function mapCriteriaToTaxonomy(criteria = [], taxonomy = []) {
  return criteria.map((criterion) => {
    const criterionText = typeof criterion === "string"
      ? criterion
      : `${criterion.criteria_name || ""} ${criterion.description || ""} ${criterion.weight_percentage || ""}`;
    const criterionTokens = new Set(tokenize(criterionText));
    const best = taxonomy
      .map((item) => {
        const taxonomyText = `${item.criteria_name || ""} ${item.sector || ""} ${item.description || ""}`;
        const taxTokens = tokenize(taxonomyText);
        const overlap = taxTokens.filter((token) => criterionTokens.has(token)).length;
        return { item, score: overlap };
      })
      .sort((a, b) => b.score - a.score)[0];

    return {
      source_text: criterionText,
      criteria_name: best?.score ? best.item.criteria_name : criterionText,
      sector: best?.score ? best.item.sector : "General",
      weight_percentage: numberFromText(criterionText) || best?.item?.weight_percentage || null,
      description: best?.score ? best.item.description : "Extracted evaluation criterion from RFP.",
      match_score: best?.score || 0,
    };
  });
}

const containsPhraseBonus = (requirementText, capabilityText) => {
  const req = requirementText.toLowerCase();
  const cap = capabilityText.toLowerCase();
  let bonus = 0;
  ["iso 27001", "soc 2", "pmp", "99.99", "cybersecurity", "construction", "fleet", "erp", "healthcare"].forEach((phrase) => {
    if (req.includes(phrase) && cap.includes(phrase)) bonus += 12;
  });
  return bonus;
};

export function matchRequirementToCapabilities(requirement, capabilities = [], options = {}) {
  const requirementText = requirement.requirement_text || requirement.description || requirement.title || "";
  const entityContext = [
    ...(options.entities?.deadlines || []),
    ...(options.entities?.budgets || []),
    ...(options.entities?.mandatory_clauses || []),
    options.taxonomyHint || "",
  ].join(" ");
  const reqTokens = unique(tokenize(`${requirementText} ${entityContext}`));

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
      ? `Matched ${best.matchedTerms.length} key terms against ${best.capability.domain || "capability"} evidence and certification ${best.capability.certification || "N/A"}. Entities considered: ${(options.entities?.budgets || []).concat(options.entities?.deadlines || []).slice(0, 3).join(", ") || "none"}.`
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

  // Bug 4 fix: use real pass/partial/fail counts from actual requirements
  const mandatory = requirements.filter((req) => req.requirement_type === "mandatory");
  const mandatoryPassed = mandatory.filter((req) => req.compliance_status === "pass").length;
  const mandatoryPartial = mandatory.filter((req) => req.compliance_status === "partial").length;
  const mandatoryTotal = mandatory.length;

  // compliance_score is the primary driver: based on actual pass vs total mandatory
  const complianceScore = mandatoryTotal > 0
    ? Math.round(((mandatoryPassed + mandatoryPartial * 0.5) / mandatoryTotal) * 100)
    : Math.round(historyBase.reduce((sum, bid) => sum + Number(bid.compliance_percent || 0), 0) / Math.max(1, historyBase.length)) || 70;

  // capability_match covers all requirements (mandatory + evaluation)
  const passed = requirements.filter((req) => req.compliance_status === "pass").length;
  const partial = requirements.filter((req) => req.compliance_status === "partial").length;
  const capabilityMatch = requirements.length
    ? Math.round(((passed + partial * 0.55) / requirements.length) * 100)
    : Math.min(90, Math.round((capabilities.length / 50) * 100));

  const avgHistoryScore = historyBase.length
    ? Math.round(historyBase.reduce((sum, bid) => sum + Number(bid.score_percent || 0), 0) / historyBase.length)
    : 65;

  const budgetCandidates = [rawText, ...requirements.map((req) => req.extracted_value || req.requirement_text || "")]
    .join(" ")
    .match(/(?:pkr|usd|\$|rs\.?)?\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|mn|million|bn|billion)?/gi) || [];
  const requestedBudget = budgetCandidates.map(parseBudgetAmount).find(Boolean);
  const historicalBudgets = historyBase.map((bid) => parseBudgetAmount(bid.budget)).filter(Boolean);
  const avgHistoricalBudget = historicalBudgets.length
    ? historicalBudgets.reduce((sum, value) => sum + value, 0) / historicalBudgets.length
    : null;
  const explicitBudgetAlignment = historyBase.length
    ? Math.round(historyBase.reduce((sum, bid) => sum + Number(bid.budget_alignment_score || bid.budget_alignment || 0), 0) / historyBase.length)
    : 0;
  const budgetAlignment = requestedBudget && avgHistoricalBudget
    ? Math.max(35, Math.min(100, Math.round(100 - Math.min(65, Math.abs(requestedBudget - avgHistoricalBudget) / avgHistoricalBudget * 100))))
    : explicitBudgetAlignment || 75;

  const technicalHistory = historyBase.length
    ? Math.round(historyBase.reduce((sum, bid) => sum + Number(bid.technical_score || bid.score_percent || 0), 0) / historyBase.length)
    : avgHistoryScore;
  const commercialHistory = historyBase.length
    ? Math.round(historyBase.reduce((sum, bid) => sum + Number(bid.commercial_score || bid.budget_alignment_score || budgetAlignment || 0), 0) / historyBase.length)
    : budgetAlignment;
  const riskPenalty = historyBase.length
    ? Math.round(historyBase.reduce((sum, bid) => sum + Number(bid.risk_score || bid.gaps_found || 0), 0) / historyBase.length)
    : 10;
  const strategicFit = historyBase.length
    ? Math.round(historyBase.reduce((sum, bid) => sum + Number(bid.strategic_fit_score || bid.relationship_score || 65), 0) / historyBase.length)
    : 65;

  const similarExperienceScore = Math.min(100, Math.round((capabilities.filter((cap) => cap.domain === sector).length / Math.max(1, capabilities.length)) * 220));
  const totalScore = Math.round(
    sectorWinRate * 0.2 +
    avgHistoryScore * 0.18 +
    capabilityMatch * 0.22 +
    complianceScore * 0.18 +
    budgetAlignment * 0.12 +
    technicalHistory * 0.05 +
    commercialHistory * 0.03 +
    strategicFit * 0.04 -
    Math.min(12, riskPenalty * 0.35)
  );

  const clampedTotal = Math.max(0, Math.min(100, totalScore));

  // GO/NO-GO is driven by compliance score (pass_count / total_mandatory):
  // If compliance_score >= 70 → GO, otherwise → NO-GO
  const decision = complianceScore >= 70 ? "GO" : "NO-GO";
  const decisionReasoning = decision === "GO"
    ? `Compliance is at ${complianceScore}% and the evidence profile clears the submission threshold.`
    : `Compliance is at ${complianceScore}% which is below the 70% GO threshold.`;

  return {
    sector,
    total_score: clampedTotal,
    budget_alignment: Math.round(budgetAlignment),
    capability_match: capabilityMatch,
    compliance_score: complianceScore,
    sector_win_rate: sectorWinRate,
    similar_experience_score: similarExperienceScore,
    evaluation_history_score: avgHistoryScore,
    technical_history_score: technicalHistory,
    commercial_history_score: commercialHistory,
    strategic_fit_score: strategicFit,
    risk_penalty_score: Math.min(100, riskPenalty),
    decision,
    decision_reasoning: decisionReasoning,
    // Expose raw counts for transparency in the UI
    mandatory_total: mandatoryTotal,
    mandatory_passed: mandatoryPassed,
    mandatory_partial: mandatoryPartial,
    mandatory_failed: mandatoryTotal - mandatoryPassed - mandatoryPartial,
  };
}
