/**
 * Returns `next` only if it is a same-site path, otherwise `fallback`.
 * Prevents open redirects through ?next= (e.g. "//evil.com", "/\evil.com", "https://evil.com").
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  try {
    const url = new URL(next, "http://setlist.invalid");
    if (url.origin !== "http://setlist.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
