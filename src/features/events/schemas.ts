import { z } from "zod";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function isRealDate(value: string) {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const eventSchema = z.object({
  title: z.string().trim().min(1, "Give the event a title.").max(200, "Use at most 200 characters."),
  description: z
    .string()
    .trim()
    .max(2000, "Use at most 2000 characters.")
    .optional()
    .transform((v) => v || null),
  eventDate: z.string().trim().refine(isRealDate, "Pick a date."),
  startTime: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || TIME.test(v), "Use a time like 09:30.")
    .transform((v) => (v ? v.slice(0, 5) : null)),
});

export const eventPlanSchema = z.object({ eventId: z.uuid(), planId: z.uuid() });

/** Today's calendar date (YYYY-MM-DD) in the church's timezone, not the browser's or server's. */
export function todayIn(timeZone: string, now: Date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** "Sun, Dec 6, 2026" — the stored date is a plain calendar date, so format it in UTC to avoid shifting it. */
export function formatEventDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "9:30 AM" from a stored "09:30:00". */
export function formatEventTime(time: string | null) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** Database errors when attaching a plan, as a message for the member. */
export function attachErrorMessage(code: string | undefined) {
  if (code === "23505") return "That plan is already part of this event.";
  if (code === "42501") return "Archived plans can't be added to an event.";
  return "The plan couldn't be added. Please try again.";
}
