# Setlist — Music Ministry Planning Platform
## Product Requirements & Technical Specification

**Document status:** Approved baseline (2026-11-24). Replaces v1.0, kept at [`docs/spec-v1.md`](docs/spec-v1.md).  
**Version:** 2.0 (offline-first)  
**Date:** 2026-11-24  
**Product name:** Setlist (working name)  
**Primary platform:** Installable Progressive Web App (desktop, tablet, mobile)  
**Initial organization model:** One church / one music ministry  
**Primary users:** Music ministry members (no login) and administrators (login)

**What changed from v1.0:**
- Members no longer sign in; only administrators do.
- The app must work offline on each device.
- Only administrators change the music library.
- Everyone can view and edit every plan, so member sharing and public links are removed.
- v1.0 amendments P1–P9 are folded into the text below where they still apply.
- Rationale: [`docs/offline-first-assessment.md`](docs/offline-first-assessment.md).

---

## 1. Product Summary

Setlist is a web application for a church music ministry. It keeps the ministry's PDF music sheets in one
library and lets members build music plans (setlists), reorder songs, and link plans to church events.
It works **without an internet connection** on any device where it was used before. Members don't need
an account; administrators sign in to manage the library.

### 1.1 Product vision

> Plan the music. Share the setlist. Serve together. Even offline.

### 1.2 Goals

1. Maintain one searchable music library, curated by administrators.
2. Let anyone in the ministry open Setlist, find songs and view sheets without signing in.
3. Let members create, edit and reorder plans, together, with no accounts.
4. Keep plans and downloaded sheets usable with no internet connection.
5. Sync offline changes automatically and never lose a member's edit silently.
6. Work on desktop, tablet and mobile browsers from one installable app.
7. Keep infrastructure and maintenance costs low for a solo developer.

### 1.3 Non-goals

Do not implement these unless explicitly approved:

- Native iOS or Android applications
- A local church server, LAN sync or peer-to-peer sync between devices
- Member accounts, a shared ministry password, or credentials in client code
- Per-plan sharing, permissions or public share links
- Multi-church tenant administration
- Musician or instrument assignment, rehearsal scheduling
- Chat, comments, push notifications
- Real-time multiplayer editing / live cursors
- Automatic item-level merging of conflicting plan edits
- Chord transposition, AI recommendations, sheet music generation
- Payments or subscriptions

---

## 2. Product Decisions

These decisions are confirmed and are requirements:

| Area | Decision |
|---|---|
| Organization scope | Single church / music ministry |
| Member access | No login. Each device gets an anonymous identity automatically |
| Administrator access | Email + password login; administrators are invited by another administrator |
| Library reachability | Publicly reachable by anyone with the address; protected against bots, not hidden (D3) |
| Music library changes | Administrators only (upload, replace, archive, delete, metadata) |
| Music format | PDF |
| Plans | Everyone can view, create, edit, reorder and archive every plan (D1) |
| Plan deletion | Anyone archives; only administrators permanently delete (D4) |
| Events | Kept. Viewable offline; created and edited online by anyone; deleted by administrators (D2) |
| Attribution | Optional display name per device, shown in plan activity (D5) |
| Offline | Per device only. App shell, library metadata, plans and downloaded sheets work offline |
| Sync | Automatic when online, retried on app start; conflicts are resolved by the member, never silently |
| Platform | Installable PWA, one codebase |
| Budget | Free tiers during development; low recurring production cost |
| Architecture | Simple modular application; no microservices |

---

## 3. Users and Permissions

### 3.1 User types

**Member (anonymous device)**
- Opens Setlist with no sign-in. On first online visit, the app creates an anonymous identity for the
  device in the background.
- Browses and searches the library; views and downloads sheets.
- Views, creates, edits, reorders and archives any plan; duplicates plans.
- Views events; creates and edits events while online; attaches plans to events while online.
- Can set an optional display name for this device.
- Works offline with everything previously synced or downloaded on this device.

**Administrator**
- Signs in with email and password.
- Has every member capability.
- Uploads, replaces, archives, restores and permanently deletes music pieces and arrangements; edits
  library metadata.
- Permanently deletes plans and events; restores archived plans.
- Invites, deactivates and reactivates administrator accounts.
- Manages application settings (church name, timezone, upload limit).
- Can block a misbehaving device identity (Should).

