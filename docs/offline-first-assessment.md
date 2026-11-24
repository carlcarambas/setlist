# Setlist: offline-first migration assessment

Status: assessment. Its decisions were adopted in `spec.md` v2.0 (approved 2026-11-24).
Date: 2026-11-24. Branch at the time: `milestone-5-events` (Milestones 0–5 built; M1 live, M2–M5 local only).

> The pasted requirement stops partway through section 3, after "1. Inspect the repository structure…" and
> "2". This assessment covers the whole migration; if section 3 had more specific questions, send the rest.

---

## 1. Summary

The new requirement changes two foundations of the current app:

1. **Who the user is.** Today, every page and every database rule assumes a signed-in, active member
   (`auth.uid()` appears 41 times in the migrations; 28 source files call `requireActiveMember` /
   `getCurrentMember`). The new model has anonymous members and signed-in admins.
2. **Where data lives.** Today, member pages are rendered on the server (Next.js Server Components and
   server actions) and read Supabase on every request. Offline-first needs those pages to render in
   the browser from a local database (IndexedDB) and sync in the background.

The library schema, upload pipeline, PDF viewer, design system and most UI components carry over. Sharing,
member accounts and the server-rendered member pages don't. Rough size: **the member-facing frontend is a
rewrite of its data layer; the database needs a new access model; admin features mostly stay.** Since only
Milestone 1 is live and the cloud database holds no real plans yet, **there is almost no production data
to migrate**: this is the cheapest moment to make the change.

Recommended approach: **keep Next.js, Supabase and Netlify.** Members get anonymous Supabase sessions, a
browser-rendered member area backed by IndexedDB, and a sync queue. Admin pages stay server-rendered and
online-only.

---

## 2. What exists today

| Area | Current implementation | Fate under offline-first |
|---|---|---|
| Auth | Email + password for everyone; invitations; `proxy.ts` sends signed-out visitors to `/sign-in` | Keep for **admins only**; members don't sign in |
| Members (M1) | `profiles` with role/status; admin invite, deactivate | Becomes **admin account management** |
| Library (M2) | Any active member uploads; server validates PDF; private bucket; 10-min signed URLs via `/api/sheets/[id]` | Read by everyone; **upload/replace/archive admin-only**; pipeline reused |
| Plans (M3) | Owner-based; RLS via `can_view_plan`/`can_edit_plan`; edits through SQL functions with a `version` check; drag-and-drop editor calls server actions | Data model and `version` check reused; **ownership and access rules replaced; editor rewired to a local store** |
| Offline (P9) | Hand-written `public/sw.js`; network-first cache of visited `/plans/<id>` HTML; PDFs in Cache Storage (`features/offline/sheets.ts`); cleared on sign-out | Extended into a full app-shell + IndexedDB design; PDF cache code reused |
| Sharing (M4) | Viewer/editor shares, Shared with Me, hashed view-only links | **Mostly obsolete** once all plans are visible to everyone (see decision D1) |
| Events (M5) | Events, attach plans, dashboard | **Not mentioned in the new spec** (decision D2) |
| Hosting | Next.js 16 on Netlify functions (SSR, server actions, proxy) | Stays; member pages move to the browser, which also **cuts Netlify function usage** |

---

## 3. Target architecture

### 3.1 Identity: anonymous sessions, not a shared password

- Each device gets a **Supabase anonymous sign-in** (`signInAnonymously()`) on first online visit. It's a
  real per-device user (`auth.uid()` works, the JWT has `is_anonymous: true`). There's no password, and
  no credentials ship in client code.
- RLS keeps working: "any session" (anonymous or admin) can read and edit plans; only `is_admin()` (a
  signed-in, non-anonymous admin) can change the library.
- **Abuse risk:** the app is on the public internet, so anyone who finds the URL becomes a "member."
  Supabase recommends a CAPTCHA (e.g. Cloudflare Turnstile, free) on anonymous sign-ins, plus its
  built-in rate limit. Even so, a stranger could vandalize plans. Mitigations: soft delete only, the
  existing activity log, and admin restore. See decision D3.
- An optional display name per device ("Who's editing?") keeps the activity log readable without accounts.

### 3.2 Rendering: an offline app shell

The hard technical constraint: **Next.js App Router pages that render on the server can't open offline.**
Client navigation also fetches a per-URL server payload, so a page never visited online (e.g. a new
`/plans/<uuid>`) can't be opened offline at all.

