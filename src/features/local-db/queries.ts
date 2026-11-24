import { PAGE_SIZE, type LibrarySearch } from "@/features/library/schemas";
import type {
  LocalArrangement,
  LocalEvent,
  LocalPiece,
  LocalPlan,
  LocalProfile,
  LocalSettings,
  SetlistDB,
} from "./db";

/**
 * Read queries for member pages, against the device's database (spec v2 §4.5). Pure functions of the
 * database, so they're unit-tested with fake-indexeddb and wrapped in useLiveQuery by pages.
 */

const DEFAULT_SETTINGS: LocalSettings = { church_name: "Music Ministry", timezone: "Asia/Manila", updated_at: "" };

export async function getSettings(db: SetlistDB): Promise<LocalSettings> {
  return (await db.meta.get("settings"))?.value ?? DEFAULT_SETTINGS;
}

/** This device's own profile (role decides which buttons show; the server still enforces). */
export async function getSelf(db: SetlistDB): Promise<LocalProfile | null> {
  const userId = (await db.meta.get("self"))?.userId;
  return userId ? ((await db.profiles.get(userId)) ?? null) : null;
}

async function nameMap(db: SetlistDB) {
  const profiles = await db.profiles.toArray();
  return new Map(profiles.map((p) => [p.id, p.display_name]));
}

/** The version that changes when a PDF is replaced; keys the offline copy of the sheet. */
export function fileVersion(a: Pick<LocalArrangement, "updated_at">) {
  return String(new Date(a.updated_at).getTime());
}

const byTitle = (a: { title: string }, b: { title: string }) =>
  a.title.localeCompare(b.title, "en", { sensitivity: "base" });

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export async function searchLibrary(db: SetlistDB, search: LibrarySearch) {
  const q = search.q.toLocaleLowerCase();
  const [pieces, arrangements] = await Promise.all([db.music_pieces.toArray(), db.arrangements.toArray()]);
  const counts = new Map<string, number>();
  for (const a of arrangements) counts.set(a.music_piece_id, (counts.get(a.music_piece_id) ?? 0) + 1);

  const matches = pieces
    .filter((p) => search.archived || p.status === "active")
    .filter((p) => !q || p.title.toLocaleLowerCase().includes(q))
    .filter((p) => !search.category || p.category === search.category)
    .filter((p) => !search.tag || p.tags.includes(search.tag))
    .sort(byTitle);

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Math.min(search.page, pageCount);
  return {
    pieces: matches
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((p) => ({ ...p, arrangementCount: counts.get(p.id) ?? 0 })),
    total: matches.length,
    page,
    pageCount,
  };
}

