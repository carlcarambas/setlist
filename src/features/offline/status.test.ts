import { describe, expect, it } from "vitest";
import {
  fitsInStorage,
  formatBytes,
  missingSheets,
  offlineStatus,
  removableSheets,
  totalBytes,
  type FileIndex,
  type SheetRef,
} from "./status";

const sheet = (id: string, version = "1", bytes = 1000): SheetRef => ({ arrangementId: id, version, bytes });
const files = (entries: [string, string, boolean?][]): FileIndex =>
  new Map(entries.map(([id, version, pinned]) => [id, { version, pinned: Boolean(pinned), bytes: 1000 }]));

describe("offlineStatus", () => {
  const plan = [sheet("a"), sheet("b"), sheet("a")];
  it("is none, partial, complete or outdated", () => {
    expect(offlineStatus(plan, files([]))).toBe("none");
    expect(offlineStatus(plan, files([["a", "1"]]))).toBe("partial");
    expect(offlineStatus(plan, files([["a", "1"], ["b", "1"]]))).toBe("complete");
    expect(offlineStatus(plan, files([["a", "1"], ["b", "0"]]))).toBe("outdated");
  });
  it("treats a plan with no sheets as nothing to show", () => {
    expect(offlineStatus([], files([]))).toBe("none");
    expect(offlineStatus([sheet("")], files([]))).toBe("none");
  });
});

describe("download size", () => {
  it("counts each missing or outdated sheet once", () => {
    const missing = missingSheets([sheet("a", "1", 100), sheet("b", "2", 200), sheet("b", "2", 200), sheet("c", "1", 300)], files([["a", "1"], ["b", "1"]]));
    expect(missing.map((s) => s.arrangementId)).toEqual(["b", "c"]);
    expect(totalBytes(missing)).toBe(500);
  });
});

describe("removableSheets", () => {
  it("keeps pinned sheets and sheets another kept plan needs", () => {
    const index = files([["a", "1"], ["b", "1", true], ["c", "1"], ["d", "1"]]);
    expect(removableSheets(["a", "b", "c", "x"], new Set(["c"]), index)).toEqual(["a"]);
  });
});

describe("fitsInStorage", () => {
  it("compares with free space minus a margin, and doesn't block when unknown", () => {
    expect(fitsInStorage(500, { quota: 1000, usage: 400 })).toBe(true);
    expect(fitsInStorage(590, { quota: 1000, usage: 400 })).toBe(false);
    expect(fitsInStorage(10 ** 12, null)).toBe(true);
    expect(fitsInStorage(10 ** 12, {})).toBe(true);
  });
});

describe("formatBytes", () => {
  it("formats KB, MB and GB", () => {
    expect(formatBytes(0)).toBe("0 KB");
    expect(formatBytes(1500)).toBe("1 KB");
    expect(formatBytes(4.2 * 1024 * 1024)).toBe("4.2 MB");
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1.50 GB");
  });
});
