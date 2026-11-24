"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  formError,
  formSuccess,
  keptValues,
  validationError,
  type FormState,
} from "@/features/auth/form-state";
import { getCurrentMember } from "@/lib/auth/member";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { looksLikePdf } from "./pdf-check";
import { arrangementSchema, fileSchema, pieceSchema } from "./schemas";
import { maxUploadBytes, readObjectEdges, sheetPath, SHEETS_BUCKET } from "./storage";

async function activeMember() {
  const member = await getCurrentMember();
  return member?.status === "active" ? member : null;
}

const NOT_SIGNED_IN = "Your session has ended. Sign in again to continue.";

// ---------------------------------------------------------------------------
// Duplicate check (LIB-13): advisory only, never blocks an upload.
// ---------------------------------------------------------------------------
export type DuplicateHint = { musicPieceId: string; title: string; reason: "same_file" | "similar_title" };

export async function findPossibleDuplicates(input: {
  title: string;
  sha256: string | null;
}): Promise<DuplicateHint[]> {
  if (!(await activeMember())) return [];
  const title = z.string().trim().max(200).catch("").parse(input.title);
  const sha256 = z.string().regex(/^[0-9a-f]{64}$/).nullable().catch(null).parse(input.sha256);
  if (!title && !sha256) return [];

  const supabase = await createClient();
  const { data } = await supabase.rpc("find_possible_duplicates", {
    p_title: title,
    p_sha256: sha256 ?? "",
  });
  return (data ?? []).map((d) => ({
    musicPieceId: d.music_piece_id,
    title: d.title,
    reason: d.reason === "same_file" ? "same_file" : "similar_title",
  }));
}

// ---------------------------------------------------------------------------
// Upload (spec §19 P1): prepare → browser uploads to Storage → finalize.
// ---------------------------------------------------------------------------
export type PrepareUploadResult =
  | {
      ok: true;
      pieceId: string;
      arrangementId: string;
      createdPiece: boolean;
      path: string;
      token: string;
    }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function fieldErrorsOf(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  return fieldErrors;
}

/**
 * Validates the form, creates the piece (if new) and a pending arrangement, and returns a
 * one-time signed URL the browser uploads the PDF to. Pass `pieceId` to add an
 * arrangement to an existing piece.
 */
