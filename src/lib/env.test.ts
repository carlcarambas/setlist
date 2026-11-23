import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("parsePublicEnv", () => {
  it("accepts a complete environment and defaults the upload limit to 20 MB", () => {
    expect(parsePublicEnv(valid).NEXT_PUBLIC_MAX_UPLOAD_MB).toBe(20);
  });

  it("coerces a configured upload limit", () => {
    expect(parsePublicEnv({ ...valid, NEXT_PUBLIC_MAX_UPLOAD_MB: "10" }).NEXT_PUBLIC_MAX_UPLOAD_MB).toBe(10);
  });

  it("names every missing variable without echoing values", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_secretish" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SITE_URL/,
    );
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_secretish" })).not.toThrow(
      /secretish/,
    );
  });

  it("rejects a non-URL Supabase URL", () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });
});
