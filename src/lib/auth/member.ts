import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Member = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "display_name" | "email" | "role" | "status"
>;

/**
 * The signed-in user's profile, or null when signed out. Reads the session cookie, so
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
    .select("id, display_name, email, role, status")
    .eq("id", userId)
    .maybeSingle();

  return data;
});

/** Redirects anyone who isn't an active member to the right place. */
export async function requireActiveMember(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) redirect("/sign-in");
  if (member.status === "invited") redirect("/accept-invitation");
  if (member.status !== "active") redirect("/auth/sign-out?reason=inactive");
  return member;
}

export async function requireAdmin(): Promise<Member> {
  const member = await requireActiveMember();
  if (member.role !== "admin") redirect("/dashboard");
  return member;
}
