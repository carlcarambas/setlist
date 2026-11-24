import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const SHEETS_BUCKET = "music-sheets";

/** Signed URLs for viewing/downloading expire after 10 minutes (spec §9.3). */
export const SIGNED_URL_TTL_SECONDS = 600;

export function maxUploadBytes() {
  const mb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 20);
  return (Number.isFinite(mb) && mb > 0 ? mb : 20) * 1024 * 1024;
}

/** Object key for a sheet. Never derived from the user's filename. */
export function sheetPath(pieceId: string, arrangementId: string) {
  return `${pieceId}/${arrangementId}/${crypto.randomUUID()}.pdf`;
}

type Edges = { size: number; head: Uint8Array; tail: Uint8Array };

/**
 * Reads the first and last kilobyte of a stored object with HTTP range requests, so a
 * 20 MB upload can be checked without downloading it. Returns null if it doesn't exist.
 */
export async function readObjectEdges(
  admin: SupabaseClient<Database>,
  path: string,
): Promise<Edges | null> {
  const { data, error } = await admin.storage.from(SHEETS_BUCKET).createSignedUrl(path, 60);
  if (error || !data) return null;

  const head = await fetch(data.signedUrl, { headers: { Range: "bytes=0-1023" }, cache: "no-store" });
  if (head.status !== 206 && head.status !== 200) return null;
  const headBytes = new Uint8Array(await head.arrayBuffer());

  const total = Number(head.headers.get("content-range")?.split("/")[1] ?? headBytes.byteLength);
  if (!Number.isFinite(total) || total <= 0) return null;
  if (total <= 1024) return { size: total, head: headBytes, tail: headBytes };

  const tail = await fetch(data.signedUrl, {
    headers: { Range: `bytes=${Math.max(0, total - 1024)}-${total - 1}` },
    cache: "no-store",
  });
  if (tail.status !== 206) return null;
  return { size: total, head: headBytes, tail: new Uint8Array(await tail.arrayBuffer()) };
}
