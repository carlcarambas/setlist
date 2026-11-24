/*
 * Setlist service worker: offline viewing of saved plans (spec §19 P9).
 *
 * - App code (/_next/static, icons): cache first. File names are content-hashed.
 * - Plan pages (/plans/<id>): network first; the last good copy is kept for offline use.
 * - Any other page while offline: the /offline page.
 * - PDF sheets are cached by the page itself (src/features/offline/sheets.ts).
 * Every cache name starts with "setlist-".
 */
const ASSETS = "setlist-assets-v1";
const PAGES = "setlist-pages-v1";
const KEEP = [ASSETS, PAGES, "setlist-sheets-v1"];
const OFFLINE_URL = "/offline";
const PLAN_PAGE = /^\/plans\/[0-9a-f-]{36}$/;

// Save the offline page and every script/stylesheet it needs, so it works with no network.
async function precacheOfflinePage() {
  const response = await fetch(new Request(OFFLINE_URL, { cache: "reload" }));
  if (!response.ok) return;
  const html = await response.clone().text();
  await (await caches.open(PAGES)).put(OFFLINE_URL, response);
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
  const cache = await caches.open(ASSETS);
  await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n.startsWith("setlist-") && !KEEP.includes(n)).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request, url));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirstPage(request, url) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    // Keep a copy of plan pages that rendered normally (not a redirect to sign-in).
    if (response.ok && !response.redirected && PLAN_PAGE.test(url.pathname)) {
      cache.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    const saved = await cache.match(url.pathname);
    if (saved) return saved;
    // Redirect rather than serve the offline page under another address: the app's
    // router expects the page to match the URL.
    if (url.pathname !== OFFLINE_URL && (await cache.match(OFFLINE_URL))) {
      return Response.redirect(OFFLINE_URL, 302);
    }
    return new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}
