import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays, ListMusic, Music, Plus, Upload } from "lucide-react";
import { EventDateLine } from "@/components/events/event-list";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { relativeTime } from "@/components/plans/plan-status";
import { Button } from "@/components/ui/button";
import { listEvents } from "@/features/events/queries";
import { listRecentMusic } from "@/features/library/queries";
import { listPlans } from "@/features/plans/queries";
import { isAdmin, requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Dashboard" };

const LIMIT = 5;

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Upcoming events, your recent plans and new music."
        actions={
          <Suspense fallback={<NewPlanAction />}>
            <QuickActions />
          </Suspense>
        }
      />
      <Suspense fallback={<SectionSkeleton />}>
        <Widgets />
      </Suspense>
    </>
  );
}

function NewPlanAction() {
  return (
    <Button asChild className="h-11 gap-2">
      <Link href="/plans">
        <Plus className="size-4" aria-hidden />
        New plan
      </Link>
    </Button>
  );
}

/** "Upload music" only for administrators (spec v2 §4.6). */
async function QuickActions() {
  const member = await requireActiveMember();
  return (
    <>
      <NewPlanAction />
      {isAdmin(member) ? (
        <Button asChild variant="outline" className="h-11 gap-2">
          <Link href="/library/new">
            <Upload className="size-4" aria-hidden />
            Upload music
          </Link>
        </Button>
      ) : null}
    </>
  );
}

async function Widgets() {
  await requireActiveMember();
  const [events, plans, music] = await Promise.all([
    listEvents({ past: false, limit: LIMIT }),
    listPlans(false, LIMIT),
    listRecentMusic(LIMIT),
  ]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Widget id="upcoming" title="Upcoming events" icon={CalendarDays} href="/events" empty="No upcoming events.">
        {events.map((e) => (
          <Row key={e.id} href={`/events/${e.id}`} title={e.title}>
            <EventDateLine eventDate={e.eventDate} startTime={e.startTime} /> · {e.planCount}{" "}
            {e.planCount === 1 ? "plan" : "plans"}
          </Row>
        ))}
      </Widget>
      <Widget id="plans" title="Recently updated plans" icon={ListMusic} href="/plans" empty="No plans yet.">
        {plans.map((p) => (
          <Row key={p.id} href={`/plans/${p.id}`} title={p.title}>
            {p.songCount} {p.songCount === 1 ? "song" : "songs"} · updated {relativeTime(p.updated_at)}
          </Row>
        ))}
      </Widget>
      <Widget id="music" title="Recently added music" icon={Music} href="/library" empty="No music in the library yet.">
        {music.map((m) => (
          <Row key={m.id} href={`/library/${m.id}`} title={m.title}>
            {m.composer ? `${m.composer} · ` : null}added {relativeTime(m.created_at)}
          </Row>
        ))}
      </Widget>
    </div>
  );
}

function Widget({
  id,
  title,
  icon: Icon,
  href,
  empty,
  children,
}: {
  id: string;
  title: string;
  icon: typeof Music;
  href: string;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <h2 id={`${id}-heading`} className="flex items-center gap-2 font-semibold">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </h2>
        <Link href={href} className="min-h-11 content-center text-sm underline underline-offset-4">
          View all<span className="sr-only"> {title.toLowerCase()}</span>
        </Link>
      </div>
      {children.length ? (
        <ul className="divide-y">{children}</ul>
      ) : (
        <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function Row({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <li className="relative px-4 py-3 hover:bg-accent/50">
      <Link href={href} className="font-medium after:absolute after:inset-0">
        {title}
      </Link>
      <p className="text-sm text-muted-foreground">{children}</p>
    </li>
  );
}
