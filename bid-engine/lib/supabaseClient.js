import { createClient } from "@supabase/supabase-js";

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const createSupabaseServerClient = (apiKey) =>
  createClient(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

const getServerAuthApiKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_AUTH_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

export const createSupabaseAuthenticatedClient = (accessToken) =>
  createClient(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getServerAuthApiKey() || getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

export const getSupabaseClient = () =>
  createSupabaseServerClient(getServerAuthApiKey() || getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));

export const getSupabaseAdmin = () => {
  return createSupabaseServerClient(getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
};

export const getSupabaseAdminOrNull = () => {
  try {
    return getSupabaseAdmin();
  } catch {
    return null;
  }
};

export default getSupabaseClient;
