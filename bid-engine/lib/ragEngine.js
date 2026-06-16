import { inferRequirementMetadata } from "./intelligence.js";

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
  capability.certification_name,
  Array.isArray(capability.certifications) ? capability.certifications.join(" ") : capability.certifications,
  Array.isArray(capability.skills) ? capability.skills.join(" ") : capability.skills,
  Array.isArray(capability.keywords) ? capability.keywords.join(" ") : capability.keywords,
  capability.year_completed,
  capability.contract_value,
].filter(Boolean).join(" ");

const inferCapabilityEvidenceTypes = (capability = {}) => {
  const text = buildCapabilityDocument(capability).toLowerCase();
  const evidenceTypes = new Set(["Past Project"]);

  if (/\bcv\b|curriculum vitae|team profile|resource profile/.test(text)) evidenceTypes.add("Team CV");
  if (/methodology|approach|implementation plan|delivery plan/.test(text)) evidenceTypes.add("Methodology");
  if (/work plan|project schedule|timeline|activity plan/.test(text)) evidenceTypes.add("Work Plan");
  if (/certificate|certified|certification/.test(text)) evidenceTypes.add("Certification");
  if (/legal declaration|disclosure|undertaking/.test(text)) evidenceTypes.add("Legal Declaration");
  if (/financial statement|audit report|audited account|balance sheet/.test(text)) evidenceTypes.add("Financial Statement");
  if (/tax registration|ntn|tax certificate/.test(text)) evidenceTypes.add("Tax Document");
  if (/registration certificate|incorporation|secp/.test(text)) evidenceTypes.add("Registration Document");
  if (/policy compliance|compliance policy|code of conduct|anti fraud|anti corruption|conflict of interest|related party/.test(text)) evidenceTypes.add("Policy Compliance");

  return [...evidenceTypes];
};

const inferCapabilityMetadata = (capability = {}) => {
  const text = buildCapabilityDocument(capability);
  const keywords = unique(tokenize(text)).slice(0, 24);
  const certificationName = Array.isArray(capability.certifications) && capability.certifications.length
    ? capability.certifications[0]
    : capability.certification || capability.certification_name || "";
  return {
    ...capability,
    sector: capability.sector || capability.client_type || capability.domain || "General",
    domain: capability.domain || capability.client_type || "General",
    year: capability.year_completed || capability.year || null,
    certification_name: certificationName || "",
    keywords,
    evidence_type: capability.evidence_type || inferCapabilityEvidenceTypes(capability)[0] || "Past Project",
    evidence_types: capability.evidence_types || inferCapabilityEvidenceTypes(capability),
  };
};

const matchBonus = (requirementText, capabilityText) => {
  const requirement = requirementText.toLowerCase();
  const capability = capabilityText.toLowerCase();
  let bonus = 0;
  const phrases = [
    "iso 27001", "iso 9001", "soc 2", "pmp", "fda", "hipaa", "ferpa",
    "cybersecurity", "construction", "logistics", "software", "cloud", "erp",
    "data protection", "government", "tender", "rfp", "rfq", "payment systems",
    "digital financial services", "merchant segmentation", "stakeholder engagement",
  ];

  phrases.forEach((phrase) => {
    if (requirement.includes(phrase) && capability.includes(phrase)) {
      bonus += 0.08;
    }
  });

  return bonus;
};

const evidenceTypeCompatibility = (expectedType, capabilityTypes = []) => {
  if (!expectedType) return 0.5;
  const normalized = String(expectedType).toLowerCase();
  const types = capabilityTypes.map((item) => String(item).toLowerCase());

  if (types.some((item) => item === normalized)) return 1;

  const synonyms = {
    "policy compliance": ["legal declaration", "disclosure", "undertaking"],
    "legal declaration": ["policy compliance", "disclosure", "undertaking"],
    "registration document": ["registration document", "tax document", "legal declaration"],
    "tax document": ["tax document", "registration document"],
    "financial statement": ["financial statement"],
    "past project": ["past project"],
    "team cv": ["team cv"],
    methodology: ["methodology", "work plan"],
    "work plan": ["work plan", "methodology"],
  };

  const allowed = synonyms[normalized] || [];
  if (types.some((item) => allowed.includes(item))) return 0.75;
  return 0;
};

const scoreCapability = (requirementText, requirementMeta, capability) => {
  const capabilityText = buildCapabilityDocument(capability).toLowerCase();
  const requirementVector = embedText(requirementText);
  const capabilityVector = capability.vector || embedText(capabilityText);
  const vectorScore = cosineSimilarity(requirementVector, capabilityVector);
  const reqTokens = unique(tokenize(requirementText));
  const capabilityTokens = new Set(tokenize(capabilityText));
  const matchedTokens = reqTokens.filter((token) => capabilityTokens.has(token));
  const keywordScore = reqTokens.length ? matchedTokens.length / reqTokens.length : 0;
  const typeScore = evidenceTypeCompatibility(requirementMeta.expected_evidence_type, capability.evidence_types);
  const sectorMatch = requirementMeta.category === "Technical" && /project|experience|methodology|work plan/.test(capabilityText) ? 0.05 : 0;

  const score = Math.max(
    0,
    Math.min(1,
      vectorScore * 0.38 +
      keywordScore * 0.32 +
      typeScore * 0.25 +
      sectorMatch +
      matchBonus(requirementText, capabilityText)
    )
  );

  return {
    capability,
    score,
    vectorScore,
    keywordScore,
    typeScore,
    matchedTokens,
  };
};

