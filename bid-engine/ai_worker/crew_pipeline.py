import json
import os
import re
import sys

from crewai import Agent, Crew, LLM, Process, Task

GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
CREWAI_MODEL = os.getenv("CREWAI_MODEL", "llama-3.3-70b-versatile")


def read_payload():
  try:
    raw = sys.stdin.read()
    return json.loads(raw) if raw else {}
  except Exception:
    return {}


def write_output(payload):
  sys.stdout.write(json.dumps(payload, ensure_ascii=False))
  sys.stdout.flush()


def groq_llm():
  return LLM(
    model=CREWAI_MODEL,
    api_key=GROQ_API_KEY,
    base_url=GROQ_BASE_URL,
    temperature=0,
  )


def json_from_text(value):
  if isinstance(value, dict):
    return value
  text = str(value or "")
  try:
    return json.loads(text)
  except Exception:
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
      try:
        return json.loads(match.group(0))
      except Exception:
        return {}
  return {}


def build_requirement_agent():
  return Agent(
    role="Requirement Extraction Agent",
    goal="Extract, classify, and normalize procurement requirements into structured JSON.",
    backstory=(
      "You are an expert procurement analyst who converts noisy RFP text into short, "
      "actionable, evidence-ready requirement records."
    ),
    verbose=False,
    allow_delegation=False,
    llm=groq_llm(),
  )


def build_evidence_agent():
  return Agent(
    role="Evidence Matching Agent",
    goal="Validate candidate evidence and reject weak or irrelevant evidence.",
    backstory=(
      "You are strict about supportability. If the evidence does not actually support the "
      "requirement, reject it."
    ),
    verbose=False,
    allow_delegation=False,
    llm=groq_llm(),
  )


def build_compliance_agent():
  return Agent(
    role="Compliance Agent",
    goal="Classify each requirement as compliant, partially compliant, non-compliant, or blocker.",
    backstory=(
      "You are a procurement compliance auditor who only approves evidence-backed responses."
    ),
    verbose=False,
    allow_delegation=False,
    llm=groq_llm(),
  )


def build_writer_agent():
  return Agent(
    role="Proposal Writer Agent",
    goal="Write proposal sections using only approved evidence and no hallucinations.",
    backstory=(
      "You are a proposal writer constrained by procurement rules. You never invent evidence."
    ),
    verbose=False,
    allow_delegation=False,
    llm=groq_llm(),
  )


def build_reviewer_agent():
  return Agent(
    role="Reviewer Agent",
    goal="Audit the draft, find unsupported claims, and produce an improved proposal if possible.",
    backstory="You are a red-team reviewer focused on unsupported claims and missing documents.",
    verbose=False,
    allow_delegation=False,
    llm=groq_llm(),
  )


def build_strategy_agent():
  return Agent(
    role="Bid Strategy Agent",
    goal="Produce a GO/NO-GO decision, strategic recommendation, and win-probability rationale.",
    backstory="You are a bid strategist who makes conservative, evidence-backed recommendations.",
    verbose=False,
    allow_delegation=False,
    llm=groq_llm(),
  )


def run_extract(payload):
  raw_text = str(payload.get("raw_text") or payload.get("rawText") or "")
  agent = build_requirement_agent()
  task = Task(
    description=(
      "Extract procurement requirements from the provided RFP text.\n"
      "Return JSON only with arrays for mandatory_requirements, eligibility_criteria, "
      "prequalification_criteria, required_documents, technical_requirements, "
      "technical_proposal_requirements, financial_requirements, financial_proposal_requirements, "
      "evaluation_criteria, scoring_weights, questions_to_answer, question_answer_sections, "
      "deliverables, payment_schedule, contract_validity, proposal_validity, consortium_requirements, "
      "conflict_of_interest_requirements, related_party_disclosure_requirements, "
      "anti_fraud_corruption_requirements, blacklisting_undertaking, ntn_tax_registration_requirements, "
      "local_partner_requirements, submission_instructions, page_limits, hard_copy_submission_rules, "
      "soft_copy_submission_rules, submission_details, deadlines, compliance_clauses.\n"
      "Each item must be short, specific, and evidence-ready."
    ),
    agent=agent,
    expected_output="Valid JSON only.",
  )
  crew = Crew(agents=[agent], tasks=[task], process=Process.sequential, verbose=False)
  result = crew.kickoff(inputs={"raw_text": raw_text})
  return json_from_text(getattr(result, "raw", result))


