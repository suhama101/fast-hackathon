import { NextResponse } from "next/server";
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

    // 1. Fetch requirements mapping completed during matching step
    const { data: requirements, error: reqError } = await supabase
      .from("rfp_requirements")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (reqError || !requirements) {
      throw new Error(`Failed to load requirements context: ${reqError?.message}`);
    }

    const totalCount = requirements.length;

    // 2. Calculate Capability Match Score (% of total requirements matched)
    // 'pass' counts as 100%, 'partial' counts as 55%, 'fail' counts as 0% for premium fidelity evaluation
    const matchedPassed = requirements.filter(r => r.compliance_status === "pass").length;
    const matchedPartial = requirements.filter(r => r.compliance_status === "partial").length;
    
    const capabilityMatch = totalCount > 0
      ? Math.min(100, Math.round(((matchedPassed + (0.55 * matchedPartial)) / totalCount) * 100))
      : 75; // Demo fallback

    // 3. Calculate Compliance Score (% of mandatory requirements passed)
    const mandatoryReqs = requirements.filter(r => r.requirement_type === "mandatory");
    const mandatoryPassedCount = mandatoryReqs.filter(r => r.compliance_status === "pass").length;
    const mandatoryPartialCount = mandatoryReqs.filter(r => r.compliance_status === "partial").length;

    const complianceScore = mandatoryReqs.length > 0
      ? Math.min(100, Math.round(((mandatoryPassedCount + (0.5 * mandatoryPartialCount)) / mandatoryReqs.length) * 100))
      : 80; // Demo fallback if no explicit mandatory elements marked

    // 4. Calculate Budget Alignment Score (configured as 1-10 demo aligned score, scaled to 0-100 to pass DB constraint)
    const budgetRawScore = 8.5; // Demo static alignment 1-10 score
    const budgetAlignment = Math.round(budgetRawScore * 10); // Normalizes check constraint [0-100]

    // 5. Calculate Total Weighted Score out of 100
    // Weighted breakdown: 40% capability, 40% compliance, 20% budget alignment
    const totalScore = Math.min(100, Math.round(
      (capabilityMatch * 0.40) +
      (complianceScore * 0.40) +
      (budgetAlignment * 0.20)
    ));

    // 6. Win threshold decision rule (if score > 70 then GO else NO-GO)
    const decision = totalScore > 70 ? "GO" : "NO-GO";

    // 7. Upsert results into Supabase win_scores table to update on conflict
    const scorePayload = {
      workspace_id: workspaceId,
      total_score: totalScore,
      budget_alignment: budgetAlignment,
      capability_match: capabilityMatch,
      compliance_score: complianceScore,
      decision: decision
    };

    const { data: savedScore, error: dbError } = await supabase
      .from("win_scores")
      .upsert(scorePayload, { onConflict: "workspace_id" })
      .select()
      .single();

    if (dbError) {
      console.error("Database upsert failed for win scores:", dbError);
      throw new Error(`Failed to log win scoring to database: ${dbError.message}`);
    }

    return NextResponse.json({
      success: true,
      workspaceId,
      scores: {
        total_score: totalScore,
        capability_match_score: capabilityMatch,
        compliance_score: complianceScore,
        budget_alignment: budgetAlignment,
        budget_alignment_raw: budgetRawScore,
        decision: decision
      },
      record: savedScore
    }, { status: 200 });

  } catch (err) {
    console.error("Error inside scoring router:", err);
    return NextResponse.json(
      { error: "Forecast win scoring error: " + err.message },
      { status: 500 }
    );
  }
}
