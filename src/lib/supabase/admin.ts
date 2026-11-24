import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Secret-key client that BYPASSES Row Level Security.
 *
 * Allowed uses only (docs/implementation-plan.md §4.6):
 *   1. Resolving public share links
 *   2. Administrator member actions (invite, ban/unban)
 *   3. Upload finalization: checking stored PDF bytes and activating/replacing a sheet
 *      (members can't approve their own uploads)
 *   4. Storage cleanup
 * Everything else must use the user-scoped client from ./server.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set. See .env.example.");
  }
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