Plan:
- Member area = a small, **fixed set of client-rendered routes** with ids in the query string, e.g.
  `/library`, `/library/piece?id=…`, `/plans`, `/plan?id=…`, `/plan/edit?id=…`, `/sheet?id=…`. The service
  worker precaches exactly these shells and the JS they need, so every plan and song opens offline.
- Pages read from IndexedDB through a small data layer and re-render when sync brings new data.
- Admin area (`/admin/*`: uploads, replace, archive, metadata, admin accounts, settings) stays
  server-rendered with server actions; it's online-only and says so when offline.
- The existing hand-written service worker grows into: precache app shell on install, cache-first for
  hashed assets, shells served offline, versioned cache cleanup. (Serwist could generate the precache
  list; whether it supports this Next 16/Turbopack build needs checking first. Otherwise keep the
  hand-written worker and generate the list at build time.)

Alternative considered: a fully static export (SPA) with Supabase Edge Functions for the secret-key
work. It's cheaper on Netlify but drops server actions and `proxy.ts`, and moves upload validation and
admin actions to a new runtime. More churn for little gain, so not recommended now.

### 3.3 Local data (IndexedDB)

- One local database (Dexie is the pragmatic wrapper; it replaces a lot of hand-written IndexedDB code,
  so it passes constitution Principle I) with tables mirroring: `music_pieces`, `arrangements`, `plans`,
  `plan_items`, plus `outbox`, `sync_state` and `sheet_files` (download status and size).
- **Pull sync:** "everything changed since my last sync" per table, using `updated_at` plus
  **tombstones**. Today `plan_items` are hard-deleted, so deletions are invisible to a pull; they need
  `deleted_at` (or a deletions log). Archived music already uses status, which syncs fine.
- **Client-generated UUIDs** for plans and items, so a plan created offline keeps its id after sync
  (today `create_plan` returns a server id).

### 3.4 Offline edits and sync

- Every change made while offline (or online, same path) writes to IndexedDB first, then appends to an
  `outbox`. The UI never waits on the network.
- **Sync triggers:** app start, the `online` event, returning to the tab, and a timer with backoff.
  **iOS Safari has no Background Sync API**, so "automatic" means "next time the app is open and online."
- Per plan, the outbox collapses into one push: the plan's title, description and ordered items with
  notes, plus the **base version** it was edited from. A new SQL function, e.g.
  `sync_plan(id, base_version, snapshot)`, applies it in one transaction if the version still matches.
  This reuses M3's `version` / `bump_plan_version` idea.
- **Conflicts** (someone else saved first): the server rejects the push and returns its current copy.
  The app keeps the local edit and shows the plan as "needs attention", with three choices:
  **Keep theirs**, **Keep mine** (overwrites, logged) or **Save mine as a new plan**. Nothing is ever
  silently lost. Automatic item-level merging is possible later but not needed for v1.
- Idempotency: each push carries a client operation id, so a retry after a dropped connection doesn't
  apply twice.

### 3.5 Sheets offline, storage limits

- Reuse `features/offline/sheets.ts` (Cache Storage, keyed by arrangement + file version, so replaced
  PDFs refetch).
- Downloads: per sheet, per plan ("Make available offline"), and optionally the whole library with a
  size estimate first.
- Show status everywhere: *Available offline* / *Not downloaded* / *Update available* / *Failed — retry*.
- Storage: call `navigator.storage.persist()`, show usage from `navigator.storage.estimate()`, catch
  `QuotaExceededError`, and let members remove downloads. **Safari can evict site data after 7 days of
  not using the site unless it was added to the Home Screen**, so the app should prompt iOS users to
  install it.
- Sheet access: with no member login, signed URLs need only a valid anonymous session. The bucket stays
  private, so files aren't directly listable.

### 3.6 Database changes

- Library tables: read for any session; insert/update/archive only `is_admin()`. The member upload paths
  are removed.
- `plans`: replace `owner_id` semantics (anonymous creator id, or none), drop the owner-only rules; add
  `deleted_at`; keep `version` and `plan_activities`.
- `plan_items`: soft delete; client ids allowed on insert.
- `profiles`: admins only; anonymous users get no profile, or a minimal device row for the display name.
- `plan_shares`, `plan_links` and the public `/share/*` routes: drop if D1 says all plans are visible to
  everyone.
