import { getSupabaseAdmin } from "../_lib/supabase.js";

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
  if (/invalid email|email address .* invalid|is invalid/i.test(text)) {
    return { status: 400, error: "Please enter a valid email address." };
  }
  return { status: 400, error: text || "Registration failed." };
};

const clearAuthCookie = (res) => {
  const cookie = `bid_engine_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", cookie);
};

const setAuthCookie = (res, token) => {
  const cookie = `bid_engine_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", cookie);
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");
    const name = String(payload.fullName || payload.name || "").trim();

    if (!email || !EMAIL_REGEX.test(email)) {
      clearAuthCookie(res);
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      clearAuthCookie(res);
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    const supabase = getSupabaseAdmin();
    let { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name || "Anonymous Bidder",
        },
      },
    });

    if (error && /rate limit|too many requests/i.test(error.message || "")) {
      const fallback = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: name || "Anonymous Bidder",
        },
      });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      const mapped = mapSignupError(error.message);
      clearAuthCookie(res);
      return res.status(mapped.status).json({ error: mapped.error });
    }

    if (!data?.user?.id) {
      clearAuthCookie(res);
      return res.status(500).json({ error: "Supabase did not return a user record for this signup." });
    }

    const { data: confirmedUser, error: confirmError } = await supabase.auth.admin.updateUserById(
      data.user.id,
      {
        email_confirm: true,
        user_metadata: {
          display_name: name || "Anonymous Bidder",
        },
      }
    );

    if (confirmError) {
      throw new Error(confirmError.message);
    }

    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      const mapped = mapSignupError(signInError.message);
      clearAuthCookie(res);
      return res.status(mapped.status).json({ error: mapped.error });
    }

    const token = sessionData.session?.access_token;
    if (!token) {
      clearAuthCookie(res);
      return res.status(500).json({ error: "Registration succeeded, but no session token was returned." });
    }

    setAuthCookie(res, token);
    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      user: {
        ...(confirmedUser?.user || data.user),
        fullName: confirmedUser?.user?.user_metadata?.display_name || name,
      },
      fullName: confirmedUser?.user?.user_metadata?.display_name || name,
      token,
      session: sessionData.session,
    });
  } catch (err) {
    console.error("Signup route error:", err);
    clearAuthCookie(res);
    return res.status(500).json({ error: "Internal Server Error within Sign-up endpoint: " + err.message });
  }
}