export async function prepareUpload(formData: FormData): Promise<PrepareUploadResult> {
  const member = await activeMember();
  if (!member) return { ok: false, message: NOT_SIGNED_IN };

  const raw = Object.fromEntries(formData);
  const existingPieceId = z.uuid().optional().catch(undefined).parse(raw.pieceId || undefined);

  const arrangement = arrangementSchema.safeParse(raw);
  const file = fileSchema(maxUploadBytes()).safeParse(raw);
  const piece = existingPieceId ? null : pieceSchema.safeParse(raw);

  const errors = {
    ...(arrangement.success ? {} : fieldErrorsOf(arrangement.error)),
    ...(file.success ? {} : fieldErrorsOf(file.error)),
    ...(piece && !piece.success ? fieldErrorsOf(piece.error) : {}),
  };
  if (!arrangement.success || !file.success || (piece && !piece.success)) {
    const fileMessage = errors.fileName?.[0] ?? errors.fileSize?.[0];
    return { ok: false, message: fileMessage ?? "Please fix the highlighted fields.", fieldErrors: errors };
  }

  const supabase = await createClient();
  let pieceId = existingPieceId;
  if (!pieceId && piece?.success) {
    const { data, error } = await supabase.from("music_pieces").insert(piece.data).select("id").single();
    if (error || !data) return { ok: false, message: "The music couldn't be saved. Please try again." };
    pieceId = data.id;
  }
  if (!pieceId) return { ok: false, message: "Choose the music this arrangement belongs to." };

  const arrangementId = crypto.randomUUID();
  const path = sheetPath(pieceId, arrangementId);
  const { error: insertError } = await supabase.from("arrangements").insert({
    id: arrangementId,
    music_piece_id: pieceId,
    title: arrangement.data.arrangementTitle,
    musical_key: arrangement.data.musicalKey,
    bpm: arrangement.data.bpm,
    instrument_notes: arrangement.data.instrumentNotes,
    storage_path: path,
    original_filename: file.data.fileName,
    mime_type: "application/pdf",
    file_size_bytes: file.data.fileSize,
    content_sha256: file.data.sha256,
  });
  if (insertError) {
    if (!existingPieceId) await deleteEmptyPiece(pieceId, member.id);
    return {
      ok: false,
      message: existingPieceId
        ? "This music is archived or no longer available. Restore it before adding arrangements."
        : "The upload couldn't be started. Please try again.",
    };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(SHEETS_BUCKET)
    .createSignedUploadUrl(path);
  if (signError || !signed) {
    await discardUpload(arrangementId, member.id, !existingPieceId);
    return { ok: false, message: "The upload couldn't be started. Please try again." };
  }

  return { ok: true, pieceId, arrangementId, createdPiece: !existingPieceId, path, token: signed.token };
}

/**
 * Checks the uploaded bytes (not the file name) and activates the arrangement. On any
 * failure the pending row and file are removed, so nothing half-uploaded is left behind.
 */
export async function finalizeUpload(input: {
  arrangementId: string;
  createdPiece: boolean;
}): Promise<{ ok: true; pieceId: string } | { ok: false; message: string }> {
  const member = await activeMember();
  if (!member) return { ok: false, message: NOT_SIGNED_IN };
  const arrangementId = z.uuid().parse(input.arrangementId);

  // Secret-key client: only the server may move an arrangement out of 'pending'.
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("arrangements")
    .select("id, music_piece_id, storage_path, status, uploaded_by")
    .eq("id", arrangementId)
    .maybeSingle();
  if (!row || row.status !== "pending" || row.uploaded_by !== member.id) {
    return { ok: false, message: "This upload has expired. Please upload the file again." };
  }

  const edges = await readObjectEdges(admin, row.storage_path);
  const problem = !edges
    ? "The file didn't finish uploading. Please try again."
    : edges.size > maxUploadBytes()
      ? "The file is too large."
      : !looksLikePdf(edges.head, edges.tail)
        ? "That file isn't a valid PDF. Export or save it as PDF and try again."
        : null;

  if (problem || !edges) {
    await discardUpload(arrangementId, member.id, input.createdPiece);
    return { ok: false, message: problem ?? "The upload failed." };
  }

  const { error } = await admin
    .from("arrangements")
    .update({ status: "active", file_size_bytes: edges.size })
    .eq("id", arrangementId)
    .eq("status", "pending");
  if (error) return { ok: false, message: "The upload couldn't be saved. Please try again." };

  return { ok: true, pieceId: row.music_piece_id };
}

/** Called by the browser when its upload fails, to remove the pending arrangement. */
export async function abandonUpload(input: { arrangementId: string; createdPiece: boolean }) {
  const member = await activeMember();
  if (!member) return;
  const parsed = z.uuid().safeParse(input.arrangementId);
  if (parsed.success) await discardUpload(parsed.data, member.id, input.createdPiece);
}

async function discardUpload(arrangementId: string, memberId: string, removeEmptyPiece: boolean) {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("arrangements")
    .select("music_piece_id, storage_path, status, uploaded_by")
    .eq("id", arrangementId)
    .maybeSingle();
  if (!row || row.status !== "pending" || row.uploaded_by !== memberId) return;

  await admin.storage.from(SHEETS_BUCKET).remove([row.storage_path]);
  await admin.from("arrangements").delete().eq("id", arrangementId).eq("status", "pending");
  if (removeEmptyPiece) await deleteEmptyPiece(row.music_piece_id, memberId);
}

/** Removes a piece created for an upload that never completed (no arrangements left). */
async function deleteEmptyPiece(pieceId: string, memberId: string) {
  const admin = createAdminClient();
  const { count } = await admin
    .from("arrangements")
    .select("id", { count: "exact", head: true })
    .eq("music_piece_id", pieceId);
  if (count === 0) {
    await admin.from("music_pieces").delete().eq("id", pieceId).eq("created_by", memberId);
  }
}

// ---------------------------------------------------------------------------
// Replacing an arrangement's PDF (LIB-15): same arrangement id, new file.
// ---------------------------------------------------------------------------
export async function prepareReplacement(
  formData: FormData,
): Promise<{ ok: true; path: string; token: string } | { ok: false; message: string }> {
  const member = await activeMember();
  if (!member) return { ok: false, message: NOT_SIGNED_IN };

  const raw = Object.fromEntries(formData);
  const arrangementId = z.uuid().safeParse(raw.arrangementId);
  const file = fileSchema(maxUploadBytes()).safeParse(raw);
  if (!arrangementId.success) return { ok: false, message: "This arrangement no longer exists." };
  if (!file.success) return { ok: false, message: file.error.issues[0]?.message ?? "Choose a PDF file." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("arrangements")
    .select("id, music_piece_id, status")
    .eq("id", arrangementId.data)
    .maybeSingle();
  if (!row || row.status === "pending") return { ok: false, message: "This arrangement no longer exists." };

  const path = sheetPath(row.music_piece_id, row.id);
  const { data: signed, error } = await supabase.storage.from(SHEETS_BUCKET).createSignedUploadUrl(path);
  if (error || !signed) return { ok: false, message: "The upload couldn't be started. Please try again." };
  return { ok: true, path, token: signed.token };
}

export async function finalizeReplacement(input: {
  arrangementId: string;
  path: string;
  fileName: string;
  sha256: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const member = await activeMember();
  if (!member) return { ok: false, message: NOT_SIGNED_IN };
  const arrangementId = z.uuid().parse(input.arrangementId);
  const fileName = z.string().trim().min(1).max(255).catch("sheet.pdf").parse(input.fileName);
  const sha256 = z.string().regex(/^[0-9a-f]{64}$/).nullable().catch(null).parse(input.sha256);

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("arrangements")
    .select("id, music_piece_id, storage_path, status")
    .eq("id", arrangementId)
    .maybeSingle();
  const folder = row ? `${row.music_piece_id}/${row.id}/` : null;
  if (!row || row.status === "pending" || !folder || !input.path.startsWith(folder) || input.path === row.storage_path) {
    return { ok: false, message: "This replacement has expired. Please try again." };
  }

  const edges = await readObjectEdges(admin, input.path);
  const problem = !edges
    ? "The file didn't finish uploading. Please try again."
    : edges.size > maxUploadBytes()
      ? "The file is too large."
      : !looksLikePdf(edges.head, edges.tail)
        ? "That file isn't a valid PDF. Export or save it as PDF and try again."
        : null;
  if (problem || !edges) {
    await admin.storage.from(SHEETS_BUCKET).remove([input.path]);
    return { ok: false, message: problem ?? "The upload failed." };
  }

  const { error } = await admin
    .from("arrangements")
    .update({
      storage_path: input.path,
      original_filename: fileName,
      file_size_bytes: edges.size,
      content_sha256: sha256,
    })
    .eq("id", arrangementId)
    .eq("storage_path", row.storage_path); // don't overwrite a concurrent replacement
  if (error) {
    await admin.storage.from(SHEETS_BUCKET).remove([input.path]);
    return { ok: false, message: "The new file couldn't be saved. Please try again." };
  }

  await admin.storage.from(SHEETS_BUCKET).remove([row.storage_path]);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Metadata and archiving (any active member, spec §4.2)
// ---------------------------------------------------------------------------
export async function updatePiece(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await activeMember())) return formError(NOT_SIGNED_IN, keptValues(formData));
  const id = z.uuid().safeParse(formData.get("pieceId"));
  const parsed = pieceSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return formError("This music no longer exists.");
  if (!parsed.success) return validationError(parsed.error, keptValues(formData));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("music_pieces")
    .update(parsed.data)
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return formError("Changes couldn't be saved. Please try again.", keptValues(formData));

  redirect(`/library/${id.data}`);
}

export async function updateArrangement(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await activeMember())) return formError(NOT_SIGNED_IN, keptValues(formData));
  const id = z.uuid().safeParse(formData.get("arrangementId"));
  const parsed = arrangementSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return formError("This arrangement no longer exists.");
  if (!parsed.success) return validationError(parsed.error, keptValues(formData));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("arrangements")
    .update({
      title: parsed.data.arrangementTitle,
      musical_key: parsed.data.musicalKey,
      bpm: parsed.data.bpm,
      instrument_notes: parsed.data.instrumentNotes,
    })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return formError("Changes couldn't be saved. Please try again.", keptValues(formData));

  refresh();
  return formSuccess("Arrangement saved.");
}