const buildEvidenceStatus = (score, typeScore, keywordScore, matchedTokens = []) => {
  if (score >= 0.8 && typeScore >= 0.75 && keywordScore >= 0.2 && matchedTokens.length >= 2) return "Strong Match";
  if (score >= 0.2 && score < 0.8 && typeScore > 0 && (keywordScore >= 0.02 || matchedTokens.length >= 1)) return "Partial Match";
  return "No Match";
};

export const buildCapabilityIndex = (capabilities = []) => capabilities.map((capability) => {
  const enriched = inferCapabilityMetadata(capability);
  return {
    ...enriched,
    source_reference: capability.external_id || capability.id || capability.project_name || "CAPABILITY",
    vector: embedText(buildCapabilityDocument(enriched)),
  };
});

export const retrieveCapabilityEvidence = (requirement, capabilities = [], options = {}) => {
  const requirementText = String(
    requirement?.requirement_text
      || requirement?.requirement
      || requirement?.description
      || requirement?.title
      || requirement?.text
      || ""
  );
  const requirementMeta = inferRequirementMetadata(
    requirementText,
    requirement?.source_section || "",
    requirement?.source_text || ""
  );
  const queryText = [
    requirementText,
    requirement?.source_section || "",
    requirementMeta.category,
    requirementMeta.expected_evidence_type,
    ...(options.entities?.deadlines || []),
    ...(options.entities?.budgets || []),
    ...(options.entities?.mandatory_clauses || []),
  ].join(" ").trim();

  const filteredCapabilities = capabilities.filter((capability) => {
    const capabilityTypes = capability.evidence_types || [capability.evidence_type || "Past Project"];
    const typeScore = evidenceTypeCompatibility(requirementMeta.expected_evidence_type, capabilityTypes);
    return typeScore > 0;
  });

  if (!filteredCapabilities.length) {
    return {
      compliance_status: "fail",
      match_status: "No Match",
      confidence_score: 0,
      match_score: 0,
      evidence_type: requirementMeta.expected_evidence_type,
      matched_evidence: "No strong matching evidence found",
      evidence: "No strong matching evidence found",
      reason: "No capability record matched the expected evidence type for this requirement.",
      source: "",
      evidence_items: [],
      source_references: [],
      matched_terms: [],
      requirement_category: requirementMeta.category,
      expected_evidence_type: requirementMeta.expected_evidence_type,
    };
  }

  const ranked = filteredCapabilities
    .map((capability) => scoreCapability(queryText, requirementMeta, capability))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0] || null;
  const matchStatus = best ? buildEvidenceStatus(best.score, best.typeScore, best.keywordScore, best.matchedTokens) : "No Match";
  const confidence = best ? Math.round(best.score * 100) : 0;

  if (!best || matchStatus === "No Match") {
    return {
      compliance_status: "fail",
      match_status: "No Match",
      confidence_score: confidence,
      match_score: best ? best.score : 0,
      evidence_type: requirementMeta.expected_evidence_type,
      matched_evidence: "No strong matching evidence found",
      evidence: "No strong matching evidence found",
      reason: "No capability record met the evidence-type and similarity threshold for this requirement.",
      source: "",
      evidence_items: [],
      source_references: [],
      matched_terms: [],
      requirement_category: requirementMeta.category,
      expected_evidence_type: requirementMeta.expected_evidence_type,
    };
  }

  const matchReason = matchStatus === "Strong Match"
    ? `Direct evidence alignment (${best.typeScore.toFixed(2)}) with meaningful keyword overlap (${best.keywordScore.toFixed(2)}).`
    : `Evidence is related but not definitive. The match is indirect and does not fully prove the requirement.`;

  return {
    compliance_status: matchStatus === "Strong Match" ? "pass" : "partial",
    match_status: matchStatus,
    confidence_score: confidence,
    match_score: best.score,
    evidence_type: best.capability.evidence_type || requirementMeta.expected_evidence_type,
    matched_evidence: `${best.capability.source_reference}: ${best.capability.project_summary || best.capability.description || best.capability.project_name}`,
    evidence: `${best.capability.source_reference}: ${best.capability.project_summary || best.capability.description || best.capability.project_name}`,
    reason: `${matchReason} Best source: ${best.capability.project_name || best.capability.description || "Capability record"}.`,
    source: best.capability.project_name || best.capability.description || best.capability.source_reference || "",
    evidence_items: ranked.slice(0, options.topK || 3).map((item) => ({
      source_reference: item.capability.source_reference,
      project_name: item.capability.project_name || item.capability.description || "Capability Record",
      summary: item.capability.project_summary || item.capability.description || "",
      evidence_type: item.capability.evidence_type || "Past Project",
      match_score: Math.round(item.score * 100),
      matched_terms: item.matchedTokens,
      domain: item.capability.domain || "General",
      sector: item.capability.sector || item.capability.domain || "General",
      year: item.capability.year || item.capability.year_completed || null,
      certification_name: item.capability.certification_name || item.capability.certification || "",
      keywords: item.capability.keywords || [],
    })),
    source_references: ranked.slice(0, options.topK || 3).map((item) => item.capability.source_reference),
    matched_terms: best.matchedTokens,
    requirement_category: requirementMeta.category,
    expected_evidence_type: requirementMeta.expected_evidence_type,
  };
};

export const buildEvidenceContext = (evidenceItems = []) =>
  evidenceItems
    .map((item) => `${item.source_reference}: ${item.project_name} | ${item.summary}`)
    .join("\n");
