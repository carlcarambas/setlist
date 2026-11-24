import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { PieceForm } from "@/components/music/edit-forms";
import { getPiece, listCategories } from "@/features/library/queries";
import { requireAdmin } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Edit music" };

export default function EditPiecePage({ params }: PageProps<"/library/[id]/edit">) {
  return (
    <>
      <PageHeader title="Edit music" />
      <Suspense fallback={<SectionSkeleton />}>
        <EditPiece params={params} />
      </Suspense>
    </>
  );
}

async function EditPiece({ params }: Pick<PageProps<"/library/[id]/edit">, "params">) {
  await requireAdmin();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [piece, categories] = await Promise.all([getPiece(id.data), listCategories()]);
  if (!piece) notFound();
  return <PieceForm piece={piece} categories={categories} />;
}
