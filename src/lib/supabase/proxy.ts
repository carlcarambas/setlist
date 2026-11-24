import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session cookie before the request reaches the app, so Server
 * Components (which can't write cookies) always see a valid session.
 *
 * It also sends visitors without a session to /welcome, where the device becomes an anonymous
 * member (spec v2 §4.1). That's only an optimistic check: pages verify the session and role, and
 * RLS enforces them on every query.
 */

// Reachable without a session. Everything else needs one (anonymous or administrator).
const PUBLIC_PREFIXES = ["/welcome", "/sign-in", "/reset-password", "/auth/", "/offline", "/robots.txt"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}
export async function updateSession(request: NextRequest) {
  const env = publicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Auth-cookie responses must never be cached by a CDN.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Validates the JWT and refreshes it if expired. Don't put code between client creation
  // and this call.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && !isPublic(request.nextUrl.pathname)) {
    const welcome = request.nextUrl.clone();
    welcome.pathname = "/welcome";
    welcome.search = "";
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    if (next !== "/" && next !== "/dashboard") welcome.searchParams.set("next", next);
    const redirect = NextResponse.redirect(welcome);
    // Keep any cookie changes (e.g. a cleared expired session) on the redirect.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
