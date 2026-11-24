import { describe, expect, it } from "vitest";
import { arrangementSchema, fileSchema, librarySearchSchema, pieceSchema } from "./schemas";

describe("pieceSchema", () => {
  it("normalizes tags and blanks", () => {
    const r = pieceSchema.parse({ title: " Amazing Grace ", composer: "", category: " ", description: "", tags: "Hymn, easter , hymn," });
    expect(r).toEqual({ title: "Amazing Grace", composer: null, category: null, description: null, tags: ["hymn", "easter"] });
  });

  it("requires a title", () => {
    expect(pieceSchema.safeParse({ title: "  ", tags: "" }).success).toBe(false);
  });
});

describe("arrangementSchema", () => {
  it("parses an optional BPM", () => {
    expect(arrangementSchema.parse({ arrangementTitle: "Key of G", musicalKey: "G", bpm: "72", instrumentNotes: "" }).bpm).toBe(72);
    expect(arrangementSchema.parse({ arrangementTitle: "X", musicalKey: "", bpm: "", instrumentNotes: "" }).bpm).toBeNull();
  });

  it("rejects an impossible BPM", () => {
    expect(arrangementSchema.safeParse({ arrangementTitle: "X", musicalKey: "", bpm: "9000", instrumentNotes: "" }).success).toBe(false);
    expect(arrangementSchema.safeParse({ arrangementTitle: "X", musicalKey: "", bpm: "fast", instrumentNotes: "" }).success).toBe(false);
  });
});

describe("fileSchema", () => {
  const schema = fileSchema(20 * 1024 * 1024);
  it("accepts a PDF within the limit", () => {
    expect(schema.safeParse({ fileName: "grace.PDF", fileSize: 1000, sha256: null }).success).toBe(true);
  });
  it("rejects other extensions and oversized files", () => {
    expect(schema.safeParse({ fileName: "grace.docx", fileSize: 1000 }).success).toBe(false);
    expect(schema.safeParse({ fileName: "big.pdf", fileSize: 21 * 1024 * 1024 }).success).toBe(false);
  });
  it("drops a malformed hash instead of failing", () => {
    expect(schema.parse({ fileName: "a.pdf", fileSize: 1, sha256: "nope" }).sha256).toBeNull();
  });
});

describe("librarySearchSchema", () => {
  it("falls back to safe defaults for bad input", () => {
    expect(librarySearchSchema.parse({ page: "-3", archived: "yes" })).toEqual({ q: "", category: "", tag: "", archived: false, page: 1 });
  });
});

