const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalize = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dedupeByKey = (items, keyFn) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const SECTION_MARKERS = [
  /^(section|chapter|part|schedule|annex|appendix)\s+[\w.-]+[:\-\s].*/i,
  /^\d+(\.\d+)*\s+[A-Z][A-Z\s,&/-]{3,}$/i,
  /^[A-Z][A-Z\s,&/-]{6,}$/,
];

const PAGE_MARKER_REGEX = /\[\[page\s+(\d+)\]\]|\bpage\s+(\d+)\b/i;
const PAGE_MARKER_GLOBAL_REGEX = /\[\[page\s+\d+\]\]|\bpage\s+\d+\b/gi;

const BOILERPLATE_PHRASES = [
  "this rfp is only an invitation",
  "does not confer any",
  "responsible for conducting its own investigation",
  "decision of the purchaser shall be final",
  "provisions of this rfp shall prevail",
  "indicative terms for the bidders",
  "further details on the services required are provided",
  "should check the accuracy, reliability and completeness",
];

const ACTION_VERB_PATTERN = /\b(must|shall|required|required to|should|need to|may not|must not|not exceed|at least|no later than|within|provide|submit|include|attach|demonstrate|validate|undertake|deliver|comply|disclose|declare|initial|sign|register|maintain|participate|respond|quote|present|complete|attend|travel|support|monitor|manage|report|staff|recover|restore|backup|configure|deploy|secure|ensure|operate|resolve|train|document|transition|implement|perform|conduct|preserve|protect|guarantee)\b/i;
const SPECIFIC_DETAIL_PATTERN = /\b(\d+%|\d+\s*(days?|weeks?|months?)|ntn|pkr|usd|email|address|proposal validity|page limit|hard copy|soft copy|blacklist|blacklisting|conflict of interest|related party|anti[-\s]?fraud|anti[-\s]?corruption|deliverable|evaluation criteria|scoring|deadline|closing date|submission|support|reporting|staffing|recovery|continuity|backup|restore|failover|resilience|helpdesk|monitoring|sla|uptime|availability|incident response|cybersecurity|cloud|network|server)\b/i;

const COMPLETE_CLAUSE_ENDINGS = [
  /shall be$/i,
  /must be$/i,
  /should be$/i,
  /required to$/i,
  /need to$/i,
  /consist of$/i,
  /include$/i,
  /provide$/i,
  /submit$/i,
];

const SPLIT_CLAUSE_PATTERN = /(?:\s*;\s*|\.\s+|\s+(?:and|or)\s+(?=(?:provide|support|monitor|manage|maintain|report|deliver|implement|deploy|ensure|conduct|prepare|submit|include|respond|review|train|recover|restore|backup|document|configure|secure|operate|transition|staff|preserve|protect|guarantee))|,\s+(?=(?:provide|support|monitor|manage|maintain|report|deliver|implement|deploy|ensure|conduct|prepare|submit|include|respond|review|train|recover|restore|backup|document|configure|secure|operate|transition|staff|preserve|protect|guarantee)))/i;
const SPLIT_HEADLINE_CLAUSE_PATTERN = /\s+(?=(?:the|this|each|all|any|bidder|bidders|vendor|vendors|consultant|consultants|contractor|contractors|team|proposal|proposals)\b[^.]{0,180}\b(?:must|shall|required|required to|should|need to|provide|submit|include|attach|demonstrate|comply|deliver|ensure|maintain|register|disclose|declare|support|recover|restore|backup|report|present|complete|respond)\b)/i;

const FRAGMENT_ENDINGS = [
  /to the$/i,
  /to be$/i,
  /of the$/i,
  /and one$/i,
  /and the$/i,
  /or$/i,
  /with$/i,
  /by$/i,
  /in$/i,
  /on$/i,
  /at$/i,
  /for$/i,
  /from$/i,
  /of$/i,
  /the$/i,
  /a$/i,
  /an$/i,
];

