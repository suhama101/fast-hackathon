import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseClient";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const mapLoginError = (message = "") => {
  const text = String(message || "");
  if (/rate limit|too many requests/i.test(text)) {
    return { status: 429, error: "Supabase rate limit exceeded. Please wait and try again." };
  }
  if (/invalid login credentials|invalid credentials/i.test(text)) {
    return { status: 401, error: "Invalid email or password." };
  }
  if (/email not confirmed/i.test(text)) {
    return { status: 401, error: "Please confirm your email address before logging in." };
  }
  return { status: 401, error: text || "Login failed." };
};

const jsonWithClearedAuthCookie = (body, init) => {
  const response = NextResponse.json(body, init);
  response.cookies.set("bid_engine_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
};

/**
 * Handles credentials-based user logging inside BidEngine AI
 */
export async function POST(request) {
  try {
    const payload = await request.json();
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");

    if (!email || !EMAIL_REGEX.test(email)) {
      return jsonWithClearedAuthCookie(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!password) {
      return jsonWithClearedAuthCookie(
        { error: "Password is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const mapped = mapLoginError(error.message);
      return jsonWithClearedAuthCookie({ error: mapped.error }, { status: mapped.status });
    }

    const token = data.session?.access_token;
    if (!token) {
      return jsonWithClearedAuthCookie(
        { error: "Login succeeded, but no session token was returned." },
        { status: 401 }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        message: "Login successful",
        user: data.user,
        token,
        session: data.session,
      },
      { status: 200 }
    );

    response.cookies.set("bid_engine_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Login route error:", err);
    return jsonWithClearedAuthCookie(
      { error: "Internal Server Error within Auth endpoint: " + err.message },
      { status: 500 }
    );
  }
}
