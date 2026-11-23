import { describe, expect, it } from "vitest";
import {
  acceptInvitationSchema,
  appSettingsSchema,
  inviteMemberSchema,
  memberStatusSchema,
  signInSchema,
} from "./schemas";

describe("auth schemas", () => {
  it("normalizes email on sign-in", () => {
    const r = signInSchema.parse({ email: "  Ana@Example.COM ", password: "x" });
    expect(r.email).toBe("ana@example.com");
  });

  it("requires matching passwords of at least 8 characters", () => {
    const base = { displayName: "Ana", password: "longenough", confirmPassword: "longenough" };
    expect(acceptInvitationSchema.safeParse(base).success).toBe(true);
    expect(acceptInvitationSchema.safeParse({ ...base, confirmPassword: "different1" }).success).toBe(false);
    expect(
      acceptInvitationSchema.safeParse({ ...base, password: "short", confirmPassword: "short" }).success,
    ).toBe(false);
  });

  it("rejects a blank display name", () => {
    expect(inviteMemberSchema.safeParse({ email: "a@b.co", displayName: "   " }).success).toBe(false);
  });

  it("only allows active/inactive as a status change, with a real UUID", () => {
    const id = "6f1c1b2e-5a4d-4c3b-9a8f-0e1d2c3b4a59";
    expect(memberStatusSchema.safeParse({ userId: id, status: "inactive" }).success).toBe(true);
    expect(memberStatusSchema.safeParse({ userId: id, status: "invited" }).success).toBe(false);
    expect(memberStatusSchema.safeParse({ userId: "1", status: "active" }).success).toBe(false);
  });

  it("validates time zones", () => {
    expect(appSettingsSchema.safeParse({ churchName: "Grace", timezone: "Asia/Manila" }).success).toBe(true);
    expect(appSettingsSchema.safeParse({ churchName: "Grace", timezone: "Mars/Olympus" }).success).toBe(false);
  });
});
