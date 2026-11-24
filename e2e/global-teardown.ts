import { existsSync, rmSync } from "node:fs";
import { adminClient, readState, STATE_FILE } from "./fixtures";

/** Removes everything the suite created. */
export default async function globalTeardown() {
  if (!existsSync(STATE_FILE)) return;
  const state = readState();
  const admin = adminClient();
  await admin.from("plans").delete().like("title", `${state.tag}%`);
  await admin.from("arrangements").delete().in("id", state.arrangementIds);
  await admin.from("music_pieces").delete().in("id", state.pieceIds);
  await admin.storage.from("music-sheets").remove(state.storagePaths);
  rmSync(STATE_FILE);
}
