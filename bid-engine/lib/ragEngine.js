const DEFAULT_DIMENSIONS = 96;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "must", "shall", "will", "this", "that", "from", "have", "has",
  "are", "our", "your", "rfp", "rfq", "tender", "proposal", "bid", "response", "project",
  "requirement", "requirements", "document", "documents", "vendor", "supplier", "company",
]);

const unique = (values) => [...new Set(values)];

export const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

const hashToken = (token) => {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const normalizeVector = (vector) => {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm) return vector;
  return vector.map((value) => value / norm);
};

export const embedText = (text, dimensions = DEFAULT_DIMENSIONS) => {
  const vector = new Array(dimensions).fill(0);
  const tokens = tokenize(text);

  tokens.forEach((token) => {
    const bucket = hashToken(token) % dimensions;
    vector[bucket] += 1;
  });

  return normalizeVector(vector);
};

export const cosineSimilarity = (left = [], right = []) => {
  const size = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < size; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

const buildCapabilityDocument = (capability = {}) => [
  capability.external_id,
  capability.id,
  capability.project_name,
  capability.project_summary,
  capability.description,
  capability.domain,
  capability.client_type,
  capability.certification,
  Array.isArray(capability.certifications) ? capability.certifications.join(" ") : capability.certifications,
  Array.isArray(capability.skills) ? capability.skills.join(" ") : capability.skills,
  capability.year_completed,
  capability.contract_value,
].filter(Boolean).join(" ");

export const buildCapabilityIndex = (capabilities = []) => capabilities.map((capability) => ({
  ...capability,
  source_reference: capability.external_id || capability.id || capability.project_name || "CAPABILITY",
  vector: embedText(buildCapabilityDocument(capability)),
}));

const matchBonus = (requirementText, capabilityText) => {
  const requirement = requirementText.toLowerCase();
  const capability = capabilityText.toLowerCase();
  let bonus = 0;
  const phrases = [
    "iso 27001", "iso 9001", "soc 2", "pmp", "fda", "hipaa", "ferpa",
    "cybersecurity", "construction", "logistics", "software", "cloud", "erp",
    "data protection", "government", "tender", "rfp", "rfq",
  ];

  phrases.forEach((phrase) => {
    if (requirement.includes(phrase) && capability.includes(phrase)) {
      bonus += 0.12;
    }
  });

  return bonus;
};

const scoreCapability = (requirementText, capability) => {
  const requirementVector = embedText(requirementText);
  const capabilityVector = capability.vector || embedText(buildCapabilityDocument(capability));
  const baseScore = cosineSimilarity(requirementVector, capabilityVector);
  const reqTokens = unique(tokenize(requirementText));
  const capabilityText = buildCapabilityDocument(capability);
  const matchedTokens = reqTokens.filter((token) => capabilityText.toLowerCase().includes(token));
  const keywordScore = reqTokens.length ? matchedTokens.length / reqTokens.length : 0;
  const score = Math.min(1, baseScore * 0.6 + keywordScore * 0.4 + matchBonus(requirementText, capabilityText));

  return {
    capability,
    score,
    matchedTokens,
  };
};

export const retrieveCapabilityEvidence = (requirement, capabilities = [], options = {}) => {
  const requirementText = String(
    requirement?.requirement_text
      || requirement?.description
      || requirement?.title
      || requirement?.text
      || ""
  );
  const context = [
    ...(options.entities?.deadlines || []),
    ...(options.entities?.budgets || []),
    ...(options.entities?.mandatory_clauses || []),
    options.taxonomyHint || "",
  ].join(" ");
  const queryText = `${requirementText} ${context}`.trim();
  const ranked = capabilities
    .map((capability) => scoreCapability(queryText, capability))
    .sort((left, right) => right.score - left.score);

  const topMatches = ranked.slice(0, options.topK || 3).map((item) => ({
    source_reference: item.capability.source_reference || item.capability.external_id || item.capability.id,
    project_name: item.capability.project_name || item.capability.description || "Capability Record",
    summary: item.capability.project_summary || item.capability.description || "",
    domain: item.capability.domain || "General",
    certifications: item.capability.certifications || (item.capability.certification ? [item.capability.certification] : []),
    skills: item.capability.skills || [],
    contract_value: item.capability.contract_value || "",
    match_score: Math.round(item.score * 100),
    matched_terms: item.matchedTokens,
  }));

  const best = topMatches[0] || null;
  const confidence = best?.match_score || 0;
  const status = confidence >= 60 ? "pass" : confidence >= 35 ? "partial" : "fail";

  return {
    compliance_status: status,
    confidence_score: confidence,
    evidence: best ? `${best.source_reference}: ${best.summary}` : "No capability evidence found.",
    evidence_items: topMatches,
    reasoning: best
      ? `Retrieved ${topMatches.length} evidence record(s) from the capability library. Best match: ${best.project_name} (${best.match_score}%).`
      : "No matching evidence found in the capability library.",
    source_references: topMatches.map((item) => item.source_reference),
    matched_terms: topMatches.flatMap((item) => item.matched_terms || []),
  };
};

export const buildEvidenceContext = (evidenceItems = []) =>
  evidenceItems
    .map((item) => `${item.source_reference}: ${item.project_name} | ${item.summary}`)
    .join("\n");
