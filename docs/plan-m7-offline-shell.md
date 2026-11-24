# Milestone 7 — Local data and offline app shell: implementation plan

**Status:** approved and built (2026-11-24). See "As built" at the end.
**Spec:** `spec.md` v2.0 §4.5 (OFF-01, OFF-02, OFF-03, OFF-05 for metadata), §7.1–§7.4, §8.2, §14
(Milestone 7).
**Branch:** `milestone-7-offline` from `milestone-6-access`.
**Exit criteria (spec §14):** with the network off, a previously used device opens the app and every
synced plan and song.

| In this milestone | Later |
|---|---|
| Reading offline: library, songs, plans, events, dashboard | Downloading sheets in bulk, storage usage, quota handling (M8) |
| Background sync from the server to the device | Editing offline, outbox, conflicts, update prompt (M9) |
| Precached app shell, versioned per deploy | Offline end-to-end test suite, real-device checks (M10) |

While offline in M7, anything that changes data (create or edit a plan, events, device name, admin pages)
shows *Needs a connection* instead of failing. Online, the existing editor and forms keep working, and
their changes reach the device at the next sync.

---

## 1. Key decisions

### 1.1 Member pages render in the browser, from the device's database

**Today:** pages are rendered on the server per request. That can't work offline, and each URL like
`/plans/<id>` is a separate server page, so a plan never opened online could never open offline.

**Plan:**
- Member pages become **static, client-rendered pages with the id in the query string**. They read only
  from IndexedDB.
- The same nine pages serve every plan, song and event, so the service worker can precache all of them
  once.

| Today | M7 |
|---|---|
| `/dashboard` | `/dashboard` |
| `/library` (server search, 25 per page) | `/library` (search, category and tag filters run on the device) |
| `/library/[id]` | `/song?id=…` |
| `/sheets/[arrangementId]` | `/sheet?id=…` |
| `/plans`, `/plans/[id]` | `/plans`, `/plan?id=…` |
| `/events`, `/events/[id]` | `/events`, `/event?id=…` |
| `/settings` | `/settings` |

These stay **server-rendered and online-only** (unchanged, reached by links from the pages above):
- `/plans/[id]/edit` (until M9);
- `/events/new` and `/events/[id]/edit`;
- the music upload and edit pages;
- `/admin/*`, sign-in, welcome and invitation pages.

Nothing is deployed, so the URL changes break no shared links.

### 1.2 Navigation while offline
- When a page's server data can't load, Next.js 16 falls back to a normal page load. I checked this in
  `fetch-server-response.js`; it holds unless the experimental `useOffline` flag is on, and it must stay
  off.
- The service worker answers that page load from its cache. Offline navigation therefore works with no
  router hacks: it's a little slower than an online click, but it works.

### 1.3 One static layout
- The `(app)` layout stops reading the session on the server. The sidebar, member menu and admin links
  come from the device's own profile row in IndexedDB.
- Every shell page is then identical for everyone and fully static (`○` in the build), so the service
  worker can cache it safely: nothing personal is in the HTML.
- The proxy still sends visitors with no session to `/welcome`, and RLS still protects all data.
  Admin pages still check the role on the server.

### 1.4 Local database: Dexie
- New runtime dependency: **`dexie`**. It replaces a large amount of hand-written IndexedDB code
  (versioned schema, indexes, transactions), and Dexie's built-in `liveQuery` re-renders pages when sync
  writes. That avoids `dexie-react-hooks`: a ~20-line `useLiveQuery` hook of our own.
- Dev dependency: **`fake-indexeddb`**, for unit tests.
- Both get recorded in the Complexity Tracking table (constitution Principle I).

Tables:
- `music_pieces`, `arrangements` (no PDFs), `plans`, `plan_items`, `events`, `event_plans`;
- `profiles` (id, display name, role, status, is_anonymous: names for "updated by", and the device's own
  role);
- `app_settings`;
- `sync_state` (cursor, last success, last error).

Indexes support title search, category, tag, plan order and event date.

### 1.5 Pull sync: one database function, deletions as tombstones
- **New `deleted_rows(table_name, row_id, deleted_at)` table**, filled by `AFTER DELETE` triggers on
  `plans`, `plan_items`, `events` and `event_plans`. This is spec §8.2's "tombstones" option.
  - The existing Milestone 3 edit functions keep hard-deleting and don't change.
  - Spec §8.1 sketches `deleted_at` / `removed_at` columns instead. The log achieves the same with far
    less churn; please confirm. Music is never deleted, only archived, so a status change is enough.
  - Tombstones older than 90 days are pruned. A device that hasn't synced for longer does a full resync.
