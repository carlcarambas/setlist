import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getArrangement, signedSheetUrl } from "@/features/library/queries";
import { getCurrentMember } from "@/lib/auth/member";

/**
 * Authorizes, then redirects to a short-lived signed URL. The PDF bytes come straight
 * from Supabase Storage and never pass through this server (spec §19 P2).
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/sheets/[arrangementId]">) {
  const member = await getCurrentMember();
  if (member?.status !== "active") {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const id = z.uuid().safeParse((await params).arrangementId);
  const arrangement = id.success ? await getArrangement(id.data) : null;
  if (!arrangement) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const download = request.nextUrl.searchParams.get("download") === "1";
  const url = await signedSheetUrl(arrangement.storage_path, download ? arrangement.original_filename : undefined);
  if (!url) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
