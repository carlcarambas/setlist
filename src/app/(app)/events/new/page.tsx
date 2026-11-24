import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EventForm } from "@/components/events/event-form";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { churchToday } from "@/features/events/queries";
import { requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <>
      <Link
        href="/events"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Events
      </Link>
      <PageHeader title="New event" description="Dates and times use the church's timezone." />
      <Suspense fallback={<SectionSkeleton />}>
        <NewEvent />
      </Suspense>
    </>
  );
}

async function NewEvent() {
  await requireActiveMember();
  return <EventForm defaultDate={await churchToday()} />;
}
