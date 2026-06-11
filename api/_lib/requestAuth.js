import { getSupabaseAdmin } from "./supabase.js";

const parseCookies = (cookieHeader = "") =>
  String(cookieHeader)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index === -1) return acc;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});

const extractToken = (req) => {
  const cookies = parseCookies(req.headers.cookie || req.headers.Cookie || "");
  const cookieToken = cookies.bid_engine_token || cookies["sb-access-token"];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  if (String(authHeader).toLowerCase().startsWith("bearer ")) {
    return String(authHeader).slice(7).trim();
  }

  return null;
};

export async function requireAuthenticatedUser(req) {
  const token = extractToken(req);
  if (!token) {
    return {
      errorResponse: {
        status: 401,
        body: { error: "Authentication required" },
      },
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return {
      errorResponse: {
        status: 401,
        body: { error: "Authentication required" },
      },
    };
  }

  return { supabase, user: data.user, token };
}

export async function requireWorkspaceOwner(req, workspaceId) {
  const auth = await requireAuthenticatedUser(req);
  if (auth.errorResponse) return auth;

  const { supabase, user } = auth;
  const { data: workspace, error } = await supabase
    .from("rfp_workspaces")
    .select("id,user_id,title,status,raw_text,file_name,created_at,updated_at")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    return {
      errorResponse: {
        status: 500,
        body: { error: error.message },
      },
    };
  }

  if (!workspace) {
    return {
      errorResponse: {
        status: 404,
        body: { error: "Workspace not found" },
      },
    };
  }

  if (workspace.user_id !== user.id) {
    return {
      errorResponse: {
        status: 403,
        body: { error: "Forbidden" },
      },
    };
  }

  return { supabase, user, workspace };
}