- **New `pull_changes(p_since timestamptz)` function** (`SECURITY INVOKER`, so RLS applies). It returns
  one JSON document: `server_time`, changed rows per table since `p_since`, and tombstones since
  `p_since`.
  - It's one SQL statement, so one consistent snapshot.
  - `p_since = null` returns everything (first sync).
  - Pending uploads are excluded.
- **Cursor:** the next pull asks from `server_time − 2 minutes`. Upserts are idempotent, so rows written
  by transactions still running at the moment of the pull aren't missed.
- **Data size:** a few thousand songs is a few hundred KB of JSON on the first sync, then small deltas.
- **When it runs:**
  - on app start;
  - when the browser comes back online;
  - when the app becomes visible again;
  - after each online edit;
  - every 5 minutes while the app is open;
  - with backoff after errors.
  - It never runs while offline.
- **Device status bar:** *Synced just now* / *Offline: showing what's on this device (synced 2 h ago)* /
  *Sync failed, retrying*.
- **Plan activity** (history list) is not synced. It's shown when online, and hidden offline with a
  note.

### 1.6 Service worker
- **Versioned per deploy:** registered as `/sw.js?v=<build id>`, from Railway's commit SHA, else a build
  timestamp. A new deploy installs a new worker that precaches the new shell, then removes old caches.
- **Install:** precaches the nine member pages, `/offline`, and every `/_next/static` file they reference.
- **Fetch strategy:**
  - Shell pages: cache first, ignoring the query string.
  - Hashed assets: cache first.
  - Server pages: network first, falling back to `/offline` ("This page needs a connection").
  - Data requests: left alone.
- **Sheets** keep the existing Cache Storage copies (`features/offline/sheets.ts`, keyed by arrangement
  and file version). Opening a sheet online keeps a copy, as today; bulk downloads come in M8.
- **Removed:** the Milestone 3 per-plan page caching and its "saved plans" list. Every synced plan is now
  available offline, so they're obsolete.
- M7 applies an update on the next app start. The visible "Reload to update" prompt that protects queued
  edits belongs to M9 (OFF-12), when there's a queue.

---

## 2. Database changes

`supabase/migrations/20261129000000_sync.sql`:
- `deleted_rows` table with an index on `deleted_at`. Members read it through `pull_changes` only;
  there's no direct grant.
- `AFTER DELETE` triggers on the four tables.
- `pull_changes(timestamptz)`, granted to `authenticated` only.
- An `updated_at` index on every synced table.
- `prune_deleted_rows()`, called by `pull_changes` at most once a day.

pgTAP `06_sync.test.sql`:
- First pull returns everything visible, without pending uploads.
- A delta returns only changes.
- Deletions appear as tombstones.
- A blocked device and no session get nothing.
- `server_time` is returned.
- Repeated pulls are idempotent.

---

## 3. App changes

| Area | Change |
|---|---|
| `features/local-db/` | Dexie schema, typed tables, `useLiveQuery`, query helpers: library search and filters, plan with items, events split by church timezone, dashboard lists. |
| `features/sync/` | `pullChanges()` (RPC → transaction upserts and deletes → cursor), triggers, backoff, status store. |
| `(app)/layout.tsx` | Static. Client `AppFrame`: sidebar, tab bar, member menu and admin links from the local profile; starts sync; offline/sync status bar. |
| Member pages | Rewritten as client components reading IndexedDB (table in §1.1). Existing components (PDF viewer, plan song list, event list, badges) are reused. |
| Online-only actions | Create plan, Edit, Duplicate, Archive, events, attach/detach, device name: disabled offline with a short reason. Online they keep using the existing server actions, then trigger a pull. |
| `public/sw.js` | Rewritten as in §1.6; registration passes the build id. |
| `next.config.ts` | Exposes the build id (`RAILWAY_GIT_COMMIT_SHA` or a timestamp) to the client. |
| Removed | Server queries only the old member pages used; `SavedPlansList`, `savePageForOffline`, `rememberSavedPlan`. `/offline` becomes "This page needs a connection" with links to the offline pages. |

---

## 4. Tests

- **pgTAP:** `06_sync` (above). The existing 128 tests keep passing.
- **Unit (Vitest + fake-indexeddb):**
  - applying a pull: upsert, tombstone delete, cursor overlap;
  - first sync versus delta;
  - library search and filters;
  - upcoming/past split in the church timezone;
  - backoff timing.
- **Browser (local production build, desktop and mobile):**
  1. Open the app online and let it sync.
  2. Make the network really unreachable: stop the app server **and** the local Supabase stack, so no
     request can succeed.
  3. Reload. Open the dashboard, library search, a song, a plan never opened before, an event, and a
     sheet opened earlier.
  4. Offline banners appear, and editing buttons say *Needs a connection*.
  5. Restart everything. Edit a plan as admin in another browser; the first browser shows the change
     after the next sync. Delete a plan; it disappears from the device.
  6. Deploy simulation: rebuild, then check the new worker replaces the old shell.
