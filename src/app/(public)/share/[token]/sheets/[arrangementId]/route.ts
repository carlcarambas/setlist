import { NextResponse } from "next/server";
import { z } from "zod";
import { signedSheetUrl } from "@/features/library/queries";
import { getSharedSheet } from "@/features/sharing/queries";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A sheet opened through a view-only link. Re-validates the token and checks that the
 * link's plan uses this arrangement (SHARE-08), then redirects to a 10-minute signed URL.
 */
export async function GET(_request: Request, { params }: RouteContext<"/share/[token]/sheets/[arrangementId]">) {
  const { token, arrangementId } = await params;
  const id = z.uuid().safeParse(arrangementId);
  const sheet = id.success ? await getSharedSheet(token, id.data) : null;
  const url = sheet ? await signedSheetUrl(sheet.storagePath, undefined, createAdminClient()) : null;
  if (!url) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
