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

export const createSupabaseAuthenticatedClient = (accessToken) =>
  createClient(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
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
  createSupabaseServerClient(getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));

export const getSupabaseAdmin = () => {
  return createSupabaseServerClient(getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
};

export default getSupabaseClient;
