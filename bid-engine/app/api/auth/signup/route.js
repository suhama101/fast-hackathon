import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseClient";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const mapSignupError = (message = "") => {
  const text = String(message || "");
  if (/rate limit|too many requests/i.test(text)) {
    return { status: 429, error: "Supabase rate limit exceeded. Please wait and try again." };
  }
  if (/already registered|already exists|duplicate|already been registered|user already registered/i.test(text)) {
    return { status: 409, error: "An account with this email already exists." };
  }
  if (/invalid email/i.test(text)) {
    return { status: 400, error: "Please enter a valid email address." };
  }
  return { status: 400, error: text || "Registration failed." };
};

/**
 * Registers new bidders inside BidEngine AI portal
 */
export async function POST(request) {
  try {
    const payload = await request.json();
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");
    const name = String(payload.name || "").trim();

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: name || "Anonymous Bidder",
      },
    });

    if (error) {
      const mapped = mapSignupError(error.message);
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    if (!data?.user?.id) {
      return NextResponse.json(
        { error: "Supabase did not return a user record for this signup." },
        { status: 500 }
      );
    }

    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      const mapped = mapSignupError(signInError.message);
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    const token = sessionData.session?.access_token;
    if (!token) {
      return NextResponse.json(
        { error: "Registration succeeded, but no session token was returned." },
        { status: 500 }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        message: "Registration successful.",
        user: data.user,
        token,
        session: sessionData.session,
      },
      { status: 201 }
    );

    if (token) {
      response.cookies.set("bid_engine_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }

    return response;
  } catch (err) {
    console.error("Signup route error:", err);
    return NextResponse.json(
      { error: "Internal Server Error within Sign-up endpoint: " + err.message },
      { status: 500 }
    );
  }
}
