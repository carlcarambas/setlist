import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { UploadForm } from "@/components/music/upload-form";
import { getPiece } from "@/features/library/queries";
import { publicEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Add arrangement" };

export default function NewArrangementPage({ params }: PageProps<"/library/[id]/arrangements/new">) {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <NewArrangement params={params} />
    </Suspense>
  );
}

async function NewArrangement({ params }: Pick<PageProps<"/library/[id]/arrangements/new">, "params">) {
  await requireAdmin();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const piece = await getPiece(id.data);
  if (!piece) notFound();
  if (piece.status === "archived") redirect(`/song?id=${piece.id}`);

  return (
    <>
      <PageHeader title="Add arrangement" description={`A new sheet for “${piece.title}”.`} />
      <UploadForm maxMb={publicEnv().NEXT_PUBLIC_MAX_UPLOAD_MB} pieceId={piece.id} />
    </>
  );
}