def run_draft(payload):
  requirements = payload.get("requirements") or []
  evidence = payload.get("approved_evidence") or payload.get("evidence") or []
  draft_targets = payload.get("draft_targets") or []
  agent_match = build_evidence_agent()
  agent_compliance = build_compliance_agent()
  agent_writer = build_writer_agent()

  task_match = Task(
    description=(
      "Review the retrieved evidence and reject any weak evidence that does not actually support "
      "the requirement. Return JSON with approved_evidence and rejected_evidence."
    ),
    agent=agent_match,
    expected_output="Valid JSON only.",
  )
  task_compliance = Task(
    description=(
      "Classify each requirement using only the approved evidence from the previous task. "
      "Return JSON with compliance results."
    ),
    agent=agent_compliance,
    expected_output="Valid JSON only.",
  )
  task_writer = Task(
    description=(
      "Write the proposal sections using only approved evidence and compliance outcomes. "
      "If no verified supporting evidence exists, write 'No verified supporting evidence available.' "
      "for that section. Return JSON with a drafts array."
    ),
    agent=agent_writer,
    expected_output="Valid JSON only.",
  )
  crew = Crew(
    agents=[agent_match, agent_compliance, agent_writer],
    tasks=[task_match, task_compliance, task_writer],
    process=Process.sequential,
    verbose=False,
  )
  result = crew.kickoff(inputs={
    "requirements": requirements,
    "evidence": evidence,
    "draft_targets": draft_targets,
    "workspace_title": payload.get("workspace_title") or payload.get("workspaceTitle") or "RFP Proposal",
    "tone": payload.get("tone") or "Professional and compliant",
  })
  return json_from_text(getattr(result, "raw", result))


def run_review(payload):
  agent = build_reviewer_agent()
  task = Task(
    description=(
      "Review the proposal drafts, identify unsupported claims, vague language, missing compliance "
      "points, weak sections, and formatting issues. Return JSON only."
    ),
    agent=agent,
    expected_output="Valid JSON only.",
  )
  crew = Crew(agents=[agent], tasks=[task], process=Process.sequential, verbose=False)
  result = crew.kickoff(inputs=payload)
  return json_from_text(getattr(result, "raw", result))


def run_strategy(payload):
  agent = build_strategy_agent()
  task = Task(
    description=(
      "Given the compliance status, evidence traceability, and win score context, output JSON with "
      "GO or NO-GO, win_probability, recommendations, and rationale."
    ),
    agent=agent,
    expected_output="Valid JSON only.",
  )
  crew = Crew(agents=[agent], tasks=[task], process=Process.sequential, verbose=False)
  result = crew.kickoff(inputs=payload)
  return json_from_text(getattr(result, "raw", result))


def main():
  if len(sys.argv) < 2:
    write_output({"error": "missing stage"})
    sys.exit(1)

  stage = sys.argv[1]
  payload = read_payload()

  try:
    if stage == "extract":
      write_output(run_extract(payload))
    elif stage == "draft":
      write_output(run_draft(payload))
    elif stage == "review":
      write_output(run_review(payload))
    elif stage == "strategy":
      write_output(run_strategy(payload))
    else:
      write_output({"error": f"unknown stage: {stage}"})
      sys.exit(1)
  except Exception as error:
    write_output({"error": str(error), "stage": stage})
    sys.exit(1)


if __name__ == "__main__":
  main()
