import { describe, expect, it } from "vitest";
import { linkExpiresAt, linkState, memberSearchTerm } from "./schemas";
import { generateLinkToken, hashLinkToken, isLinkToken } from "./token";

describe("link tokens", () => {
  it("are 43 url-safe characters and differ every time", () => {
    const a = generateLinkToken();
    const b = generateLinkToken();
    expect(isLinkToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("hash to 64 lowercase hex characters, matching the database check", () => {
    expect(hashLinkToken("token-1")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashLinkToken("token-1")).toBe(hashLinkToken("token-1"));
  });

  it("rejects values that can't be tokens", () => {
    for (const bad of ["", "short", "a".repeat(44), `${"a".repeat(42)}/`, "../../etc/passwd", null, 42]) {
      expect(isLinkToken(bad)).toBe(false);
    }
  });
});

describe("link expiry", () => {
  const now = new Date("2026-11-24T10:00:00Z");

  it("computes the expiry from the chosen option", () => {
    expect(linkExpiresAt("never", now)).toBeNull();
    expect(linkExpiresAt("1d", now)).toBe("2026-11-25T10:00:00.000Z");
    expect(linkExpiresAt("30d", now)).toBe("2026-12-24T10:00:00.000Z");
  });

  it("reports revoked before expired", () => {
    expect(linkState({ expires_at: null, revoked_at: null }, now)).toBe("active");
    expect(linkState({ expires_at: "2026-11-24T09:59:59Z", revoked_at: null }, now)).toBe("expired");
    expect(linkState({ expires_at: "2026-11-24T09:59:59Z", revoked_at: "2026-11-20T00:00:00Z" }, now)).toBe("revoked");
  });
});

describe("member search", () => {
  it("drops characters that would change a PostgREST filter", () => {
    expect(memberSearchTerm("ana),role.eq.admin")).toBe("ana role.eq.admin");
    expect(memberSearchTerm("  50%_off*  ")).toBe("50 off");
    expect(memberSearchTerm("ana@church.org")).toBe("ana@church.org");
  });
});
