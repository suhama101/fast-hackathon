import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "./supabaseClient";

const extractToken = (request) => {
  const cookieToken =
    request.cookies.get("bid_engine_token")?.value ||
    request.cookies.get("sb-access-token")?.value;

  if (cookieToken) return cookieToken;

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
};

export async function requireAuthenticatedUser(request) {
  const token = extractToken(request);
  if (!token) {
    return {
      errorResponse: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return {
      errorResponse: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  return { supabase, user: data.user, token };
}

export async function requireWorkspaceOwner(request, workspaceId) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.errorResponse) return auth;

  const { supabase, user } = auth;
  const { data: workspace, error } = await supabase
    .from("rfp_workspaces")
    .select("id,user_id,title,status,raw_text,file_name,created_at,updated_at")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    return {
      errorResponse: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }

  if (!workspace) {
    return {
      errorResponse: NextResponse.json({ error: "Workspace not found" }, { status: 404 }),
    };
  }

  if (workspace.user_id !== user.id) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabase, user, workspace };
}
