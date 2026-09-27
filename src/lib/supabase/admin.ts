import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Service-role client. Bypasses row-level security: only for trusted server jobs. */
export function createAdminClient() {
  return createClient(env.supabaseUrl(), env.required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}
