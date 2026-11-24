import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Administrators with their emails. The database function returns nothing to non-administrators. */
export async function listAdministrators() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_administrators");
  if (error) throw new Error("Could not load administrators.");
  return data;
}

/** Member devices that changed plans (or are blocked), most recent first. Administrators only. */
export async function listMemberDevices() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_member_devices");
  if (error) throw new Error("Could not load member devices.");
  return data;
}
