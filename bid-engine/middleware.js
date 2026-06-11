import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;

  const authHeader = request.headers.get("authorization") || "";
  const token =
    request.cookies.get("bid_engine_token")?.value ||
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

  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ||
        process.env.SUPABASE_JWT_SECRET ||
        "fallback_secret_change_in_production"
    );

    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    if (isProtectedAPI) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("bid_engine_token");
    return response;
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/rfp/:path*",
    "/api/workspaces/:path*",
    "/api/seed/:path*",
  ],
};
