import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Member = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "display_name" | "role" | "status" | "is_anonymous"
> & {
  /** From the verified session; null for anonymous member devices. Profiles never expose emails. */
  email: string | null;
};

/**
 * The session's profile (an anonymous member device or an administrator), or null with no session. Reads the session cookie, so
 * callers must render inside a <Suspense> boundary. Deduplicated per request.
 */
export const getCurrentMember = cache(async (): Promise<Member | null> => {
  // Request-time only: session checks compare token expiry with the current time.
  await connection();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, role, status, is_anonymous")
    .eq("id", userId)
    .maybeSingle();

  return data ? { ...data, email: typeof claims.claims.email === "string" && claims.claims.email ? claims.claims.email : null } : null;
});

/** Any active session: a member device or an administrator. Sends everyone else to the right place. */
export async function requireActiveMember(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) redirect("/welcome");
  if (member.status === "invited") redirect("/accept-invitation");
  if (member.status !== "active") redirect("/auth/sign-out?reason=inactive");
  return member;
}

/** Administrators only; member devices are sent to the administrator sign-in. */
export async function requireAdmin(): Promise<Member> {
  const member = await requireActiveMember();
  if (member.role !== "admin" || member.is_anonymous) redirect("/sign-in");
  return member;
}

export function isAdmin(member: Member | null) {
  return member?.role === "admin" && !member.is_anonymous && member.status === "active";
}
