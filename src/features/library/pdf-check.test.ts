import { describe, expect, it } from "vitest";
import { looksLikePdf } from "./pdf-check";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("looksLikePdf", () => {
  it("accepts a PDF header and trailer", () => {
    expect(looksLikePdf(bytes("%PDF-1.7\n%âãÏÓ\n1 0 obj"), bytes("startxref\n1234\n%%EOF\n"))).toBe(true);
  });

  it("accepts a header after leading junk within the first kilobyte", () => {
    expect(looksLikePdf(bytes("\xEF\xBB\xBF%PDF-1.4"), bytes("%%EOF"))).toBe(true);
  });

  it("rejects a renamed image", () => {
    expect(looksLikePdf(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), bytes("IEND"))).toBe(false);
  });

  it("rejects an HTML page saved as .pdf", () => {
    expect(looksLikePdf(bytes("<!DOCTYPE html><html>"), bytes("</html>"))).toBe(false);
  });

  it("rejects a truncated upload with no end marker", () => {
    expect(looksLikePdf(bytes("%PDF-1.7\n"), bytes("stream\nxœ+T0"))).toBe(false);
  });
});
