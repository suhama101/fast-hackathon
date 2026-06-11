import { NextResponse } from "next/server";

const verifySupabaseToken = async (token) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
};

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;

  const authHeader = request.headers.get("authorization") || "";
  const token =
    request.cookies.get("bid_engine_token")?.value ||
    request.cookies.get("sb-access-token")?.value ||
    authHeader.replace(/^Bearer\s+/i, "");

  const isProtectedPage = pathname.startsWith("/dashboard");
  const isProtectedAPI =
    pathname.startsWith("/api/rfp") ||
    pathname.startsWith("/api/workspaces") ||
    pathname.startsWith("/api/seed");

  if (!isProtectedPage && !isProtectedAPI) {
    return NextResponse.next();
  }

  if (!token) {
    if (isProtectedAPI) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const user = await verifySupabaseToken(token);
  if (!user?.id) {
    if (isProtectedAPI) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("bid_engine_token");
    response.cookies.delete("bid_engine_refresh_token");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/rfp/:path*",
    "/api/workspaces/:path*",
    "/api/seed/:path*",
  ],
};
