import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getAppSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("church_name, timezone, updated_at")
    .maybeSingle();
  if (error || !data) throw new Error("Could not load settings.");
  return data;
}
