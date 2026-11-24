import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { UploadForm } from "@/components/music/upload-form";
import { listCategories } from "@/features/library/queries";
import { publicEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Add music" };

export default function NewMusicPage() {
  return (
    <>
      <PageHeader title="Add music" description="Upload a PDF sheet and describe the song." />
      <Suspense fallback={<SectionSkeleton />}>
        <NewMusicForm />
      </Suspense>
    </>
  );
}

async function NewMusicForm() {
  await requireAdmin();
  const categories = await listCategories();
  return <UploadForm maxMb={publicEnv().NEXT_PUBLIC_MAX_UPLOAD_MB} categories={categories} />;
}
