import { requireAuthenticatedUser, requireWorkspaceOwner } from "./_lib/requestAuth.js";

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

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const auth = await requireAuthenticatedUser(req);
      if (auth.errorResponse) {
        return res.status(auth.errorResponse.status).json(auth.errorResponse.body);
      }

      const { supabase, user } = auth;
      const requestedWorkspaceId = req.query?.workspaceId || req.query?.id;

      if (requestedWorkspaceId) {
        if (!isUuid(requestedWorkspaceId)) {
          return res.status(400).json({ error: "A valid workspaceId UUID is required." });
        }

        const workspaceCheck = await requireWorkspaceOwner(req, requestedWorkspaceId);
        if (workspaceCheck.errorResponse) {
          return res.status(workspaceCheck.errorResponse.status).json(workspaceCheck.errorResponse.body);
        }

        const [
          { data: requirements, error: requirementsError },
          { data: drafts, error: draftsError },
          { data: score, error: scoreError },
        ] = await Promise.all([
          supabase
            .from("rfp_requirements")
            .select("*")
            .eq("workspace_id", requestedWorkspaceId)
            .order("created_at", { ascending: true }),
          supabase
            .from("proposal_drafts")
            .select("*")
            .eq("workspace_id", requestedWorkspaceId)
            .order("created_at", { ascending: true }),
          supabase
            .from("win_scores")
            .select("*")
            .eq("workspace_id", requestedWorkspaceId)
            .maybeSingle(),
        ]);

        if (requirementsError) throw requirementsError;
        if (draftsError) throw draftsError;
        if (scoreError) throw scoreError;

        return res.status(200).json({
          success: true,
          mode: "dataset",
          workspace: workspaceCheck.workspace,
          requirements: requirements || [],
          drafts: drafts || [],
          score: score || null,
        });
      }

      const { data, error } = await supabase
        .from("rfp_workspaces")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        mode: "dataset",
        workspaces: data || [],
      });
    }

    if (req.method === "POST") {
      const auth = await requireAuthenticatedUser(req);
      if (auth.errorResponse) {
        return res.status(auth.errorResponse.status).json(auth.errorResponse.body);
      }

      const { supabase, user } = auth;
      const body = readBody(req);
      const title = String(body.title || "").trim() || `RFP Workspace - ${new Date().toLocaleDateString()}`;
      const rawText = String(body.rawText || "");
      const fileName = String(body.fileName || "").trim() || null;

      const payload = {
        user_id: user.id,
        title,
        status: body.status || "analyzing",
        raw_text: rawText || null,
        file_name: fileName,
      };

      const { data, error } = await supabase
        .from("rfp_workspaces")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        mode: "dataset",
        workspace: data,
      });
    }

    if (req.method === "PATCH") {
      const auth = await requireAuthenticatedUser(req);
      if (auth.errorResponse) {
        return res.status(auth.errorResponse.status).json(auth.errorResponse.body);
      }

      const { supabase, user } = auth;
      const body = readBody(req);
      if (!isUuid(body.workspaceId)) {
        return res.status(400).json({ error: "A valid workspaceId UUID is required." });
      }

      const workspaceCheck = await requireWorkspaceOwner(req, body.workspaceId);
      if (workspaceCheck.errorResponse) {
        return res.status(workspaceCheck.errorResponse.status).json(workspaceCheck.errorResponse.body);
      }

      const update = {};
      if (body.title !== undefined) update.title = String(body.title || "").trim();
      if (body.status !== undefined) update.status = String(body.status || "").trim();
      if (body.rawText !== undefined) update.raw_text = String(body.rawText || "");
      if (body.fileName !== undefined) update.file_name = String(body.fileName || "").trim() || null;
      update.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("rfp_workspaces")
        .update(update)
        .eq("id", body.workspaceId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        mode: "dataset",
        workspace: data,
      });
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Workspace route error:", err);
    return res.status(500).json({
      success: false,
      mode: "sample_mode_unavailable",
      error: "Failed to handle workspace request: " + err.message,
    });
  }
}
