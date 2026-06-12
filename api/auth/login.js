import { getSupabaseClient } from "../_lib/supabase.js";

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

const clearAuthCookie = (res) => {
  const cookie = `bid_engine_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", cookie);
};

const setAuthCookie = (res, token) => {
  const cookie = `bid_engine_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", cookie);
};

const readJsonBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body !== "string") return req.body;

  try {
    return JSON.parse(req.body || "{}");
  } catch {
    const error = new Error("Invalid JSON request body.");
    error.statusCode = 400;
    throw error;
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = readJsonBody(req);
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");

    if (!email || !EMAIL_REGEX.test(email)) {
      clearAuthCookie(res);
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (!password) {
      clearAuthCookie(res);
      return res.status(400).json({ error: "Password is required." });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const mapped = mapLoginError(error.message);
      clearAuthCookie(res);
      return res.status(mapped.status).json({ error: mapped.error });
    }

    const token = data.session?.access_token;
    if (!token) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "Login succeeded, but no session token was returned." });
    }

    setAuthCookie(res, token);
    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        ...data.user,
        fullName:
          data.user?.user_metadata?.display_name ||
          data.user?.user_metadata?.full_name ||
          data.user?.user_metadata?.name ||
          null,
      },
      token,
      session: data.session,
    });
  } catch (err) {
    console.error("Login route error:", err);
    clearAuthCookie(res);
    const status = err.statusCode || 500;
    const prefix = status === 400 ? "" : "Internal Server Error within Auth endpoint: ";
    return res.status(status).json({ error: prefix + err.message });
  }
}
