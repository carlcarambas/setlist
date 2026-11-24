const HEADER = "%PDF-";
const TRAILER = "%%EOF";

function containsAscii(bytes: Uint8Array, needle: string) {
  const text = new TextDecoder("latin1").decode(bytes);
  return text.includes(needle);
}

/**
 * Checks the actual bytes of an uploaded file, not its name or browser-reported type
 * (spec §4.2). A PDF starts with "%PDF-" (allowed within the first 1 KB) and ends with an
 * "%%EOF" marker, possibly followed by whitespace. Doesn't prove the file is well-formed;
 * it reliably rejects renamed images, Word documents, HTML pages and truncated uploads.
 */
export function looksLikePdf(head: Uint8Array, tail: Uint8Array): boolean {
  return containsAscii(head.subarray(0, 1024), HEADER) && containsAscii(tail, TRAILER);
}
