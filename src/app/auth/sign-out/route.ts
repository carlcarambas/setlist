import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Used when a deactivated member still has a session: clear it and explain why. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = request.nextUrl.searchParams.get("reason") === "inactive" ? "?reason=inactive" : "";
  return NextResponse.redirect(new URL(`/sign-in${reason}`, request.url));
}
