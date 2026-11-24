import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { SHEETS_BUCKET, SIGNED_URL_TTL_SECONDS } from "./storage";

export async function listCategories() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("music_categories");
  return data ?? [];
}

export async function getPiece(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("music_pieces")
    .select(
      `id, title, composer, description, category, tags, status, created_at, updated_at,
       creator:profiles!music_pieces_created_by_fkey(display_name),
       arrangements(id, title, musical_key, bpm, instrument_notes, original_filename,
                    file_size_bytes, status, created_at,
                    uploader:profiles!arrangements_uploaded_by_fkey(display_name))`,
    )
    .eq("id", id)
    .neq("arrangements.status", "pending")
    .order("created_at", { referencedTable: "arrangements" })
    .maybeSingle();
  if (error) throw new Error("Could not load this music.");
  return data;
}

export async function getArrangement(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("arrangements")
    .select(
      "id, music_piece_id, title, musical_key, bpm, instrument_notes, original_filename, file_size_bytes, status, storage_path, piece:music_pieces(id, title, status)",
    )
    .eq("id", id)
    .neq("status", "pending")
    .maybeSingle();
  if (error) throw new Error("Could not load this arrangement.");
  return data;
}

/**
 * A short-lived URL for an arrangement's PDF, created as the signed-in user so Storage
 * RLS applies. `download` sets the saved file name.
 */
/**
 * Short-lived signed URL for a sheet. Uses the member's session unless a client is
 * given (public share links pass the secret-key client after validating the link).
 */
export async function signedSheetUrl(storagePath: string, download?: string, client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.storage
    .from(SHEETS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  if (!download) return data.signedUrl;

  // Added here rather than via the client's `download` option, which encodes the name
  // twice ("Grace (G).pdf" would save as "Grace %28G%29.pdf").
  const url = new URL(data.signedUrl);
  url.searchParams.set("download", download);
  return url.toString();
}

/** Admin only: uploads started more than 24 hours ago that never finished. */
export async function countStaleUploads() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("arrangements")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("created_at", cutoff);
  return count ?? 0;
}

