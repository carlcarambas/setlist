import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Administrators with their emails. The database function returns nothing to non-administrators. */
export async function listAdministrators() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_administrators");
  if (error) throw new Error("Could not load administrators.");
  return data;
}
