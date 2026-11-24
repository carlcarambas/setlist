import { createHash, randomBytes } from "node:crypto";

/**
 * Public share-link tokens (spec §4.5): 32 random bytes, base64url (43 characters).
 * Only the SHA-256 hash is stored; the raw token is shown to the owner once.
 * Server-only in practice (node:crypto); kept free of "server-only" so it can be unit tested.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateLinkToken() {
  return randomBytes(32).toString("base64url");
}

export function hashLinkToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Rejects anything that can't be a token before touching the database. */
export function isLinkToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}