### 3.2 Capability matrix

| Capability | Member | Administrator | Offline? |
|---|---:|---:|---:|
| Browse/search library, view sheets | Yes | Yes | Yes (synced metadata, downloaded sheets) |
| Download sheets for offline use | Yes | Yes | No (needs a connection) |
| Upload, replace, archive, delete music; edit metadata | No | Yes | No |
| View plans | Yes | Yes | Yes |
| Create, edit, reorder plans; edit item notes | Yes | Yes | Yes (queued) |
| Duplicate plan | Yes | Yes | Yes (queued) |
| Archive / restore plan | Yes | Yes | Yes (queued) |
| Permanently delete plan | No | Yes | No |
| View events | Yes | Yes | Yes (read-only) |
| Create/edit events, attach/detach plans | Yes | Yes | No |
| Delete events | No | Yes | No |
| Manage administrators and settings | No | Yes | No |

### 3.3 Administrator lifecycle

- Administrators join only by invitation from an existing administrator. The first administrator is
  created through a documented setup step.
- Deactivated administrators lose administrator access immediately for data (RLS checks status on
  every query) and cannot sign in again. Their device continues as an ordinary member.
- An administrator cannot deactivate themselves; at least one active administrator must remain.
- Records created by a deactivated administrator remain intact.

---

## 4. Functional Requirements

Priority: **Must** = required for release; **Should** = important, may follow; **Could** = optional.

### 4.1 Access and administrator accounts

| ID | Requirement | Priority |
|---|---|---|
| ACC-01 | Members use Setlist with no sign-in, online and offline | Must |
| ACC-02 | Each device gets an anonymous identity automatically on first online use | Must |
| ACC-03 | Anonymous identity creation is protected by a CAPTCHA and rate limits | Must |
| ACC-04 | Members can set an optional device display name | Should |
| ACC-05 | Administrators sign in and sign out | Must |
| ACC-06 | Administrators reset forgotten passwords | Must |
| ACC-07 | Administrators invite, deactivate and reactivate administrators | Must |
| ACC-08 | Library changes and admin pages are refused to non-administrators, on the server and in the database | Must |
| ACC-09 | Administrators can block a device identity | Should |
| ACC-10 | No shared password; no secret or privileged key in client code | Must |

Use managed authentication (Supabase Auth, including its anonymous sign-ins). Do not build password
storage or authentication cryptography.

When an administrator signs out on a device, the device returns to being an anonymous member and keeps
its offline data.

### 4.2 Music library

| ID | Requirement | Priority |
|---|---|---|
| LIB-01 | Administrators upload PDF music sheets | Must |
| LIB-02 | Music title is required | Must |
| LIB-03 | Everyone can search by title, online and offline | Must |
| LIB-04 | Everyone can view music details | Must |
| LIB-05 | Everyone can view PDFs in the app | Must |
| LIB-06 | Everyone can download PDFs (to the device and as a file) | Must |
| LIB-07 | Administrators edit music metadata | Must |
| LIB-08 | Administrators archive and restore music | Must |
| LIB-09 | A music piece can have multiple arrangements | Must |
| LIB-10 | An arrangement can specify a musical key and BPM | Should |
| LIB-11 | An arrangement can have instrument/arrangement notes | Should |
| LIB-12 | Everyone can filter by category or tags | Should |
| LIB-13 | Possible duplicate uploads are flagged to the administrator | Should |
| LIB-14 | Uploader and timestamps are recorded | Must |
| LIB-15 | Administrators replace an arrangement PDF without breaking plans that use it | Should |
| LIB-16 | Administrators permanently delete music that no plan uses | Could |

**Music piece vs. arrangement.** A `MusicPiece` is the song; an `Arrangement` is one specific sheet of it
(for example "Amazing Grace — Key of G"). A plan item references an arrangement.

**Music piece fields:** title; composer/artist; description; category; tags; status (active, archived);
created by/at; updated by/at.

**Arrangement fields:** music piece; title; musical key; BPM; notes; private storage path; original
filename; file size; MIME type; content SHA-256; file version (changes on replacement); status (pending,
active, archived); uploaded by/at; updated at.