const CATEGORY_RULES = [
  {
    category: "Compliance",
    priority: "Critical",
    expectedEvidenceType: "Policy Compliance",
    patterns: [/related party/i, /conflict of interest/i, /anti[-\s]?fraud/i, /anti[-\s]?corruption/i, /ethical conduct/i],
  },
  {
    category: "Legal",
    priority: "Critical",
    expectedEvidenceType: "Legal Declaration",
    patterns: [/blacklist/i, /blacklisting undertaking/i, /contract validity/i, /undertaking/i, /declaration/i],
  },
  {
    category: "Eligibility",
    priority: "Critical",
    expectedEvidenceType: "Registration Document",
    patterns: [/ntn\b/i, /tax registration/i, /secp/i, /company registration/i, /registered in pakistan/i, /local partner/i, /joint venture/i, /consortium/i, /pre[-\s]?qualification/i],
  },
  {
    category: "Financial",
    priority: "Critical",
    expectedEvidenceType: "Financial Statement",
    patterns: [/audited accounts?/i, /audited financial/i, /financial statements?/i, /tax returns?/i, /payment schedule/i, /financial proposal/i, /budget/i, /pk[r]?/i],
  },
  {
    category: "Technical",
    priority: "Important",
    expectedEvidenceType: "Methodology",
    patterns: [
      /methodology/i,
      /work plan/i,
      /activity plan/i,
      /implementation plan/i,
      /technical proposal/i,
      /project team/i,
      /similar experience/i,
      /similar projects?/i,
      /past project/i,
      /fleet management solution/i,
      /solution/i,
      /system/i,
      /platform/i,
      /deploy/i,
      /implementation team/i,
      /support services?/i,
      /training/i,
      /within\s+\d+\s*(months?|days?|weeks?)/i,
      /deliverable/i,
      /inception report/i,
      /final report/i,
      /presentation/i,
      /merchant segmentation/i,
      /payment systems?/i,
      /stakeholder engagement/i,
      /digital financial services/i,
      /experience with/i,
    ],
  },
  {
    category: "Submission",
    priority: "Important",
    expectedEvidenceType: "Policy Compliance",
    patterns: [/submission instructions?/i, /submit by/i, /email/i, /address/i, /hard copy/i, /soft copy/i, /page limit/i, /proposal validity/i, /submission deadline/i, /closing date/i, /venue/i],
  },
  {
    category: "Evaluation",
    priority: "Important",
    expectedEvidenceType: "Methodology",
    patterns: [/evaluation criteria/i, /scoring weights?/i, /marks?/i, /points?/i, /desk review/i, /presentation/i, /technical evaluation/i, /financial evaluation/i, /minimum\s+\d+\/\d+/i],
  },
  {
    category: "Deliverable",
    priority: "Important",
    expectedEvidenceType: "Work Plan",
    patterns: [/deliverable/i, /inception report/i, /phase\s*\d+\s*report/i, /final report/i, /final presentation/i],
  },
  {
    category: "Deadline",
    priority: "Critical",
    expectedEvidenceType: "Policy Compliance",
    patterns: [/submission deadline/i, /closing date/i, /deadline/i, /last date/i],
  },
];

const DEFAULT_RULE = {
  category: "Mandatory",
  priority: "Standard",
  expectedEvidenceType: "Policy Compliance",
};

const categorizeText = (text) => {
  const normalized = cleanText(text);
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return rule;
    }
  }
  return DEFAULT_RULE;
};

