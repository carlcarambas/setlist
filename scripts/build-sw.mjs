// Runs after `next build` (npm "postbuild"): writes public/sw.js from scripts/sw-template.js with this
// build's id and every file under .next/static, so the service worker can precache the whole app for
// offline use and each deploy produces a new worker. public/sw.js is generated; don't edit or commit it.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const staticDir = join(root, ".next", "static");
const buildId = readFileSync(join(root, ".next", "BUILD_ID"), "utf8").trim();

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const assets = walk(staticDir)
  .map((file) => `/_next/static/${relative(staticDir, file).split(sep).join("/")}`)
  .filter((url) => !url.endsWith(".map"))
  .sort();

const template = readFileSync(join(root, "scripts", "sw-template.js"), "utf8");
const output = template.replace("__VERSION__", buildId).replace("__ASSETS__", JSON.stringify(assets));
writeFileSync(join(root, "public", "sw.js"), output);
console.log(`Service worker: version ${buildId}, ${assets.length} assets precached.`);
