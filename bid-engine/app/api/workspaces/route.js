import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "../../../lib/requestAuth";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { supabase, user } = auth;
    const { data, error } = await supabase
      .from("rfp_workspaces")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      mode: "dataset",
      workspaces: data || [],
    });
  } catch (err) {
    console.error("Workspace list route error:", err);
    return NextResponse.json({
      success: true,
      mode: "sample_mode",
      warning: "Database unavailable; workspace persistence is disabled.",
      workspaces: [],
    });
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { supabase, user } = auth;
    const body = await request.json();
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

    return NextResponse.json({
      success: true,
      mode: "dataset",
      workspace: data,
    }, { status: 201 });
  } catch (err) {
    console.error("Workspace create route error:", err);
    return NextResponse.json({
      success: false,
      mode: "sample_mode_unavailable",
      error: "Failed to create Supabase workspace: " + err.message,
    }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.errorResponse) return auth.errorResponse;

    const { supabase, user } = auth;
    const body = await request.json();
    if (!isUuid(body.workspaceId)) {
      return NextResponse.json({ error: "A valid workspaceId UUID is required." }, { status: 400 });
    }

    const workspaceCheck = await requireWorkspaceOwner(request, body.workspaceId);
    if (workspaceCheck.errorResponse) return workspaceCheck.errorResponse;

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

    return NextResponse.json({
      success: true,
      mode: "dataset",
      workspace: data,
    });
  } catch (err) {
    console.error("Workspace update route error:", err);
    return NextResponse.json({
      success: false,
      error: "Failed to update workspace: " + err.message,
    }, { status: 500 });
  }
}
