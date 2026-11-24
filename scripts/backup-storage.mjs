// Copies every file in the "music-sheets" bucket into a folder (default: backup/storage).
// Used by .github/workflows/backup.yml and the restore drill (docs/runbook.md).
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY in the environment. Never commit the output.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "music-sheets";
const target = process.argv[2] ?? "backup/storage";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
const storage = createClient(url, key, { auth: { persistSession: false } }).storage.from(BUCKET);

async function list(prefix) {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders have no id; files do.
      if (entry.id) files.push(path);
      else files.push(...(await list(path)));
    }
    if (data.length < 1000) return files;
  }
}

const files = await list("");
let bytes = 0;
for (const path of files) {
  const { data, error } = await storage.download(path);
  if (error) throw new Error(`${path}: ${error.message}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  const out = join(target, path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buffer);
  bytes += buffer.length;
}
console.log(`Backed up ${files.length} files (${(bytes / 1024 / 1024).toFixed(1)} MB) to ${target}`);