export async function listCategories(db: SetlistDB) {
  const pieces = await db.music_pieces.where("status").equals("active").toArray();
  return [...new Set(pieces.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort();
}

export async function getSong(db: SetlistDB, id: string) {
  const piece = await db.music_pieces.get(id);
  if (!piece) return null;
  const [arrangements, names] = await Promise.all([
    db.arrangements.where("music_piece_id").equals(id).toArray(),
    nameMap(db),
  ]);
  return {
    ...piece,
    arrangements: arrangements
      .sort((a, b) => Number(a.status === "archived") - Number(b.status === "archived") || byTitle(a, b))
      .map((a) => ({ ...a, uploaderName: names.get(a.uploaded_by) ?? null, fileVersion: fileVersion(a) })),
  };
}

export async function getSheet(db: SetlistDB, arrangementId: string) {
  const arrangement = await db.arrangements.get(arrangementId);
  if (!arrangement) return null;
  const piece = await db.music_pieces.get(arrangement.music_piece_id);
  return piece ? { arrangement, piece, fileVersion: fileVersion(arrangement) } : null;
}

export async function listRecentMusic(db: SetlistDB, limit = 5) {
  return db.music_pieces
    .orderBy("created_at")
    .reverse()
    .filter((p) => p.status === "active")
    .limit(limit)
    .toArray();
}

/** Songs with their active sheets, for the plan editor's library panel. */
export function isPlayable(a: LocalArrangement, piece: LocalPiece | undefined) {
  return a.status === "active" && piece?.status === "active";
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export async function listPlans(db: SetlistDB, includeArchived: boolean, limit?: number) {
  const [plans, items, names] = await Promise.all([db.plans.toArray(), db.plan_items.toArray(), nameMap(db)]);
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.plan_id, (counts.get(i.plan_id) ?? 0) + 1);
  const list = plans
    .filter((p) => includeArchived || p.status !== "archived")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map((p) => ({ ...p, songCount: counts.get(p.id) ?? 0, editorName: names.get(p.updated_by) ?? null }));
  return limit ? list.slice(0, limit) : list;
}

export type PlanItemView = {
  id: string;
  arrangementId: string;
  notes: string | null;
  songTitle: string;
  arrangementTitle: string;
  musicalKey: string | null;
  bpm: number | null;
  fileVersion: string;
  unavailable: boolean;
};

export async function getPlan(db: SetlistDB, id: string) {
  const plan = await db.plans.get(id);
  if (!plan) return null;
  const [rows, names] = await Promise.all([db.plan_items.where("plan_id").equals(id).toArray(), nameMap(db)]);
  rows.sort((a, b) => a.position - b.position);

  const arrangements = await db.arrangements.bulkGet(rows.map((r) => r.arrangement_id));
  const pieces = await db.music_pieces.bulkGet(arrangements.map((a) => a?.music_piece_id ?? ""));
  const items: PlanItemView[] = rows.map((row, i) => {
    const a = arrangements[i];
    const piece = pieces[i];
    return {
      id: row.id,
      arrangementId: a?.id ?? "",
      notes: row.notes,
      songTitle: piece?.title ?? "Unknown song",
      arrangementTitle: a?.title ?? "",
      musicalKey: a?.musical_key ?? null,
      bpm: a?.bpm ?? null,
      fileVersion: a ? fileVersion(a) : "0",
      unavailable: !a || !isPlayable(a, piece),
    };
  });

  return { ...plan, items, editorName: names.get(plan.updated_by) ?? null };
}

export type LocalPlanView = NonNullable<Awaited<ReturnType<typeof getPlan>>>;

// ---------------------------------------------------------------------------
// Events (dates are calendar dates in the church timezone; `today` comes from todayIn())
// ---------------------------------------------------------------------------

const eventOrder = (a: LocalEvent, b: LocalEvent) =>
  a.event_date.localeCompare(b.event_date) || (a.start_time ?? "").localeCompare(b.start_time ?? "");

export async function listEvents(db: SetlistDB, today: string, past: boolean, limit?: number) {
  const [events, links] = await Promise.all([db.events.toArray(), db.event_plans.toArray()]);
  const counts = new Map<string, number>();
  for (const l of links) counts.set(l.event_id, (counts.get(l.event_id) ?? 0) + 1);
  const list = events
    .filter((e) => (past ? e.event_date < today : e.event_date >= today))
    .sort((a, b) => (past ? eventOrder(b, a) : eventOrder(a, b)))
    .map((e) => ({
      id: e.id,
      title: e.title,
      eventDate: e.event_date,
      startTime: e.start_time,
      planCount: counts.get(e.id) ?? 0,
      isPast: past,
    }));
  return limit ? list.slice(0, limit) : list;
}

export async function getEvent(db: SetlistDB, id: string, today: string) {
  const event = await db.events.get(id);
  if (!event) return null;
  const [links, names] = await Promise.all([db.event_plans.where("event_id").equals(id).toArray(), nameMap(db)]);
  links.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const plans = (await db.plans.bulkGet(links.map((l) => l.plan_id))).filter((p): p is LocalPlan => Boolean(p));
  const items = await db.plan_items.where("plan_id").anyOf(plans.map((p) => p.id)).toArray();
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.plan_id, (counts.get(i.plan_id) ?? 0) + 1);
  return {
    ...event,
    creatorName: names.get(event.created_by) ?? null,
    isPast: event.event_date < today,
    plans: plans.map((p) => ({ id: p.id, title: p.title, status: p.status, songCount: counts.get(p.id) ?? 0 })),
  };
}

/** Events a plan belongs to, soonest first. */
export async function listPlanEvents(db: SetlistDB, planId: string) {
  const links = await db.event_plans.where("plan_id").equals(planId).toArray();
  const events = (await db.events.bulkGet(links.map((l) => l.event_id))).filter((e): e is LocalEvent => Boolean(e));
  return events.sort(eventOrder);
}

/** Plans that can be added to an event (not archived), most recently updated first. */
export async function listAttachablePlans(db: SetlistDB) {
  const plans = await db.plans.filter((p) => p.status !== "archived").toArray();
  return plans.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((p) => ({ id: p.id, title: p.title }));
}
