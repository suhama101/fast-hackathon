import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function GET(request) {
  try {
    const token =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      request.cookies.get("bid_engine_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ||
        process.env.SUPABASE_JWT_SECRET ||
        "fallback_secret_change_in_production"
    );

    const { payload } = await jwtVerify(token, secret);

    return NextResponse.json({
      valid: true,
      user: {
        id: payload.userId,
        email: payload.email,
        fullName: payload.fullName,
        role: payload.role,
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
