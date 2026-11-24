// Uploads a storage backup (from backup-storage.mjs) back into the "music-sheets" bucket.
// Existing files with the same path are left alone. See docs/runbook.md.
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY in the environment.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "music-sheets";
const source = process.argv[2] ?? "backup/storage";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
const storage = createClient(url, key, { auth: { persistSession: false } }).storage.from(BUCKET);

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

let restored = 0;
let skipped = 0;
for (const file of walk(source)) {
  const path = relative(source, file).split(sep).join("/");
  const { error } = await storage.upload(path, readFileSync(file), { contentType: "application/pdf", upsert: false });
  if (!error) restored += 1;
  else if (/exists|Duplicate/i.test(error.message)) skipped += 1;
  else throw new Error(`${path}: ${error.message}`);
}
console.log(`Restored ${restored} files, ${skipped} already present.`);
