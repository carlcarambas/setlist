/*
 * Setlist service worker (spec v2 §4.5 OFF-01/OFF-02). Generated into public/sw.js after each
 * `next build` by scripts/build-sw.mjs, which fills in the version and the build's asset list, so
 * every deploy changes this file and browsers install the new version.
 *
 * - App shell: the member pages are static (identical for everyone; data comes from IndexedDB), so
 *   they're precached and served cache-first, ignoring the query string (?id=…).
 * - Assets (/_next/static, icons): precached, cache-first. Content-hashed names never change.
 * - Other pages (editing, administration): network-first; offline they go to /offline.
 * - Data requests (RSC, /api, Supabase) pass through untouched. Offline, Next.js falls back to a full
 *   page load when its data request fails, and that load is answered from the shell cache.
 * - Sheets live in "setlist-sheets-v1" (written by the page) and survive updates.
 *
 * A new version waits until every Setlist tab or app window is closed, then takes over on the next
 * start: it never swaps code under an open page.
 */
const VERSION = "__VERSION__";
const ASSETS = __ASSETS__;
const SHELL = ["/dashboard", "/library", "/song", "/sheet", "/plans", "/plan", "/events", "/event", "/settings", "/offline"];
const ALIASES = { "/": "/dashboard" };

const SHELL_CACHE = `setlist-shell-${VERSION}`;
const ASSETS_CACHE = `setlist-assets-${VERSION}`;
const SHEETS_CACHE = "setlist-sheets-v1";

// Only the body and content type are stored: never cache cookies or other per-response headers.
async function storable(response) {
  return new Response(await response.blob(), {
    status: 200,
    headers: { "Content-Type": response.headers.get("Content-Type") || "text/html; charset=utf-8" },
  });
}

/** Fetches shell pages that aren't cached yet. Pages that redirect (no session yet) are skipped. */
async function fillShell() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.all(
    SHELL.map(async (path) => {
      if (await cache.match(path)) return;
      try {
        const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
        if (response.ok && !response.redirected) await cache.put(path, await storable(response));
      } catch {
        // Offline or failed: tried again on the next page load.
      }
    }),
  );
}

async function precacheAssets() {
  const cache = await caches.open(ASSETS_CACHE);
  const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  const missing = ASSETS.filter((url) => !have.has(url));
  // A few at a time, tolerating single failures (they're fetched again when first used).
  for (let i = 0; i < missing.length; i += 8) {
    await Promise.all(missing.slice(i, i + 8).map((url) => cache.add(url).catch(() => undefined)));
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all([precacheAssets(), fillShell()]));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith("setlist-") && ![SHELL_CACHE, ASSETS_CACHE, SHEETS_CACHE].includes(n))
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "fill-shell") event.waitUntil(fillShell());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }
  if (request.mode === "navigate") {
    const shellPath = ALIASES[url.pathname] || url.pathname;
    event.respondWith(SHELL.includes(shellPath) ? shellPage(request, shellPath) : onlinePage(request));
  }
});

async function cacheFirstAsset(request) {
  const cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(ASSETS_CACHE)).put(request, response.clone());
  return response;
}

async function shellPage(request, shellPath) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(shellPath);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) cache.put(shellPath, await storable(response.clone()));
    return response;
  } catch {
    return offlineFallback(request);
  }
}

async function onlinePage(request) {
  try {
    return await fetch(request);
  } catch {
    return offlineFallback(request);
  }
}

async function offlineFallback(request) {
  const offline = await (await caches.open(SHELL_CACHE)).match("/offline");
  // Redirect rather than serve under another address: the router expects the page to match the URL.
  if (offline && new URL(request.url).pathname !== "/offline") return Response.redirect("/offline", 302);
  return offline || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
}
