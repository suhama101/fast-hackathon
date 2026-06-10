import { NextResponse } from "next/server";
import { analyzeWithGroq } from "../../../../lib/groqClient";
import { getSupabaseAdmin } from "../../../../lib/supabaseClient";

export async function POST(request) {
  try {
    const { workspaceId } = await request.json();

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Missing required workspaceId parameter." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Load active RFP requirements for this workspace
    const { data: requirements, error: reqError } = await supabase
      .from("rfp_requirements")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (reqError || !requirements) {
      throw new Error(`Failed to load requirements from database: ${reqError?.message}`);
    }

    if (requirements.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No requirements found for this workspace. Run extraction first.",
        matches: []
      });
    }

    // 2. Load the capability library from Supabase
    const { data: capabilities, error: capError } = await supabase
      .from("capability_library")
      .select("*");

    if (capError) {
      throw new Error(`Failed to read capabilities library: ${capError.message}`);
    }

    // 3. Compile matching context for Groq
    const systemPrompt = "You are an expert enterprise bid evaluator. Perform a precise analysis comparing requirements against operational capabilities in JSON format.";
    
    const userPrompt = `Compare these RFP requirements with our Organization's Capability Library. Determine if each requirement has sufficient evidence of capability.

REQUIREMENTS:
${JSON.stringify(requirements.map(r => ({ id: r.id, text: r.requirement_text, type: r.requirement_type })))}

ORGANIZATION CAPABILITY LIBRARY:
${JSON.stringify(capabilities.map(c => ({
  project: c.project_name,
  description: c.description,
  skills: c.skills,
  certifications: c.certifications,
  contract_value: c.contract_value
})))}

Output a JSON object with a single property "matches" containing a list of objects. Each object MUST contain:
- "requirement_id": corresponding requirement id from the list
- "compliance_status": must be either "pass", "fail", or "partial" (be strict: only mark "pass" if there is clear, direct evidence of compliance)
- "reasoning": detailed reason for this rating
- "evidence": specific client, project, or certification identified as supporting proof/evidence

Return ONLY a valid JSON object structure.`;

    // Invoke Llama 3 API for mapping compliance
    const aiResponse = await analyzeWithGroq(userPrompt, systemPrompt);
    const matchesList = aiResponse.matches || [];

    // 4. Group matches and update values inside Supabase
    const updatePromises = matchesList.map(async (match) => {
      const { requirement_id, compliance_status } = match;
      if (!requirement_id) return;

      // Validate status
      const cleanStatus = ["pass", "fail", "partial"].includes(compliance_status)
        ? compliance_status
        : "partial";

      return supabase
        .from("rfp_requirements")
        .update({
          compliance_status: cleanStatus,
          extracted_value: match.evidence || "Mapped via AI"
        })
        .eq("id", requirement_id)
        .eq("workspace_id", workspaceId);
    });

    await Promise.all(updatePromises);

    // Fetch the updated requirements list to return fresh data
    const { data: refreshedRequirements } = await supabase
      .from("rfp_requirements")
      .select("*")
      .eq("workspace_id", workspaceId);

    return NextResponse.json({
      success: true,
      workspaceId,
      matches: matchesList,
      requirements: refreshedRequirements || requirements
    });

  } catch (err) {
    console.error("Failure in matching route:", err);
    return NextResponse.json(
      { error: "Matching system encountered error: " + err.message },
      { status: 500 }
    );
  }
}
