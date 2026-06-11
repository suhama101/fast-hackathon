import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSupabaseAdmin } from "./supabaseClient";

const getJwtSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET ||
      process.env.SUPABASE_JWT_SECRET ||
      "fallback_secret_change_in_production"
  );

const extractToken = (request) => {
  const cookieToken = request.cookies.get("bid_engine_token")?.value;
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

export async function requireAuthenticatedUser(request) {
  const token = extractToken(request);
  if (!token) return unauthorized();

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.userId) return unauthorized();

    const supabase = getSupabaseAdmin();
    const { data: userRecord, error } = await supabase
      .from("users")
      .select("id,email,full_name,role,created_at")
      .eq("id", payload.userId)
      .maybeSingle();

    if (error) {
      console.error("Authenticated user lookup failed:", error);
      return unauthorized();
    }

    if (!userRecord) return unauthorized();

    return {
      supabase,
      token,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        fullName: userRecord.full_name,
        full_name: userRecord.full_name,
        role: userRecord.role,
        created_at: userRecord.created_at,
      },
    };
  } catch {
    return unauthorized();
  }
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