export const inferRequirementMetadata = (requirementText, sectionName = "", sourceText = "") => {
  const text = cleanText(`${requirementText} ${sectionName} ${sourceText}`);
  const rule = categorizeText(text);

  let needsEvidence = true;
  let expectedEvidenceType = rule.expectedEvidenceType;
  if (rule.category === "Deadline") {
    needsEvidence = false;
  }

  if (/evaluation criteria|scoring weights?|marks?|points?/i.test(text)) {
    needsEvidence = true;
  }

  if (/project team|team cv|curriculum vitae|cv\b/i.test(text)) {
    expectedEvidenceType = "Team CV";
  } else if (/methodology|work plan|activity plan|implementation plan/i.test(text)) {
    expectedEvidenceType = /work plan|activity plan/i.test(text) ? "Work Plan" : "Methodology";
  } else if (/business continuity|disaster recovery|backup|restore|failover|recovery plan|continuity plan|incident recovery|resilience/i.test(text)) {
    expectedEvidenceType = "Disaster Recovery";
  } else if (/deliverable|inception report|final report|presentation|phase\s*\d+\s*report/i.test(text)) {
    expectedEvidenceType = "Work Plan";
  } else if (/similar projects?|past project|experience with|support services?|training|fleet management solution|implementation team|solution|system|platform|deploy|merchant segmentation|payment systems?|digital financial services|stakeholder engagement/i.test(text)) {
    expectedEvidenceType = "Past Project";
  }

  if (/similar projects?|past project|experience with|project team|methodology|work plan|support services?|training|fleet management solution|implementation team/i.test(text)) {
    needsEvidence = true;
  }

  return {
    category: rule.category,
    priority: rule.priority,
    expected_evidence_type: expectedEvidenceType,
    needs_evidence: needsEvidence,
  };
};

const findSectionName = (line) => {
  if (!line) return "";
  if (SECTION_MARKERS.some((pattern) => pattern.test(line))) {
    return cleanText(line);
  }
  return "";
};

const sentenceSplit = (text) =>
  cleanText(text)
    .replace(PAGE_MARKER_GLOBAL_REGEX, "\n")
    .replace(/[\u2022\u00b7]/g, "\n")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => cleanText(line))
    .filter(Boolean);

