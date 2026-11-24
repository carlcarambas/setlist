import { z } from "zod";

export const sharePermissionSchema = z.enum(["viewer", "editor"]);
export type SharePermission = z.infer<typeof sharePermissionSchema>;

export const shareSchema = z.object({
  planId: z.uuid(),
  userId: z.uuid(),
  permission: sharePermissionSchema,
});

/** Link lifetimes offered in the share dialog (SHARE-07). */
export const LINK_EXPIRY_OPTIONS = [
  { value: "never", label: "Never expires" },
  { value: "1d", label: "Expires in 1 day" },
  { value: "7d", label: "Expires in 7 days" },
  { value: "30d", label: "Expires in 30 days" },
] as const;

export const linkExpirySchema = z.enum(["never", "1d", "7d", "30d"]);
export type LinkExpiry = z.infer<typeof linkExpirySchema>;

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS: Record<Exclude<LinkExpiry, "never">, number> = { "1d": 1, "7d": 7, "30d": 30 };

export function linkExpiresAt(expiry: LinkExpiry, now = new Date()): string | null {
  return expiry === "never" ? null : new Date(now.getTime() + DAYS[expiry] * DAY_MS).toISOString();
}

export type LinkState = "active" | "expired" | "revoked";

export function linkState(link: { expires_at: string | null; revoked_at: string | null }, now = new Date()): LinkState {
  if (link.revoked_at) return "revoked";
  if (link.expires_at && new Date(link.expires_at) <= now) return "expired";
  return "active";
}

/**
 * Member search text, made safe for a PostgREST `or=(…)` filter: characters with
 * meaning there (commas, parentheses, quotes, wildcards, backslashes) are dropped.
 */
export function memberSearchTerm(query: string) {
  return query.replace(/[,()"'*%_\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

/** Messages for the database function errors (see the sharing migration). */
export function shareErrorMessage(message: string | undefined) {
  switch (message) {
    case "member_unavailable":
      return "That member can't be added. They may be inactive or haven't accepted their invitation.";
    case "not_allowed":
      return "Only the plan's owner can manage sharing.";
    case "plan_not_found":
    case "share_not_found":
    case "link_not_found":
      return "This plan or share no longer exists. Reload the page.";
    case "invalid_expiry":
      return "Choose an expiry in the future.";
    default:
      return "That didn't work. Check your connection and try again.";
  }
}
