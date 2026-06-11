import { NextResponse } from "next/server";

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