**Library rules**
- Prefer archive over deletion. Music used by any plan must not be permanently deleted.
- Archived music stays readable inside existing plans but can't be added to plans.
- Replacing a PDF keeps the arrangement's identity and changes its file version.
- Uploads go directly from the browser to private storage through a server-issued signed upload URL.
  The server then checks the stored bytes (`%PDF-` header, `%%EOF` trailer, size limit) before
  activating the arrangement. Unchecked uploads stay `pending` and are cleaned up.
- Upload size limit is configurable (default 20 MB).

### 4.3 Plans

| ID | Requirement | Priority |
|---|---|---|
| PLAN-01 | Everyone can create multiple plans, online or offline | Must |
| PLAN-02 | Plan title is required | Must |
| PLAN-03 | Plan description is optional | Should |
| PLAN-04 | The plan editor can search the library (offline: synced metadata) | Must |
| PLAN-05 | Add a selected arrangement to a plan | Must |
| PLAN-06 | Remove a plan item | Must |
| PLAN-07 | Reorder items with drag and drop (and an accessible alternative) | Must |
| PLAN-08 | Open the selected sheet from the plan | Must |
| PLAN-09 | Changes save on the device immediately and sync reliably | Must |
| PLAN-10 | Duplicate a plan | Should |
| PLAN-11 | Archive and restore a plan | Should |
| PLAN-12 | Notes on a plan item | Should |
| PLAN-13 | Show who (device display name) and when a plan was last updated | Should |
| PLAN-14 | Record activity for important changes | Should |

**Plan fields:** id (generated on the device); title; description; status (draft, published, archived;
`published` is a label only); version; created by/at; updated by/at; deleted at (administrator delete).

**Plan item fields:** id (generated on the device); plan; arrangement; position; notes; added by;
created at; updated at; removed at (tombstone, so removals sync).

A plan can exist without an event. Every plan is visible to everyone.

**Ordering rules**
- Position determines the visible order. A reorder is saved as one change containing the full order.
- The server verifies that every item belongs to the plan.

**Save states.** Each plan shows one of: *Saved on this device*, *Syncing…*, *Synced*, *Waiting for
connection*, *Sync failed — retrying*, *Needs your attention* (conflict). Unsynced input is never
discarded.

### 4.4 Events

| ID | Requirement | Priority |
|---|---|---|
| EVT-01 | Members can create events (online) | Must |
| EVT-02 | Event title is required | Must |
| EVT-03 | Event date is required | Must |
| EVT-04 | Event time is optional | Should |
| EVT-05 | Event description is optional | Should |
| EVT-06 | An event can have multiple plans; a plan can belong to multiple events | Must |
| EVT-07 | A plan can exist without an event | Must |
| EVT-08 | Everyone can view upcoming and past events, including offline | Must |
| EVT-09 | Duplicate an event | Could |
| EVT-10 | Only administrators delete events; deleting removes only the associations | Must |

Event fields: id, title, description, event date, start time, created by/at, updated at. Dates are
calendar dates in the church's configured timezone (`app_settings.timezone`, default `Asia/Manila`);
"upcoming" and "past" are computed in that timezone, never the device's.

Creating or editing events and attaching plans require a connection. A plan created offline can be
attached once it has synced.

### 4.5 Offline use and sync

| ID | Requirement | Priority |
|---|---|---|
| OFF-01 | Installable PWA (web app manifest + service worker) | Must |
| OFF-02 | The app shell opens with no connection on any device where it was opened before | Must |
| OFF-03 | Library metadata, plans and events are stored on the device (IndexedDB) and kept in sync | Must |
| OFF-04 | Members can download a sheet, all sheets of a plan, or (Should) the whole library | Must |
| OFF-05 | Every song, plan and sheet shows whether it is available offline | Must |
| OFF-06 | Plans can be created and edited offline; changes are queued | Must |
| OFF-07 | Queued changes sync automatically when the connection returns, on app start and on a retry timer | Must |
| OFF-08 | Conflicting edits are detected and resolved by the member; nothing is overwritten silently | Must |
| OFF-09 | Storage usage is shown; full storage and failed downloads are reported with a retry | Must |
| OFF-10 | The app asks the browser for persistent storage and suggests installing on iOS | Should |
| OFF-11 | Members can remove downloaded sheets and clear offline data, warned about unsynced changes | Should |
| OFF-12 | A new app version is offered with "Reload to update" and never drops queued changes | Must |

