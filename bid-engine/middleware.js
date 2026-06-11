import { NextResponse } from "next/server";

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;

  const token = request.cookies.get("sb-access-token")?.value ||
                request.cookies.get("bid_engine_token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/rfp") ||
        pathname.startsWith("/api/workspaces") ||
        pathname.startsWith("/api/seed")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/rfp/:path*",
    "/api/workspaces/:path*",
    "/api/seed/:path*"
  ],
};
