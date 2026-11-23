import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it.each([
    ["/plans", "/plans"],
    ["/plans/123?tab=items#top", "/plans/123?tab=items#top"],
    ["/accept-invitation", "/accept-invitation"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["plans"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["https://evil.example/plans"],
    ["javascript:alert(1)"],
    ["/\t/evil.example"],
  ])("falls back for %s", (input) => {
    expect(safeNextPath(input)).toBe("/dashboard");
  });

  it("uses a custom fallback", () => {
    expect(safeNextPath("//x", "/sign-in")).toBe("/sign-in");
  });
});