**What the device keeps**
- App shell: every page needed for the member area, precached by the service worker.
- Metadata: all active and archived music pieces and arrangements (no PDFs), all non-deleted plans and
  items, events and event associations, app settings. A library of a few thousand songs is small.
- Sheets: only the PDFs the member downloaded, or opened (opened sheets are kept), keyed by arrangement
  and file version.

**Sync rules**
- Pull: fetch everything changed since the device's last sync, per table, including tombstones and
  status changes. First sync downloads all metadata.
- Push: local changes are written to IndexedDB first, then to an outbox. Per plan, pending changes are
  sent as one snapshot (title, description, status, ordered items with notes) with the version the
  member started from and a unique change id, so a retry never applies twice.
- The server applies the snapshot in one transaction only if the plan's version still matches, then
  increments the version and records activity.
- Triggers: app start, the browser coming online, returning to the app, and a timer with backoff.
  Background sync while the app is closed is not required (iOS Safari doesn't support it).

**Conflict resolution**
- If another device saved the plan first, the push is refused and the device receives the current
  server copy. The plan is marked *Needs your attention* and the member chooses:
  1. **Keep theirs**: discard my offline changes to this plan.
  2. **Keep mine**: replace the server copy with mine (recorded in activity).
  3. **Save mine as a new plan**: keep both.
- If the plan was archived elsewhere, the choices are **Restore with my changes** or **Save mine as a
  new plan**. If it was permanently deleted by an administrator, only **Save mine as a new plan**.
- An arrangement archived or replaced while a device was offline keeps working from the downloaded
  copy; the app shows *Archived* or *Newer version available*.

**Storage limits**
- Show used and available space (`navigator.storage.estimate()` where supported).
- Before a bulk download, show its total size and check it fits.
- On a full disk or failed download: stop, keep what succeeded, report which sheets failed, offer retry.
- Safari may remove data of sites not used for 7 days unless installed to the Home Screen; the app
  explains this once on iOS.

### 4.6 Dashboard

- Upcoming events
- Recently updated plans
- Recently added music
- Unsynced changes and conflicts (only when there are any)
- Quick action: create a plan
- Quick action (administrators): upload music

Keep it focused; no charts or administrative metrics.

---

## 5. Main User Journeys

### 5.1 Prepare a phone for Sunday
1. Member opens the Setlist address (online), optionally installs it.
2. The library, plans and events sync in the background.
3. Member opens the Sunday plan and taps **Make available offline**; the plan's sheets download with
   progress shown.
4. At church with no signal, the member opens Setlist from the Home Screen, opens the plan and swipes
   through the sheets.

### 5.2 Build a plan offline
1. Member creates a plan with no connection; it shows *Saved on this device*.
2. Member searches the synced library, adds arrangements and reorders them.
3. When the phone is back online, the plan syncs and shows *Synced*.

### 5.3 Two members edit the same plan
1. Two members change the same plan while offline.
2. The first to reconnect syncs normally.
3. The second sees *Needs your attention*, compares, and chooses Keep theirs / Keep mine / Save as new.

### 5.4 Administrator uploads music
1. Administrator signs in, opens the library and chooses **Add music**.
2. Uploads a PDF, enters the title and optional metadata, saves.
3. The server validates the file; the song appears in everyone's library at their next sync.

---

## 6. Application Pages and Navigation

### Primary navigation
- Home (dashboard)
- Library
- Plans
- Events
- Settings (device name, offline storage, install, administrator sign-in)

Administrators also see: Add music, Administrators, Application settings.

### Screens

| Screen | Purpose | Offline |
|---|---|---|
| Home | Overview, sync status, quick actions | Yes |
| Library | Search and browse | Yes |
| Music details | Arrangements, sheet viewer, download | Yes (downloaded sheets) |
| Sheet viewer | Full-width PDF view | Yes (downloaded sheets) |
| Plans | All plans, with offline availability and sync state | Yes |
| Plan details | Read view, "Make available offline" | Yes |
| Plan editor | Search, add, remove, reorder, notes | Yes |
| Conflict resolution | Compare and choose | Yes |
| Events / Event details | Upcoming and past; plans per event | Yes (read-only) |
| Settings | Device name, storage, remove data, install, sign in | Yes (sign-in needs a connection) |
| Administrator sign-in / reset password / accept invitation | Administrator auth | No |
| Add/Edit music, Administrators, Application settings | Administration | No; says so when offline |

### Plan editor UX
- Desktop: ordered setlist in the main area, searchable library in a side panel; header with title,
  events, save/sync state.
- Mobile: tabs or stacked panels; touch-friendly targets; reorder by drag and by move up/down.
- Song row: drag handle, order, title, arrangement/key, offline badge, view sheet, remove.

### Design principles
- Mobile-first, restrained, readable on stage (large title and key).
- Clear offline, sync, loading, error and empty states; never only color.
- Keyboard accessible; respects reduced motion.

---

## 7. Technical Architecture

### 7.1 Architecture decision

A **Next.js modular monolith with Supabase**, unchanged, with:
- a **browser-rendered member area** that reads from IndexedDB and syncs with Supabase directly through
  supabase-js under RLS, and
- a **server-rendered administrator area** (server actions and route handlers) for privileged,
  online-only work.

No NestJS, no microservices, no local server.

### 7.2 Stack

| Layer | Technology |
|---|---|
| Web framework | Next.js (App Router) |
| Language | TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Validation | Zod |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth (anonymous sign-ins for members, email/password for administrators) |
| Bot protection | Cloudflare Turnstile (free) through Supabase Auth's CAPTCHA support |
| File storage | Supabase Storage (private bucket) |
| Local database | IndexedDB through Dexie |
| Offline shell and assets | Service worker (hand-written or generated; decided in the plan) |
| PDF viewing | PDF.js / react-pdf |
| Drag and drop | dnd-kit |
| Hosting | Railway (Node.js server running `next start`) |
| Source control | GitHub |

### 7.3 High-level architecture

```text
Device (browser / installed PWA)
  Service worker: app shell + assets
  IndexedDB: library metadata, plans, events, outbox, sync state
  Cache Storage: downloaded PDFs
  Member pages (client-rendered) ──── read/write local data
        |  sync engine (when online)
        v
  Supabase: Auth (anonymous + admin) · PostgreSQL (RLS) · Storage (private)
        ^
        |  admin pages, uploads, admin actions (server-side, online only)
  Next.js on Railway
```

### 7.4 Rules

- Member pages must render entirely from local data, with ids in the query string, so a fixed set of
  precached pages can open any plan, song or event offline.
- Privileged work (upload validation, administrator management, permanent deletes, storage cleanup)
  runs on the server. The secret key never reaches the browser.
- RLS is the security boundary for everything the browser does directly. Never rely on UI checks.
- Plan writes from the browser go through one SQL function (`sync_plan`) that checks the version.

### 7.5 Source structure (target)

```text
src/
  app/
    (member)/        client-rendered, precached: home, library, plan, plans, events, sheet, settings
    (admin)/         server-rendered: music upload/edit, administrators, application settings
    (auth)/          administrator sign-in, reset, accept invitation
    api/             route handlers (upload finalization, sheet URLs)
  components/
  features/
    local-db/        Dexie schema and queries
    sync/            pull, outbox, push, conflicts
    offline/         sheet downloads, storage estimates
    library/  plans/  events/  admin/
  lib/supabase/
public/sw.js
supabase/migrations, supabase/tests
```

---

## 8. Database Specification

PostgreSQL with UUID primary keys. Ids for plans and plan items may be generated on the device.

### 8.1 Tables

- **profiles**: one per auth user. `role` (member, admin), `status` (active, inactive), optional
  `display_name`, `email` (administrators only), `is_anonymous`, timestamps.
- **music_pieces**: as §4.2, plus `tags text[]`, `updated_at` index for sync.
- **arrangements**: as §4.2, including `content_sha256` and status `pending|active|archived`.
- **plans**: as §4.3, with `version`, `updated_at`, `deleted_at`.
- **plan_items**: as §4.3, with `removed_at`; unique active position per plan.
- **events**: as §4.4.
- **event_plans**: event, plan, position, created at; unique (event, plan); cascade on event delete.
- **plan_activities**: plan, actor, action, metadata, created at. Actions: plan created/updated,
  item added/removed, reordered, archived/restored, duplicated, conflict overwritten.
- **sync_changes** (or equivalent): applied change ids for idempotent pushes.
- **app_settings**: single row: church name, timezone, upload size limit.

Removed from v1: `plan_shares`, `plan_links`.

### 8.2 Database rules
- Foreign keys and indexes; `updated_at` indexed on every synced table.
- Soft delete or tombstones for everything that syncs, so deletions reach devices.
- Multi-row changes (plan snapshot, reorder) are transactional SQL functions.
- Only active arrangements of active pieces can be newly added to plans.
- Optimistic concurrency on plans through `version`.

### 8.3 Future organization support
Unchanged: one church now; keep an `organization_id` easy to add later.

---

## 9. File Storage and PDF Security

- Private bucket `music-sheets`, object path `{music_piece_id}/{arrangement_id}/{file}.pdf`.
- Reading requires a valid session (anonymous or administrator); the app gets short-lived signed URLs
  through a route that authorizes and redirects (it never streams PDF bytes through the app server).
- Writing requires an active administrator.
- Downloaded copies live in the device's Cache Storage, keyed by arrangement and file version.
- Backups: scheduled database dump and storage copy off-site; restoration tested once before launch.

---

## 10. Authorization and RLS

RLS is mandatory on every table and storage object. The `anon` role (no session) gets no table access.

| Data | Read | Write |
|---|---|---|
| profiles | Own row; administrators all; display names readable by any session | Own `display_name`; administrators change role/status |
| music_pieces, arrangements, storage writes | Any session | Active administrators only |
| plans, plan_items | Any session (except permanently deleted) | Any session through `sync_plan` / plan functions; permanent delete administrators only |
| events, event_plans | Any session | Any session creates/edits/attaches; delete administrators only |
| plan_activities | Any session | Written by SQL functions only |
| app_settings | Any session | Administrators only |

**Security requirements**
- Blocked device identities and deactivated administrators lose write access immediately.
- Never trust ids from the browser for authorship; take them from the verified session.
- Validate every mutation in SQL functions or server code.
- Test with pgTAP: no-session access, anonymous member, administrator, deactivated administrator,
  blocked device, version conflicts, idempotent retries.
- Pages are `noindex`; `robots.txt` disallows crawling.

---

## 11. Server Operations

**Browser → Supabase (RLS):** pull changes; `sync_plan(id, base_version, snapshot, change_id)`;
duplicate plan; archive/restore plan; create/update event; attach/detach plan; set display name;
request a sheet URL.

**Next.js server (administrator, online only):** prepare upload / finalize upload / replace PDF;
update music metadata; archive, restore, delete music; permanently delete plan or event; invite,
deactivate, reactivate administrators; block device; update application settings; storage cleanup.

Every server operation validates input with Zod, verifies the session and role, performs the change
safely, and returns a minimal typed result.

---

## 12. Hosting and Budget

- Hosting on Railway (changed from Netlify on 2026-11-24 for cost): one always-on Node.js service, billed
  by usage. Set a usage limit. Supabase Free and GitHub Free during development; Supabase Pro (about
  US$25/month) once the ministry relies on it (backups, no pausing, 250 GB egress).
- **Egress:** every download of a sheet counts against Supabase egress (Free: 5 GB/month). Default to
  downloading per plan; show sizes before bulk downloads; review monthly.
- The browser-rendered member area keeps the app server's CPU and bandwidth use low.
- Custom SMTP is still required for administrator invitations and password resets.
- Prices change; check the providers' pricing pages before subscribing.

---

## 13. Non-functional Requirements

| Area | Requirement |
|---|---|
| Availability | Member features work offline on previously used devices |
| Data safety | No silent loss of local edits; idempotent sync; conflicts surfaced |
| Responsiveness | Mobile, tablet, desktop |
| Security | RLS everywhere; administrator-only library writes; CAPTCHA; private storage |
| Performance | Local reads render instantly; first sync of a few thousand songs within seconds |
| Accessibility | Keyboard accessible; semantic markup; status not by color alone |
| Browser support | Current Chrome, Safari (iOS and macOS), Firefox, Edge |
| Maintainability | Feature-based modules; pgTAP and unit tests; offline end-to-end tests |
| Cost | Free tiers in development; low production cost |

---

## 14. Delivery Plan

Milestones 0–5 were built under v1.0. Their library, plans, events and UI carry over; sharing and member
accounts are removed. Milestones 2–5 are not deployed in their v1 form.

### Milestone 6 — Access model (online)
Anonymous device sessions with CAPTCHA; administrator-only library writes; plans and events for every
session; remove member login, invitations for members, sharing and public links; administrator
management; RLS rewrite with pgTAP tests.
**Exit:** anyone can use the app without signing in; only administrators change the library.

### Milestone 7 — Local data and app shell
IndexedDB schema; pull sync with tombstones; client-rendered member pages; precached app shell; offline
reading of library, plans and events.
**Exit:** with the network off, a previously used device opens the app and every synced plan and song.

### Milestone 8 — Offline sheets
Per-sheet and per-plan downloads; availability badges; storage usage, quota and failure handling;
persistent storage request; iOS install guidance.
**Exit:** a plan made available offline shows all its sheets with no network.

### Milestone 9 — Offline editing and sync
Device-generated ids; outbox; `sync_plan` with version check and idempotency; automatic retries;
conflict resolution screen; update prompt that keeps the queue.
**Exit:** offline edits sync on reconnect, and conflicts never lose data.

### Milestone 10 — Hardening and launch
Offline end-to-end tests (network turned off); real iOS Safari and Android Chrome checks; abuse controls
review; backups and restore drill; egress review; production project and Supabase Pro decision; user
acceptance test with ministry members.

---

## 15. Acceptance Checklist

### Access
- [ ] A new device opens Setlist with no sign-in and can browse the library.
- [ ] A request with no session gets no data.
- [ ] Members cannot upload, edit, archive or delete music (UI, server and database).
- [ ] An administrator can sign in, upload, and sign out; the device then works as a member.
- [ ] A deactivated administrator loses administrator access immediately.

### Library
- [ ] A valid PDF uploads; non-PDFs, oversized and truncated files are rejected.
- [ ] Multiple arrangements per piece; search and filters work online and offline.
- [ ] Archived music is hidden by default and still opens inside existing plans.

### Plans
- [ ] Anyone can create, edit, reorder, duplicate and archive any plan.
- [ ] Order and notes persist after reload, online and offline.
- [ ] Only administrators can permanently delete a plan.

### Offline
- [ ] With the network off, a previously used device opens the app, the library, plans and events.
- [ ] A plan made available offline opens every sheet with the network off.
- [ ] Each song, plan and sheet shows whether it is available offline.
- [ ] A plan created and edited offline syncs automatically when the network returns.
- [ ] A sync interrupted halfway retries without duplicating changes.
- [ ] Two devices editing the same plan offline produce a conflict screen; each choice works and no edit
      is lost without the member choosing it.
- [ ] A full disk or failed download is reported and can be retried.
- [ ] Updating the app keeps unsynced changes.

### Events
- [ ] Events can be created and edited online and viewed offline.
- [ ] An event can have multiple plans; removing a plan from an event keeps the plan.
- [ ] Only administrators can delete events.

### Quality
- [ ] Desktop and mobile layouts work; important actions are keyboard accessible.
- [ ] Backup and restore are documented and tested.

---

## 16. Implementation Instructions

1. Inspect the repository before changing it; reuse what exists.
2. Work milestone by milestone; propose a plan (files, schema, dependencies) before each one.
3. Use migrations for every schema change; regenerate database types.
4. RLS on every table, with pgTAP tests for each access rule above.
5. Never expose the secret key; never add a shared password.
6. Validate every mutation on the server or in SQL.
7. Test offline behavior with the network actually turned off, on desktop and mobile sizes.
8. Don't add non-goals or unnecessary dependencies.
9. Don't commit secrets, local environment files or real user data.
10. Run lint, type checks, unit tests, database tests and a production build before calling a
    milestone done; update the README and docs.

---

## 17. Defaults

| Question | Default |
|---|---|
| PDF maximum size | 20 MB, configurable |
| Church timezone | Asia/Manila |
| Plan default status | Draft |
| Music deletion | Archive; permanent delete only when unused |
| Plan duplication | Copies items, not event links |
| Bulk download | Per plan by default; whole library on request with size shown |
| Conflict default | None: the member always chooses |
| Realtime editing | Not included |
| Multi-church support | Not included |

---

## 18. Success Criteria

The release is successful when ministry members can, without an account:

1. Open Setlist on their phone and find a song.
2. View its sheet.
3. Create a plan for a service and reorder its songs.
4. Make the plan available offline.
5. Open the plan and every sheet at church with no internet.
6. Edit a plan offline and see it sync later without losing anyone's changes.

And an administrator can keep the library up to date from any browser.

**Build the simplest reliable version of this workflow first.**
