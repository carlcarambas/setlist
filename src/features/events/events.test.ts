import { describe, expect, it } from "vitest";
import { attachErrorMessage, eventSchema, formatEventDate, formatEventTime, todayIn } from "./schemas";

describe("eventSchema", () => {
  it("accepts a title and date, with optional time and description", () => {
    const parsed = eventSchema.parse({ title: " Sunday Service ", eventDate: "2026-12-06", startTime: "", description: "" });
    expect(parsed).toEqual({ title: "Sunday Service", eventDate: "2026-12-06", startTime: null, description: null });
  });

  it("keeps hours and minutes of a start time", () => {
    expect(eventSchema.parse({ title: "x", eventDate: "2026-12-06", startTime: "09:30:00" }).startTime).toBe("09:30");
  });

  it("rejects a missing title, impossible dates and bad times", () => {
    expect(eventSchema.safeParse({ title: " ", eventDate: "2026-12-06" }).success).toBe(false);
    expect(eventSchema.safeParse({ title: "x", eventDate: "2026-02-30" }).success).toBe(false);
    expect(eventSchema.safeParse({ title: "x", eventDate: "" }).success).toBe(false);
    expect(eventSchema.safeParse({ title: "x", eventDate: "2026-12-06", startTime: "25:00" }).success).toBe(false);
  });
});

describe("todayIn", () => {
  // 2026-12-05 20:00 UTC is already Dec 6 in Manila (UTC+8) but still Dec 5 in New York.
  const instant = new Date("2026-12-05T20:00:00Z");
  it("uses the church timezone", () => {
    expect(todayIn("Asia/Manila", instant)).toBe("2026-12-06");
    expect(todayIn("America/New_York", instant)).toBe("2026-12-05");
  });
  it("falls back to UTC for an unknown timezone", () => {
    expect(todayIn("Not/AZone", instant)).toBe("2026-12-05");
  });
});

describe("formatting", () => {
  it("shows the stored date without shifting it", () => {
    expect(formatEventDate("2026-12-06")).toBe("Sun, Dec 6, 2026");
  });
  it("shows times in 12-hour form", () => {
    expect(formatEventTime("09:30:00")).toBe("9:30 AM");
    expect(formatEventTime("18:00")).toBe("6:00 PM");
    expect(formatEventTime(null)).toBeNull();
  });
  it("explains attach failures", () => {
    expect(attachErrorMessage("23505")).toMatch(/already/);
    expect(attachErrorMessage("42501")).toMatch(/own or can edit/);
  });
});
