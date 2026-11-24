"use client";

import { createClient } from "@/lib/supabase/client";

/** SHA-256 of a file, used only to warn about duplicate uploads. Null if unavailable. */
export async function sha256Hex(file: File): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/** Quick browser-side checks; the server re-checks the actual bytes after upload. */
export function checkPdfFile(file: File | null, maxMb: number): string | null {
  if (!file) return "Choose a PDF file.";
  if (!file.name.toLowerCase().endsWith(".pdf")) return "Only PDF files can be uploaded.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > maxMb * 1024 * 1024) return `The file is larger than ${maxMb} MB.`;
  return null;
}

/** Uploads straight to Supabase Storage using a one-time signed upload URL. */
export async function uploadToSignedUrl(path: string, token: string, file: File) {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("music-sheets")
    .uploadToSignedUrl(path, token, file, { contentType: "application/pdf" });
  return !error;
}
