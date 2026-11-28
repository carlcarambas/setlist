import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { EventForm } from "@/components/events/event-form";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { getEvent } from "@/features/events/queries";
import { requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Edit event" };

export default function EditEventPage({ params }: PageProps<"/events/[id]/edit">) {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/events/[id]/edit">, "params">) {
  const member = await requireActiveMember();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const event = await getEvent(id.data, member);
  if (!event) notFound();

  return (
    <>
      <Link
        href={`/event?id=${event.id}`}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to event
      </Link>
      <h1 className="mb-8 text-[1.75rem] leading-tight font-medium md:text-3xl">Edit event</h1>
      <EventForm event={event} />
    </>
  );
}
