import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Member directory for administrators. RLS limits it to active members. */
export async function listMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, role, status, created_at")
    .order("status")
    .order("display_name");
  if (error) throw new Error("Could not load members.");
  return data;
}