const statusInput = z.object({ id: z.uuid(), status: z.enum(["active", "archived"]) });

export async function setPieceStatus(formData: FormData): Promise<void> {
  if (!(await activeMember())) return;
  const parsed = statusInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("music_pieces").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  refresh();
}

export async function setArrangementStatus(formData: FormData): Promise<void> {
  if (!(await activeMember())) return;
  const parsed = statusInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("arrangements").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  refresh();
}

// ---------------------------------------------------------------------------
// Admin: remove uploads that were started but never finished (plan §4.5)
// ---------------------------------------------------------------------------
export async function cleanupStaleUploads(): Promise<void> {
  const member = await activeMember();
  if (member?.role !== "admin") return;

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: stale } = await admin
    .from("arrangements")
    .select("id, storage_path, music_piece_id")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .limit(200);
  if (!stale?.length) return;

  await admin.storage.from(SHEETS_BUCKET).remove(stale.map((s) => s.storage_path));
  await admin.from("arrangements").delete().in("id", stale.map((s) => s.id)).eq("status", "pending");

  for (const pieceId of new Set(stale.map((s) => s.music_piece_id))) {
    const { count } = await admin
      .from("arrangements")
      .select("id", { count: "exact", head: true })
      .eq("music_piece_id", pieceId);
    if (count === 0) await admin.from("music_pieces").delete().eq("id", pieceId);
  }
  refresh();
}
