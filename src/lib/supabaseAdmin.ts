import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isSupabaseServerConfigured = Boolean(supabaseUrl && serviceRoleKey);

/**
 * Admin client used ONLY inside server-side API routes (/api/projects). The
 * service-role key bypasses RLS, so this file must never be imported from a
 * client component — the browser only talks to the API routes via fetch
 * (src/lib/persistenceApi.ts).
 */
export const supabaseAdmin = isSupabaseServerConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
