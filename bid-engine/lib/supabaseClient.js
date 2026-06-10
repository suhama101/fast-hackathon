import { createClient } from "@supabase/supabase-js";
import "./envConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-anon-key";

// Standard client browser-safe context
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Accesses Supabase with admin bypass permissions (Server-only context)
 */
export const getSupabaseAdmin = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return createClient(supabaseUrl, serviceKey || supabaseAnonKey);
};