- Lint, typecheck, unit, build, and pgTAP on a fresh database.

---

## 5. Steps

1. Branch. Migration + `06_sync` tests; regenerate types.
2. Dexie schema, sync engine, live-query hook + unit tests.
3. Static layout and `AppFrame` (local profile, status bar, sync triggers).
4. Rewrite member pages: library → song → sheet → plans → plan → events → event → dashboard → settings.
5. Service worker rewrite and versioned registration; remove M3 page caching.
6. Online-only action states; `/offline` page.
7. Docs (README offline testing, implementation notes, Complexity Tracking), full checks, offline browser
   test, commit on the branch.

## 6. Constitution check

- **Principle I:**
  - Two dependencies (`dexie`, dev `fake-indexeddb`), justified above.
  - No routing library and no service-worker generator. The hand-written worker stays about 150 lines,
    with an explicit precache list.
  - The tombstone log avoids reworking every Milestone 3 function.
- **Principle II:** the service worker is allowed because spec v2 requires offline use. Every page gets
  checked on mobile and desktop.

## 7. Risks

| Risk | Handling |
|---|---|
| Client-rendered pages show a moment of empty state before IndexedDB answers | IndexedDB reads take milliseconds; show skeletons, never a false "No plans yet" before the first read. |
| First visit offline | Not possible: the first visit needs the network to get the app and a session (unchanged). |
| A device offline for over 90 days misses tombstones | Pull detects a cursor older than the oldest tombstone and does a full resync. |
| Blocked device | Pull returns nothing; local data already on it stays (it was viewable anyway). |
| iOS removes site data after 7 days unused (not installed) | The device resyncs on next open; install guidance comes in M8. |
| Search over thousands of songs on a phone | Indexed title prefix plus an in-memory filter; well within limits at this size. |

---

## 8. As built

- **Pages:** `/dashboard`, `/library`, `/song`, `/sheet`, `/plans`, `/plan`, `/events`, `/event`, `/settings` and
  `/offline` are all static (`○` in the build). They read IndexedDB through `features/local-db`. The old
  dynamic member pages are removed; edit and admin pages stay server-rendered.
- **Service worker:**
  - `scripts/build-sw.mjs` runs as `postbuild`. It writes `public/sw.js` (gitignored) from
    `scripts/sw-template.js` with `.next/BUILD_ID` and every `.next/static` file (55 today, PDF viewer and
    worker included).
  - No version query string is needed: each build changes the file, which is what makes browsers update.
- **Updates:** a new worker installs in the background and waits until Setlist is fully closed, then takes
  over and deletes the old version's caches. Saved sheets (`setlist-sheets-v1`) survive. Verified by
  rebuilding during the browser test.
- **Sync triggers, beyond the plan:**
  - Every page change requests a sync, coalesced when one is already running.
  - The "not on this device" state runs one more sync first, so a page reached right after creating
    something (e.g. a new event) shows it instead of "not found".
- **Missing session:** a page served from the cache without a session (expired, signed out elsewhere)
  sends the device to `/welcome` once online. Local data stays.
- **Removed:** the Milestone 3 per-plan page caching, the saved-plans list, the assets/page
  "save for offline" helpers, server-side library search, and the server plan list.
- **Tests:**
  - pgTAP: 144, including `06_sync` (first pull, delta, tombstones with cascades, no emails, blocked
    device, no session).
  - Unit: 64, including `fake-indexeddb` tests for applying pulls and for local queries.
- **Browser test** (local production build, after a full reset):
  - With the app server and Supabase both stopped: a plan never opened before, its sheet, in-app link
    navigation, library search, a song, an event and `/` all worked. An editing page went to
    "This page needs a connection".
  - After restarting: a rename and a deletion made elsewhere reached the device. A new event appeared right
    after creation, and adding a plan to it updated the page.
- **Not testable with these tools:** the browser reporting itself offline (`navigator.onLine = false`).
  Stopping the servers produces the "Couldn't sync, retrying" state instead of the "Offline" state;
  both use the same cached pages and data.

### Complexity Tracking

| Addition | Why | Simpler alternative rejected because |
|---|---|---|
| `dexie` (runtime) | Versioned IndexedDB schema, indexes, transactions, live queries | Raw IndexedDB would be several hundred lines of callback code to maintain |
| `fake-indexeddb` (dev) | Unit tests of sync and local queries | No other way to run IndexedDB in Node tests |
| Generated `public/sw.js` | Precache every chunk (lazy ones too) and version per build | A static worker can't know the build's file names, and a missing chunk breaks the page offline |
