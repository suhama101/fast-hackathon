import { CAPABILITY_LIBRARY } from "../../bid-engine/lib/sampleData.js";
import { matchRequirementToCapabilities, extractEntitiesFromText } from "../../bid-engine/lib/datasetAnalysis.js";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "../_lib/requestAuth.js";
import { getSupabaseAdminOrNull } from "../_lib/supabase.js";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const readBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
};

const getQueryValue = (req, key) => {
  if (req.query && req.query[key] !== undefined) return req.query[key];
  try {
    const url = new URL(req.url, "http://localhost");
    return url.searchParams.get(key);
  } catch {
    return null;
  }
};

const draftFromTarget = (target, capability, extractedEntities) => {
  const sectionTitle = target.requirement_text?.slice(0, 80) || target.title || "Proposal Response Section";
  const evidence = capability?.project_summary || capability?.description || capability?.project_name || "Relevant project evidence.";
  return {
    section_title: sectionTitle,
    content: `# ${sectionTitle}\n\n## Compliance Response\nWe confirm our ability to meet the requirement: ${target.requirement_text || "Target requirement"}. Our relevant evidence includes ${evidence}.\n\n## Supporting Evidence\n- ${evidence}\n- Considered deadlines: ${(extractedEntities.deadlines || []).slice(0, 3).join(", ") || "None detected"}\n- Considered budgets: ${(extractedEntities.budgets || []).slice(0, 3).join(", ") || "None detected"}\n\n## Draft Position\nThis response is prepared for immediate review and approval.`,
    requirement_id: target.id,
  };
};

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const body = readBody(req);
      const workspaceId = body.workspaceId || getQueryValue(req, "workspaceId");
      if (!isUuid(workspaceId)) {
        return res.status(400).json({ error: "A valid workspaceId UUID is required." });
      }

      const ownership = await requireWorkspaceOwner(req, workspaceId);
      if (ownership.errorResponse) return res.status(ownership.errorResponse.status).json(ownership.errorResponse.body);

      const { supabase, user } = ownership;
      const workspaceDb = getSupabaseAdminOrNull() || supabase;
      const { data: drafts, error } = await workspaceDb
        .from("proposal_drafts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        workspaceId,
        drafts: drafts || [],
      });
    }

    if (req.method === "POST") {
      const body = readBody(req);
      const workspaceId = body.workspaceId;
      if (!isUuid(workspaceId)) {
        return res.status(400).json({ error: "A valid workspaceId UUID is required." });
      }

      const ownership = await requireWorkspaceOwner(req, workspaceId);
      if (ownership.errorResponse) return res.status(ownership.errorResponse.status).json(ownership.errorResponse.body);

      const { supabase, user } = ownership;
      const workspaceDb = getSupabaseAdminOrNull() || supabase;
      const { data: requirements, error: reqError } = await workspaceDb
        .from("rfp_requirements")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (reqError || !requirements) {
        throw new Error(`Failed to load workspace requirement parameters: ${reqError?.message}`);
      }

      let targets = requirements.filter((r) => r.requirement_type === "mandatory");
      if (targets.length === 0) {
        targets = requirements.filter((r) => r.extracted_value === "Question Section");
      }
      if (targets.length === 0) {
        targets = requirements.slice(0, 4);
      }

      if (targets.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No sections or requirements found to draft. Analyze the RFP first.",
          drafts: [],
        });
      }

      const extractedEntities = extractEntitiesFromText(
        requirements.map((req) => req.requirement_text).join("\n")
      );

      const { data: capabilities, error: capError } = await workspaceDb
        .from("capability_library")
        .select("*")
        .eq("user_id", user.id);
      const capabilitySource = !capError && capabilities?.length
        ? capabilities
        : CAPABILITY_LIBRARY.map((item) => ({
            external_id: item.id,
            domain: item.skills?.[0] || item.client_type || "General",
            project_name: item.project_name,
            description: item.description,
            project_summary: item.description,
            certification: item.certifications?.join(", ") || "N/A",
            certifications: item.certifications || [],
            skills: item.skills || [],
            year_completed: item.year_completed,
            contract_value: item.contract_value,
            duration_months: null,
            client_type: item.client_type,
          }));

      const draftsList = targets.map((target, index) => {
        const match = matchRequirementToCapabilities(target, capabilitySource, { entities: extractedEntities });
        const capability = match.capability || capabilitySource[index % capabilitySource.length];
        return draftFromTarget(target, capability, extractedEntities);
      });

      await workspaceDb.from("proposal_drafts").delete().eq("workspace_id", workspaceId);

      const insertRows = draftsList.map((item) => ({
        workspace_id: workspaceId,
        section_title: item.section_title || "Proposal Response Section",
        content: item.content || "Response placeholder under generation.",
        status: "ai_generated",
      }));

      if (insertRows.length > 0) {
        const { data: insertedDrafts, error: draftsError } = await workspaceDb
          .from("proposal_drafts")
          .insert(insertRows)
          .select();

        if (draftsError) {
          throw new Error(`Failed to save proposal drafts to database: ${draftsError.message}`);
        }

        return res.status(200).json({
          success: true,
          workspaceId,
          drafts: insertedDrafts,
        });
      }

      return res.status(200).json({
        success: true,
        workspaceId,
        drafts: [],
      });
    }

    if (req.method === "PATCH") {
      const body = readBody(req);
      const { draftId, content, status } = body;

      if (!isUuid(draftId)) {
        return res.status(400).json({ error: "A valid draftId UUID is required." });
      }

      const nextStatus = ["ai_generated", "edited", "approved"].includes(status) ? status : "edited";

      const auth = await requireAuthenticatedUser(req);
      if (auth.errorResponse) return res.status(auth.errorResponse.status).json(auth.errorResponse.body);

      const { supabase } = auth;
      const { data: draftRow, error: draftLookupError } = await supabase
        .from("proposal_drafts")
        .select("workspace_id")
        .eq("id", draftId)
        .maybeSingle();

      if (draftLookupError) throw draftLookupError;
      if (!draftRow?.workspace_id) {
        return res.status(404).json({ error: "Draft not found." });
      }

      const ownership = await requireWorkspaceOwner(req, draftRow.workspace_id);
      if (ownership.errorResponse) return res.status(ownership.errorResponse.status).json(ownership.errorResponse.body);

      const workspaceDb = getSupabaseAdminOrNull() || supabase;
      const { data, error } = await workspaceDb
        .from("proposal_drafts")
        .update({
          content: String(content || ""),
          status: nextStatus,
        })
        .eq("id", draftId)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        draft: data,
      });
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Proposal draft route failure:", err);
    return res.status(500).json({
      error: "Drafting engine encountered error: " + err.message,
    });
  }
}
