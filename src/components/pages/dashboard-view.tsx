"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, ListMusic, Music, Plus, Upload } from "lucide-react";
import { EventDateLine } from "@/components/events/event-list";
import { PageHeader } from "@/components/layout/page-header";
import { LocalSkeleton, OnlineOnly } from "@/components/local/states";
import { relativeTime } from "@/components/plans/plan-status";
import { Button } from "@/components/ui/button";
import { localDb } from "@/features/local-db/db";
import { useChurchToday, useIsAdmin } from "@/features/local-db/hooks";
import { listEvents, listPlans, listRecentMusic } from "@/features/local-db/queries";
import { useLiveQuery } from "@/features/local-db/use-live-query";

const LIMIT = 5;

/** Spec v2 §4.6: upcoming events, recently updated plans, recent music, two quick actions. */
export function DashboardView() {
  const isAdmin = useIsAdmin();
  const today = useChurchToday();
  const data = useLiveQuery(async () => {
    if (!today) return undefined;
    const db = localDb();
    const [events, plans, music] = await Promise.all([
      listEvents(db, today, false, LIMIT),
      listPlans(db, false, LIMIT),
      listRecentMusic(db, LIMIT),
    ]);
    return { events, plans, music };
  }, [today]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Upcoming events, recent plans and new music."
        actions={
          <OnlineOnly>
            <Button asChild className="h-11 gap-2">
              <Link href="/plans">
                <Plus className="size-4" aria-hidden />
                New plan
              </Link>
            </Button>
            {isAdmin ? (
              <Button asChild variant="outline" className="h-11 gap-2">
                <Link href="/library/new">
                  <Upload className="size-4" aria-hidden />
                  Upload music
                </Link>
              </Button>
            ) : null}
          </OnlineOnly>
        }
      />
      {data === undefined ? (
        <LocalSkeleton />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Widget id="upcoming" title="Upcoming events" icon={CalendarDays} href="/events" empty="No upcoming events.">
            {data.events.map((e) => (
              <Row key={e.id} href={`/event?id=${e.id}`} title={e.title}>
                <EventDateLine eventDate={e.eventDate} startTime={e.startTime} /> · {e.planCount}{" "}
                {e.planCount === 1 ? "plan" : "plans"}
              </Row>
            ))}
          </Widget>
          <Widget id="plans" title="Recently updated plans" icon={ListMusic} href="/plans" empty="No plans yet.">
            {data.plans.map((p) => (
              <Row key={p.id} href={`/plan?id=${p.id}`} title={p.title}>
                {p.songCount} {p.songCount === 1 ? "song" : "songs"} · updated {relativeTime(p.updated_at)}
              </Row>
            ))}
          </Widget>
          <Widget id="music" title="Recently added music" icon={Music} href="/library" empty="No music in the library yet.">
            {data.music.map((m) => (
              <Row key={m.id} href={`/song?id=${m.id}`} title={m.title}>
                {m.composer ? `${m.composer} · ` : null}added {relativeTime(m.created_at)}
              </Row>
            ))}
          </Widget>
        </div>
      )}
    </>
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
