import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const readJsonBody = async (request) => {
  try {
    return await request.json();
  } catch {
    const error = new Error("Invalid JSON request body.");
    error.statusCode = 400;
    throw error;
  }
};

export async function POST(request) {
  try {
    const payload = await readJsonBody(request);
    const fullName = String(payload.fullName || payload.name || "").trim();
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Full name, email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        display_name: fullName,
        role: "recruiter",
      },
    });

    if (createError || !createdUser?.user) {
      const message = createError?.message || "Failed to create user";
      if (/already|duplicate|exists/i.test(message)) {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create account: " + message },
        { status: 500 }
      );
    }

    const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !sessionData?.session) {
      return NextResponse.json(
        { error: "Account was created, but login failed: " + (signInError?.message || "No session returned") },
        { status: 500 }
      );
    }

    const { access_token: accessToken, refresh_token: refreshToken } = sessionData.session;

    const response = NextResponse.json({
      success: true,
      token: accessToken,
      session: sessionData.session,
      user: {
        id: sessionData.user?.id || createdUser.user.id,
        email: sessionData.user?.email || email,
        fullName,
        role: "recruiter",
      },
    });

    response.cookies.set("bid_engine_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    if (refreshToken) {
      response.cookies.set("bid_engine_refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("Signup error:", error);
    const status = error.statusCode || 500;
    const prefix = status === 400 ? "" : "Internal server error: ";
    return NextResponse.json({ error: prefix + error.message }, { status });
  }
}
