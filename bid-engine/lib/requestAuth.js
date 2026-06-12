import { NextResponse } from "next/server";
import { createSupabaseAuthenticatedClient, getSupabaseAdminOrNull } from "./supabaseClient";

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

const unauthorized = () => ({
  errorResponse: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
});

const invalidSession = () => ({
  errorResponse: NextResponse.json({ error: "Invalid or expired session. Please sign in again." }, { status: 401 }),
});

const authServiceUnavailable = (message) => ({
  errorResponse: NextResponse.json(
    { error: "Authentication check failed: " + message },
    { status: 500 }
  ),
});

export async function requireAuthenticatedUser(request) {
  const token = extractToken(request);
  if (!token) return unauthorized();

  let supabase;
  let data;
  let error;

  try {
    supabase = createSupabaseAuthenticatedClient(token);
    ({ data, error } = await supabase.auth.getUser(token));
  } catch (err) {
    return authServiceUnavailable(err.message || "Unable to reach Supabase Auth");
  }

  if (error || !data?.user) {
    return invalidSession();
  }

  const fullName =
    data.user.user_metadata?.full_name ||
    data.user.user_metadata?.display_name ||
    data.user.user_metadata?.name ||
    null;

  return {
    supabase,
    token,
    user: {
      ...data.user,
      fullName,
    },
  };
}

export async function requireWorkspaceOwner(request, workspaceId) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.errorResponse) return auth;

  const { supabase, user } = auth;
  const adminSupabase = getSupabaseAdminOrNull();
  let workspace = null;
  let error = null;

  try {
    ({ data: workspace, error } = await supabase
      .from("rfp_workspaces")
      .select("id,user_id,title,status,raw_text,file_name,created_at,updated_at")
      .eq("id", workspaceId)
      .maybeSingle());
  } catch (err) {
    error = err;
  }

  if ((!workspace || error) && adminSupabase) {
    try {
      ({ data: workspace, error } = await adminSupabase
        .from("rfp_workspaces")
        .select("id,user_id,title,status,raw_text,file_name,created_at,updated_at")
        .eq("id", workspaceId)
        .maybeSingle());
    } catch (err) {
      error = err;
    }
  }

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

  return { supabase, adminSupabase, user, workspace };
}
