import { adminClient, pdf, writeState } from "./fixtures";

/** Creates two songs with real PDFs and a plan using both, under a unique tag. */
export default async function globalSetup() {
  const admin = adminClient();
  const tag = `E2E ${Date.now()}`;
  const { data: owner, error: ownerError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("status", "active")
    .limit(1)
    .single();
  if (ownerError || !owner) throw new Error("Seed an active administrator first (npm run db:reset).");

  const songs = [`${tag} Amazing Grace`, `${tag} Be Thou My Vision`];
  const pieceIds: string[] = [];
  const arrangementIds: string[] = [];
  const storagePaths: string[] = [];
  for (const title of songs) {
    const { data: piece, error } = await admin
      .from("music_pieces")
      .insert({ title, created_by: owner.id, updated_by: owner.id })
      .select("id")
      .single();
    if (error || !piece) throw error ?? new Error("piece");
    const arrangementId = crypto.randomUUID();
    const path = `${piece.id}/${arrangementId}/sheet.pdf`;
    const upload = await admin.storage
      .from("music-sheets")
      .upload(path, pdf(title.replace(tag, "").trim()), { contentType: "application/pdf" });
    if (upload.error) throw upload.error;
    const { error: arrError } = await admin.from("arrangements").insert({
      id: arrangementId,
      music_piece_id: piece.id,
      title: "Key of G",
      musical_key: "G",
      storage_path: path,
      original_filename: "sheet.pdf",
      mime_type: "application/pdf",
      file_size_bytes: 700,
      status: "active",
      uploaded_by: owner.id,
    });
    if (arrError) throw arrError;
    pieceIds.push(piece.id);
    arrangementIds.push(arrangementId);
    storagePaths.push(path);
  }

  const planTitle = `${tag} Sunday Service`;
  const { data: plan, error: planError } = await admin
    .from("plans")
    .insert({ title: planTitle, owner_id: owner.id, updated_by: owner.id })
    .select("id")
    .single();
  if (planError || !plan) throw planError ?? new Error("plan");
  const { error: itemsError } = await admin.from("plan_items").insert(
    arrangementIds.map((id, position) => ({ plan_id: plan.id, arrangement_id: id, position, added_by: owner.id })),
  );
  if (itemsError) throw itemsError;

  writeState({ tag, planId: plan.id, planTitle, songs, pieceIds, arrangementIds, storagePaths });
}
