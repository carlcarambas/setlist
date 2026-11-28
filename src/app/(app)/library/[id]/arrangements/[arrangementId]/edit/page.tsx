import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { ArchiveToggle, ArrangementForm, ReplaceFileForm } from "@/components/music/edit-forms";
import { SettingsSection } from "@/components/layout/settings-section";
import { getArrangement } from "@/features/library/queries";
import { formatFileSize } from "@/features/library/schemas";
import { publicEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Edit arrangement" };

type Props = PageProps<"/library/[id]/arrangements/[arrangementId]/edit">;

export default function EditArrangementPage({ params }: Props) {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <EditArrangement params={params} />
    </Suspense>
  );
}

async function EditArrangement({ params }: Pick<Props, "params">) {
  await requireAdmin();
  const id = z.uuid().safeParse((await params).arrangementId);
  if (!id.success) notFound();
  const arrangement = await getArrangement(id.data);
  if (!arrangement || !arrangement.piece) notFound();
  const archived = arrangement.status === "archived";

  return (
    <>
      <Link
        href={`/song?id=${arrangement.piece.id}`}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {arrangement.piece.title}
      </Link>
      <PageHeader
        title="Edit arrangement"
        description={`${arrangement.title} · ${arrangement.piece.title}`}
        actions={<ArchiveToggle kind="arrangement" id={arrangement.id} archived={archived} name={arrangement.title} />}
      />
      <div className="grid gap-12 md:gap-16">
        <SettingsSection title="Details">
          <ArrangementForm arrangement={arrangement} />
        </SettingsSection>
        <SettingsSection
          title="Replace PDF"
          description={`Current file: ${arrangement.original_filename} (${formatFileSize(arrangement.file_size_bytes)}). Plans that use this arrangement will show the new file.`}
        >
          <ReplaceFileForm arrangementId={arrangement.id} maxMb={publicEnv().NEXT_PUBLIC_MAX_UPLOAD_MB} />
        </SettingsSection>
      </div>
    </>
  );
}
