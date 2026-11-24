import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { z } from "zod";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { SheetViewer } from "@/components/music/sheet-viewer";
import { Button } from "@/components/ui/button";
import { getArrangement, signedSheetUrl } from "@/features/library/queries";
import { requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Sheet" };

type Props = PageProps<"/sheets/[arrangementId]">;

export default function SheetPage({ params }: Props) {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <Sheet params={params} />
    </Suspense>
  );
}

async function Sheet({ params }: Pick<Props, "params">) {
  await requireActiveMember();
  const id = z.uuid().safeParse((await params).arrangementId);
  if (!id.success) notFound();
  const arrangement = await getArrangement(id.data);
  if (!arrangement || !arrangement.piece) notFound();

  // Created as the signed-in user, so Storage RLS checks access. Expires in 10 minutes;
  // the viewer loads the whole file right away.
  const url = await signedSheetUrl(arrangement.storage_path);
  if (!url) notFound();
  const title = `${arrangement.piece.title} — ${arrangement.title}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/library/${arrangement.piece.id}`}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {arrangement.piece.title}
          </Link>
          <h1 className="text-xl font-semibold">
            {arrangement.title}
            {arrangement.musical_key ? <span className="text-muted-foreground"> · Key of {arrangement.musical_key}</span> : null}
          </h1>
        </div>
        <Button asChild variant="outline" className="h-11 gap-2">
          <a href={`/api/sheets/${arrangement.id}?download=1`}>
            <Download className="size-4" aria-hidden />
            Download
          </a>
        </Button>
      </div>
      <SheetViewer file={url} title={title} />
    </>
  );
}