const normalizeRequirementCandidate = (text) =>
  cleanText(text)
    .replace(PAGE_MARKER_GLOBAL_REGEX, " ")
    .replace(/^[\-\u2022*\d.\)\(]+\s*/, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([“"'\(\[])\s+/g, "$1")
    .replace(/\s+([”"'`\)\]])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const trimLeadingClauseNoise = (text) => {
  const normalized = cleanText(text).trim();
  if (!normalized) return "";

  const actionIndex = firstActionVerbIndex(normalized);
  if (actionIndex > 20 && actionIndex < 120) {
    const prefix = normalized.slice(0, actionIndex);
    if (/[,:;]\s*$/.test(prefix) || prefix.length < 45) {
      return normalized.slice(actionIndex).trim();
    }
  }

  return normalized;
};

const firstActionVerbIndex = (text) => {
  const lower = cleanText(text).toLowerCase();
  const verbs = [
    "must",
    "shall",
    "required to",
    "should",
    "need to",
    "provide",
    "submit",
    "include",
    "attach",
    "demonstrate",
    "comply",
    "deliver",
    "ensure",
    "maintain",
    "register",
    "disclose",
    "declare",
    "recover",
    "restore",
    "backup",
    "report",
    "present",
    "complete",
    "respond",
  ];
  const positions = verbs.map((verb) => lower.indexOf(verb)).filter((index) => index >= 0);
  return positions.length ? Math.min(...positions) : -1;
};

const titleCaseChunkCount = (text) =>
  (cleanText(text).match(/\b[A-Z][A-Za-z0-9/&()\-]*(?:\s+[A-Z][A-Za-z0-9/&()\-]*){1,4}\b/g) || []).length;

const isNoisyCompositeRequirement = (text) => {
  const normalized = normalizeRequirementCandidate(text);
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  if (!normalized) return true;
  if (normalized.length > 320) return true;
  if (normalized.includes("[[PAGE")) return true;
  const actionIndex = firstActionVerbIndex(normalized);
  if (tokenCount >= 18 && actionIndex > 80) return true;
  if (tokenCount >= 24 && titleCaseChunkCount(normalized) >= 4 && actionIndex > 0) return true;
  if (tokenCount >= 28 && !/[.!?;]/.test(normalized) && titleCaseChunkCount(normalized) >= 3) return true;
  return false;
};

const splitAtomicClauses = (text) =>
  sentenceSplit(text).flatMap((sentence) => {
    const trimmed = trimLeadingClauseNoise(normalizeRequirementCandidate(sentence));
    if (!trimmed) return [];
    const segments = trimmed
      .split(SPLIT_CLAUSE_PATTERN)
      .flatMap((part) => (part.length > 160 ? part.split(/,\s+/) : [part]))
      .flatMap((part) =>
        part.split(/,\s+(?=(?:the|this|each|all|any|bidder|bidders|vendor|vendors|consultant|consultants|contractor|contractors|team|proposal|proposals|document|documents|deliverable|deliverables|questions|responses|prices|payment|contract|project|assignment|services|scope|requirements)\b)/i)
      )
      .flatMap((part) => part.split(SPLIT_HEADLINE_CLAUSE_PATTERN))
      .map((part) => trimLeadingClauseNoise(normalizeRequirementCandidate(part)))
      .filter(Boolean);
    return segments.length > 1 ? segments : [trimmed];
  });

const likelyRequirement = (line) => {
  const normalized = trimLeadingClauseNoise(normalizeRequirementCandidate(line));
  if (normalized.length < 12 || normalized.length > 260) return false;
  if (BOILERPLATE_PHRASES.some((phrase) => normalized.toLowerCase().includes(phrase))) return false;
  if (COMPLETE_CLAUSE_ENDINGS.some((pattern) => pattern.test(normalized))) return false;
  if (FRAGMENT_ENDINGS.some((pattern) => pattern.test(normalized.trim()))) return false;
  if (isNoisyCompositeRequirement(normalized)) return false;

  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasActionVerb = /\b(must|shall|required|required to|should|need to|may not|must not|not exceed|at least|no later than|within|provide|submit|include|attach|demonstrate|validate|undertake|deliver|comply|disclose|declare|initial|sign|register|maintain|participate|respond|quote|present|complete|attend|travel|report|recover|restore|backup|ensure)\b/i.test(normalized);
  const hasSpecificDetail = /\b(\d+%|\d+\s*(days?|weeks?|months?)|ntn|pkr|usd|email|address|proposal validity|page limit|hard copy|soft copy|blacklist|blacklisting|conflict of interest|related party|anti[-\s]?fraud|anti[-\s]?corruption|deliverable|evaluation criteria|scoring|deadline|closing date|submission|reporting|staffing|recovery|continuity|backup|restore|failover|resilience|help desk|monitoring|sla|uptime|availability|incident response|cybersecurity|server|business continuity)\b/i.test(normalized);
  const hasRequirementSubject = /\b(bidder|bidders|vendor|vendors|consultant|consultants|contractor|contractors|firm|firms|company|proposal|technical proposal|financial proposal|document|documents|deliverable|deliverables|budget|invoice|team|member|members|applicant|applicants|consortium|joint venture|jv|schedule|response|report|work plan|methodology|payment|pricing|price|solution|service|services)\b/i.test(normalized);

  if (/^[a-z]/.test(normalized.trim()) && !hasActionVerb && !hasSpecificDetail) return false;
  if (!hasRequirementSubject && !/^(provide|submit|include|attach|ensure|comply|disclose|declare|prepare|maintain|respond|review|deliver|present)/i.test(normalized)) return false;

  return tokenCount >= 4 && (hasActionVerb || hasSpecificDetail);
};

const requirementSpecificityScore = (line) => {
  const text = cleanText(line);
  let score = 0;
  if (ACTION_VERB_PATTERN.test(text)) score += 3;
  if (SPECIFIC_DETAIL_PATTERN.test(text)) score += 3;
  if (/\b(eligibility|submission|technical proposal|financial proposal|evaluation criteria|scoring|deliverables|payment schedule|consortium|jv|legal|declaration|compliance|vendor|qualification|support|reporting|staffing|recovery|continuity|backup|restore|failover|helpdesk|monitoring|sla)\b/i.test(text)) score += 2;
  if (BOILERPLATE_PHRASES.some((phrase) => text.toLowerCase().includes(phrase))) score -= 4;
  if (text.split(/\s+/).filter(Boolean).length < 6) score -= 1;
  return score;
};

const createRequirement = ({ line, sectionName, pageNumber, sourceText, categoryHint }) => {
  const metadata = inferRequirementMetadata(line, sectionName, line);
  const combinedCategory = categoryHint || metadata.category;
  return {
    requirement: line,
    category: combinedCategory,
    priority: metadata.priority,
    source_section: sectionName || "Unknown Section",
    source_page: pageNumber || null,
    source_text: sourceText || line,
    needs_evidence: metadata.needs_evidence,
    expected_evidence_type: metadata.expected_evidence_type,
  };
};

export function extractSectionAwareRequirements(rawText = "") {
  const text = cleanText(rawText);
  if (!text) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean);

  const results = [];
  let currentSection = "Unknown Section";
  let currentPage = null;
  let sourceBuffer = [];

  const flushBuffer = () => {
    const joined = sourceBuffer.join(" ");
    splitAtomicClauses(joined).forEach((sentence) => {
      if (likelyRequirement(sentence)) {
        results.push(createRequirement({
          line: sentence,
          sectionName: currentSection,
          pageNumber: currentPage,
          sourceText: joined,
        }));
      }
    });
    sourceBuffer = [];
  };

  lines.forEach((line) => {
    const pageMatch = line.match(PAGE_MARKER_REGEX);
    if (pageMatch) {
      currentPage = Number(pageMatch[1] || pageMatch[2]);
      return;
    }

    const sectionName = findSectionName(line);
    if (sectionName) {
      flushBuffer();
      currentSection = sectionName;
      return;
    }

    if (/^[\-\u2022*]\s*/.test(line) || likelyRequirement(line)) {
      sourceBuffer.push(line.replace(/^[\-\u2022*]\s*/, ""));
      if (line.endsWith(":")) return;
      flushBuffer();
      return;
    }

    sourceBuffer.push(line);
    if (sourceBuffer.length > 3) {
      flushBuffer();
    }
  });

  flushBuffer();

  if (results.length < 20) {
    splitAtomicClauses(text).forEach((sentence) => {
      if (likelyRequirement(sentence)) {
        results.push(createRequirement({
          line: sentence,
          sectionName: "Global Text Scan",
          pageNumber: null,
          sourceText: sentence,
        }));
      }
    });
  }

  const keywordClauses = [
    ["related party", "Comply with related party disclosure requirements."],
    ["conflict of interest", "Submit a conflict of interest declaration."],
    ["anti-fraud", "Comply with anti-fraud and corruption requirements."],
    ["blacklist", "Provide a blacklisting undertaking."],
    ["ntn", "Provide valid NTN and tax registration documents."],
    ["company registration", "Provide company registration certificate."],
    ["local partner", "Engage a local partner or local registered entity."],
    ["proposal validity", "Maintain proposal validity for the required period."],
    ["technical proposal", "Technical proposal must follow the prescribed submission structure."],
    ["financial proposal", "Financial proposal must follow the required commercial format."],
    ["payment schedule", "Comply with the required payment schedule."],
    ["deliverable", "Provide all stated deliverables on time."],
  ];

  keywordClauses.forEach(([needle, requirement]) => {
    if (text.toLowerCase().includes(needle)) {
      results.push(createRequirement({
        line: requirement,
        sectionName: "Heuristic Extraction",
        pageNumber: null,
        sourceText: text,
      }));
    }
  });

  return dedupeByKey(
    results
      .map((item) => ({
        ...item,
        _score: requirementSpecificityScore(item.requirement),
      }))
      .filter((item) => item._score >= 2)
      .sort((left, right) => right._score - left._score || right.requirement.length - left.requirement.length)
      .slice(0, 60),
    (item) => normalize(item.requirement)
  ).map(({ _score, ...item }) => item);
}

const FIELD_RULES = {
  mandatory_requirements: { category: "Mandatory", priority: "Critical", source_section: "LLM Mandatory Requirements", expected_evidence_type: "Policy Compliance" },
  eligibility_criteria: { category: "Eligibility", priority: "Critical", source_section: "LLM Eligibility Criteria", expected_evidence_type: "Registration Document" },
  prequalification_criteria: { category: "Eligibility", priority: "Critical", source_section: "LLM Pre-Qualification Criteria", expected_evidence_type: "Registration Document" },
  required_documents: { category: "Eligibility", priority: "Critical", source_section: "LLM Required Documents", expected_evidence_type: "Registration Document" },
  technical_requirements: { category: "Technical", priority: "Important", source_section: "LLM Technical Requirements", expected_evidence_type: "Methodology" },
  technical_proposal_requirements: { category: "Technical", priority: "Important", source_section: "LLM Technical Proposal Requirements", expected_evidence_type: "Methodology" },
  financial_requirements: { category: "Financial", priority: "Important", source_section: "LLM Financial Requirements", expected_evidence_type: "Financial Statement" },
  financial_proposal_requirements: { category: "Financial", priority: "Important", source_section: "LLM Financial Proposal Requirements", expected_evidence_type: "Financial Statement" },
  deadlines: { category: "Deadline", priority: "Critical", source_section: "LLM Deadlines", expected_evidence_type: "Policy Compliance" },
  submission_instructions: { category: "Submission", priority: "Critical", source_section: "LLM Submission Instructions", expected_evidence_type: "Policy Compliance" },
  evaluation_criteria: { category: "Evaluation", priority: "Important", source_section: "LLM Evaluation Criteria", expected_evidence_type: "Methodology" },
  scoring_weights: { category: "Evaluation", priority: "Important", source_section: "LLM Scoring Weights", expected_evidence_type: "Methodology" },
  deliverables: { category: "Deliverable", priority: "Important", source_section: "LLM Deliverables", expected_evidence_type: "Work Plan" },
  payment_schedule: { category: "Financial", priority: "Important", source_section: "LLM Payment Schedule", expected_evidence_type: "Financial Statement" },
  contract_validity: { category: "Legal", priority: "Important", source_section: "LLM Contract Validity", expected_evidence_type: "Policy Compliance" },
  proposal_validity: { category: "Submission", priority: "Important", source_section: "LLM Proposal Validity", expected_evidence_type: "Policy Compliance" },
  consortium_requirements: { category: "Eligibility", priority: "Critical", source_section: "LLM Consortium Requirements", expected_evidence_type: "Policy Compliance" },
  conflict_of_interest_requirements: { category: "Compliance", priority: "Critical", source_section: "LLM Conflict of Interest", expected_evidence_type: "Legal Declaration" },
  related_party_disclosure_requirements: { category: "Compliance", priority: "Critical", source_section: "LLM Related Party Disclosure", expected_evidence_type: "Legal Declaration" },
  anti_fraud_corruption_requirements: { category: "Compliance", priority: "Critical", source_section: "LLM Anti-Fraud / Corruption", expected_evidence_type: "Legal Declaration" },
  blacklisting_undertaking: { category: "Legal", priority: "Critical", source_section: "LLM Blacklisting Undertaking", expected_evidence_type: "Legal Declaration" },
  ntn_tax_registration_requirements: { category: "Eligibility", priority: "Critical", source_section: "LLM NTN / Tax Registration", expected_evidence_type: "Tax Document" },
  local_partner_requirements: { category: "Eligibility", priority: "Critical", source_section: "LLM Local Partner Requirements", expected_evidence_type: "Registration Document" },
  page_limits: { category: "Submission", priority: "Important", source_section: "LLM Page Limits", expected_evidence_type: "Policy Compliance" },
  hard_copy_submission_rules: { category: "Submission", priority: "Important", source_section: "LLM Hard Copy Submission Rules", expected_evidence_type: "Policy Compliance" },
  soft_copy_submission_rules: { category: "Submission", priority: "Important", source_section: "LLM Soft Copy Submission Rules", expected_evidence_type: "Policy Compliance" },
  submission_details: { category: "Submission", priority: "Important", source_section: "LLM Submission Details", expected_evidence_type: "Policy Compliance" },
  questions_to_answer: { category: "Evaluation", priority: "Important", source_section: "LLM Questions to Answer", expected_evidence_type: "Methodology" },
  question_answer_sections: { category: "Evaluation", priority: "Important", source_section: "LLM Question Answer Sections", expected_evidence_type: "Methodology" },
  compliance_clauses: { category: "Compliance", priority: "Critical", source_section: "LLM Compliance Clauses", expected_evidence_type: "Policy Compliance" },
};

export function flattenModelRequirements(extractedData = {}) {
  const rows = [];

  Object.entries(FIELD_RULES).forEach(([fieldName, defaults]) => {
    const values = extractedData[fieldName];
    if (!Array.isArray(values)) return;

    values.forEach((value) => {
      const requirement = typeof value === "string" ? value : cleanText(value?.requirement || value?.text || value?.description || value?.label || "");
      if (!requirement) return;

      const metadata = inferRequirementMetadata(requirement, defaults.source_section, requirement);
      rows.push({
        requirement,
        category: defaults.category || metadata.category,
        priority: defaults.priority || metadata.priority,
        source_section: defaults.source_section,
        source_page: value?.source_page || null,
        source_text: value?.source_text || requirement,
        needs_evidence: metadata.needs_evidence,
        expected_evidence_type: defaults.expected_evidence_type || metadata.expected_evidence_type,
      });
    });
  });

  if (Array.isArray(extractedData.evaluation_criteria)) {
    extractedData.evaluation_criteria.forEach((value) => {
      const requirement = typeof value === "string" ? value : cleanText(value?.criteria_name || value?.text || value?.description || "");
      if (!requirement) return;
      rows.push({
        requirement,
        category: "Evaluation",
        priority: "Important",
        source_section: "LLM Evaluation Criteria",
        source_page: value?.source_page || null,
        source_text: value?.source_text || requirement,
        needs_evidence: true,
        expected_evidence_type: "Methodology",
      });
    });
  }

  return dedupeByKey(rows, (item) => normalize(item.requirement));
}

export function mergeRequirementCandidates(...groups) {
  const rows = groups.flat().filter(Boolean).map((item) => {
    const requirement = cleanText(item.requirement || item.requirement_text || item.text || item.description || "");
    if (!requirement) return null;
    const metadata = inferRequirementMetadata(requirement, item.source_section, item.source_text);
    return {
      requirement,
      category: item.category || metadata.category,
      priority: item.priority || metadata.priority,
      source_section: item.source_section || "Unknown Section",
      source_page: item.source_page || null,
      source_text: item.source_text || requirement,
      needs_evidence: item.needs_evidence ?? metadata.needs_evidence,
      expected_evidence_type: item.expected_evidence_type || metadata.expected_evidence_type,
    };
  }).filter(Boolean);

  return dedupeByKey(rows, (item) => normalize(item.requirement));
}

export function toDbRequirementType(category = "") {
  const normalized = normalize(category);
  if (normalized === "deadline") return "deadline";
  if (normalized === "evaluation") return "evaluation";
  return "mandatory";
}

export function buildRequirementId(index = 0) {
  return `REQ-${String(index + 1).padStart(3, "0")}`;
}

export function createDiagnostics(requirements = [], matches = []) {
  const categoryCounts = requirements.reduce((accumulator, requirement) => {
    const key = requirement.category || "Unknown";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const matchMap = new Map(matches.map((match) => [match.requirement_id, match]));
  const enriched = requirements.map((requirement) => {
    const match = matchMap.get(requirement.id) || {};
    return {
      ...requirement,
      match_status: match.match_status || (match.compliance_status === "pass" ? "Strong Match" : match.compliance_status === "partial" ? "Partial Match" : "No Match"),
      match_score: Number(match.match_score || match.confidence_score || 0) / 100,
      evidence_type: match.evidence_type || requirement.expected_evidence_type || "",
      matched_evidence: match.matched_evidence || match.evidence || "",
    };
  });

  const averageScore = enriched.length
    ? enriched.reduce((sum, item) => sum + Number(item.match_score || 0), 0) / enriched.length
    : 0;

  return {
    total_requirements: requirements.length,
    category_counts: categoryCounts,
    strong_matches: enriched.filter((item) => item.match_status === "Strong Match"),
    partial_matches: enriched.filter((item) => item.match_status === "Partial Match"),
    no_matches: enriched.filter((item) => item.match_status === "No Match"),
    average_match_score: averageScore,
    low_confidence_matches: enriched.filter((item) => Number(item.match_score || 0) > 0 && Number(item.match_score || 0) < 0.6),
    no_evidence_requirements: enriched.filter((item) => item.match_status === "No Match"),
  };
}
