import { describe, expect, it } from "vitest";
import { planDetailsSchema, planEditError, reorderSchema } from "./schemas";

describe("planEditError", () => {
  it.each([
    ["version_conflict", "conflict"],
    ["plan_archived", "archived"],
    ["plan_not_found", "not_found"],
    ["item_not_found", "not_found"],
    ["not_allowed", "not_allowed"],
    ["arrangement_unavailable", "unavailable"],
    ["invalid_item_set", "invalid"],
    ["something else", "error"],
    [undefined, "error"],
  ])("maps %s to %s", (message, expected) => {
    expect(planEditError(message)).toBe(expected);
  });
});

describe("plan schemas", () => {
  const id = "6f1c1b2e-5a4d-4c3b-9a8f-0e1d2c3b4a59";
  it("trims and requires a title", () => {
    expect(planDetailsSchema.parse({ planId: id, expectedVersion: 3, title: " Easter ", description: "" }).title).toBe("Easter");
    expect(planDetailsSchema.safeParse({ planId: id, expectedVersion: 3, title: "  ", description: "" }).success).toBe(false);
  });
  it("rejects malformed reorder input", () => {
    expect(reorderSchema.safeParse({ planId: id, expectedVersion: 0, itemIds: [] }).success).toBe(false);
    expect(reorderSchema.safeParse({ planId: id, expectedVersion: 2, itemIds: ["x"] }).success).toBe(false);
  });
});
