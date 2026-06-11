import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export async function POST(request) {
  try {
    const { email: rawEmail, password: rawPassword } = await request.json();
    const email = normalizeEmail(rawEmail);
    const password = String(rawPassword || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session || !data?.user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const { access_token: accessToken, refresh_token: refreshToken } = data.session;

    const response = NextResponse.json({
      success: true,
      token: accessToken,
      session: data.session,
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName:
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.display_name ||
          data.user.user_metadata?.name ||
          null,
        role: data.user.user_metadata?.role || data.user.app_metadata?.role || "recruiter",
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
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
