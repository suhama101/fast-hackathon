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

    // 1. Fetch requirements for this workspace to identify what questions or sections need responses
    const { data: requirements, error: reqError } = await supabase
      .from("rfp_requirements")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (reqError || !requirements) {
      throw new Error(`Failed to load workspace requirement parameters: ${reqError?.message}`);
    }

    // Identify target items. If we have Question Sections specifically, prioritize them. 
    // Otherwise, select the top mandatory/evaluation items as sections to draft responses for.
    let targets = requirements.filter(r => r.extracted_value === "Question Section");
    if (targets.length === 0) {
      targets = requirements.slice(0, 4); // Fallback: respond to the top 4 extracted requirements
    }

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No sections or requirements found to draft. Analyze the RFP first.",
        drafts: []
      });
    }

    // 2. Load the capability library for reference evidence
    const { data: capabilities, error: capError } = await supabase
      .from("capability_library")
      .select("*");

    if (capError) {
      throw new Error(`Failed to read capabilities library: ${capError.message}`);
    }

    // 3. Draft the proposal template using Groq
    const systemPrompt = "You are an expert proposal writer. Write professional, compliant proposal responses.";

    const userPrompt = `Generate a completed proposal document responding to the retrieved RFP questions/requirements.

SECTIONS TO COMPLY WITH:
${JSON.stringify(targets.map(t => ({ id: t.id, text: t.requirement_text })))}

OUR CAPABILITY LIBRARY EXCERPTS:
${JSON.stringify(capabilities.slice(0, 10).map(c => ({
  project: c.project_name,
  description: c.description,
  skills: c.skills,
  certifications: c.certifications
})))}

For each section/requirement item:
- Find the most matching capabilities from our library lists.
- Write a professional, comprehensive, and fully compliant proposal response paragraph.
- Reference specific past projects, skills, or certifications as concrete evidence of compliance.
- Keep a formal, premium, persuasive proposal writer tone.

Return a JSON object containing a "drafts" array. Format of each element:
- "section_title": exact concise heading for the response section (e.g., "Response to Security SLA")
- "content": the formatted Markdown proposal response paragraph.
- "requirement_id": corresponding id of the RFP criteria target

Return ONLY valid JSON.`;

    const aiResponse = await analyzeWithGroq(userPrompt, systemPrompt);
    const draftsList = aiResponse.drafts || [];

    // 4. Pre-clear any old drafts for this workspace to avoid duplication in multiple runs
    await supabase
      .from("proposal_drafts")
      .delete()
      .eq("workspace_id", workspaceId);

    // Prepare rows for bulk insert
    const insertRows = draftsList.map(item => ({
      workspace_id: workspaceId,
      section_title: item.section_title || "Proposal Response Section",
      content: item.content || "Response placeholder under generation.",
      status: "ai_generated"
    }));

    // 5. Save generated sections to proposal_drafts table
    if (insertRows.length > 0) {
      const { data: insertedDrafts, error: draftsError } = await supabase
        .from("proposal_drafts")
        .insert(insertRows)
        .select();

      if (draftsError) {
        throw new Error(`Failed to save AI proposal drafts to database: ${draftsError.message}`);
      }

      return NextResponse.json({
        success: true,
        workspaceId,
        drafts: insertedDrafts
      });
    }

    return NextResponse.json({
      success: true,
      workspaceId,
      drafts: []
    });

  } catch (err) {
    console.error("Proposal drafting route failure:", err);
    return NextResponse.json(
      { error: "Drafting engine encountered error: " + err.message },
      { status: 500 }
    );
  }
}