- `events` / `event_plans`: per D2.
- RLS: rewritten around `is_admin()` and "has a session". The pgTAP suite (167 tests) is kept as the
  safety net and updated per table.

---

## 4. Risks and costs

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **Sheet music becomes reachable by anyone on the internet** who finds the URL | Copyright and licensing exposure (e.g. CCLI terms usually cover the congregation, not the public) | Decide explicitly (D3). Options: accept with CAPTCHA + `noindex`; or require a per-device link from an admin (not a shared password) |
| R2 | Anyone can edit or delete plans | Vandalism, accidental overwrites | Soft delete, activity log, admin restore, conflict screen |
| R3 | Next.js App Router isn't designed for offline | Pages fail offline if built the normal way | Fixed set of client-rendered shells (§3.2); offline end-to-end tests |
| R4 | iOS Safari: no Background Sync, 7-day eviction for non-installed sites, tighter quotas | Sync waits for app open; downloads can disappear | Sync on open/online; install prompt; `persist()`; clear status badges |
| R5 | **Supabase egress**: every device downloading PDFs | Free plan has 5 GB/month. 30 devices × a 1 GB library is about 30 GB | Download per plan by default, not the whole library; Supabase Pro (250 GB) once in real use |
| R6 | Two people editing the same plan offline | Conflicts | Version check + 3-choice resolution (§3.4) |
| R7 | Scope | Largest change since M0 | Phased plan below; each phase is shippable |

Netlify impact is positive: member pages stop running server functions per view, which eases the credit
limit you hit this month.

---

## 5. Decisions

**Confirmed by the product owner on 2026-11-24:** D3 = yes (a publicly reachable library is acceptable);
D1, D2, D4, D5 and D6 follow the suggested defaults below.

| # | Question | Decision |
|---|---|---|
| D1 | Can every member edit **every** plan, or only plans made on their own device (others can view and duplicate)? | **Everyone edits everything**, as the new spec reads, with the activity log and conflict screen. Sharing (M4) is then removed. |
| D2 | Do **events** stay? If so, public and editable offline? | **Keep events read-only offline, editable online by anyone**; or drop them if the ministry won't use them. |
| D3 | Is it acceptable that the library is publicly reachable? | **Yes:** public, with CAPTCHA on anonymous sign-in and `noindex`. |
| D4 | Who can delete plans? | **Anyone can archive; only admins can permanently delete.** |
| D5 | Should edits show a name? | **Optional per-device display name** for the activity log. |
| D6 | What about M2–M5 not yet deployed? | **Don't deploy them as they are**; build the new access model on top first, so the old member-login flow never ships. |

---

## 6. Suggested phases

1. **Spec and constitution.** Write `spec.md` v2 from the new requirements and these decisions (the
   current `spec.md` stays the source of truth until you approve the change). The constitution's PWA
   principle already allows a service worker when the spec requires offline use; record the Dexie
   dependency in the plan's Complexity Tracking table.
2. **Access model (online only).** Anonymous sessions + CAPTCHA, admin-only library writes, RLS rewrite
   and pgTAP updates, remove member login, sharing and public links (per D1), admin account management.
   Shippable as a "no login" release.
3. **Local data and shell.** IndexedDB schema, pull sync for library and plans, client-rendered member
   routes, service-worker precache. Library and plans readable offline.
4. **Offline sheets.** Per-sheet and per-plan download, status badges, storage usage, quota and failure
   handling, iOS install prompt.
5. **Offline editing.** Client ids, outbox, `sync_plan` with version check, retries, conflict screen.
6. **Hardening.** Offline end-to-end tests (Playwright with the network turned off), real iOS Safari and
   Android Chrome checks, egress review, then the Supabase Pro decision and launch.

### What carries over

- Database: library tables, storage bucket and policies, PDF validation, `plan_items` ordering,
  `version`, `plan_activities`, `app_settings`.
- Code: upload flow (admin), PDF viewer (`react-pdf`), plan editor UI and drag-and-drop (rewired from
  server actions to the local store), offline PDF cache, layout and components, zod schemas.
- Tests: pgTAP harness and most library tests; Vitest setup.

### What is removed or replaced

- Member sign-in, invitations for members, member status checks in every page.
- Sharing with members, Shared with Me, view-only links (if D1 = everyone edits).
- Server-rendered member pages and their server actions.
- The sign-out cache clearing (no member sign-out).
