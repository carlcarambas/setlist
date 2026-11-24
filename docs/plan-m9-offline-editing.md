# Milestone 9 — Offline editing and sync: implementation plan (DROPPED)

> **Dropped on 2026-11-24, never built.** The product owner chose to keep offline view-only: the app,
> plans and saved sheets stay viewable offline, and every change needs a connection. See `spec.md` 2.1.
> Milestone 9 is now "Share and simplify". This proposal is kept only as a record of what was considered.

**Status:** not approved; superseded.
**Spec:** `spec.md` v2.0 §4.3 (save states), §4.5 OFF-06, OFF-07, OFF-08, OFF-11 (warning), OFF-12, "Sync rules",
"Conflict resolution"; §5.2–5.3; §8.1 (`sync_changes`); §14 (Milestone 9).
**Branch:** `milestone-9-editing` from `milestone-8-sheets`.
**Exit criteria (spec §14):** offline edits sync on reconnect, and conflicts never lose data.

**Offline-capable in this milestone:**
- Create, edit, reorder and duplicate plans.
- Archive and restore plans.
- Add, remove and reorder songs; edit song notes.

**Still online-only, by spec:**
- Events and attaching plans to events (§4.4).
- Permanently deleting plans (administrators).
- Music, device name and administration.

---

## 1. How it works

### 1.1 Every plan edit goes through the device first
- The plan editor becomes a static page (`/plan/edit?id=…`). It reads the plan from IndexedDB, and every
  change is written to IndexedDB **immediately**: no waiting for the network, online or offline.
- Each changed plan gets **one outbox entry** holding:
  - the version the member started from (`base_version`);
  - a whole-plan snapshot: title, description, status, ordered songs with notes;
  - a `change_id`.
- Further edits update the same entry's snapshot, so ten offline edits sync as one change.
- Online, a push starts 2 seconds after the last edit. It also runs on app start, when the connection
  returns, and with the existing sync triggers, with backoff on failure.
- **Ids are made on the device.** A plan created offline keeps its id after sync, so links and other
  plans' references stay valid.
- The old server editor page (`/plans/[id]/edit`) and its per-change server actions are removed. The
  Milestone 3 SQL edit functions stay in the database and their tests keep passing, but the app no
  longer calls them.

### 1.2 One server function: `sync_plan`
`sync_plan(p_plan_id, p_base_version, p_change_id, p_snapshot jsonb, p_mode)` runs in one transaction.

**Modes:**
- `normal`: apply only if the plan's version still equals `p_base_version`.
- `create`: a plan made on the device.
- `force`: **Keep mine**, applied whatever the version, recorded as `conflict_overwritten`.

**Results:**

| Result | When |
|---|---|
| `applied` + new version | Saved. |
| `duplicate` + version | This `change_id` was already applied (a retry after a dropped connection). Nothing is applied twice. |
| `conflict` + the server's copy | Someone else saved first (version differs), or the plan was archived elsewhere. |
| `deleted` | An administrator deleted the plan permanently. |
| `rejected` + reason | Invalid: e.g. a newly added song whose sheet is no longer available, a song id from another plan, too many songs. |

**Applying a snapshot:**
- Update the details.
- Delete the songs that are no longer listed.
- Upsert listed songs by id, with positions `0…n-1`. The position constraint is already deferrable.
- Bump the version, stamp `updated_by`.

**Activity:** one row per kind of change, worked out by comparing before and after: details edited,
N songs added or removed, reordered, notes edited, status changed. History reads the same as today.

**Security:**
- `SECURITY DEFINER`, because devices supply row ids, which the column grants don't allow.
- It checks `is_active_member()` itself and validates every field.
- A blocked device or a request with no session gets nothing.
- New table `sync_changes(change_id, plan_id, version, applied_at)` makes retries idempotent. It's
  pruned after 30 days and has no client access.

### 1.3 Retries without double-applying
- A push whose result never arrived keeps its `change_id`. The entry is marked *uncertain*, and the next
  push reuses that id.
- If the server answers `duplicate`, the earlier attempt did land. If the snapshot hasn't changed since,
  the entry is done. If the member kept editing, it's re-based on the returned version with a new
  `change_id`.
- A `change_id` is only replaced after a confirmed result, so nothing is applied twice and nothing is
  dropped.

### 1.4 Pull never overwrites unsynced work
- While a plan has an outbox entry, pull leaves that plan and its songs alone on the device. That
  includes tombstones of its songs.
- After the push succeeds, the entry goes and the next pull brings the server copy, which then matches.

### 1.5 Conflicts (spec §4.5)
- A `conflict` marks the entry **Needs your attention** and stores the server's copy.
- The plan page, Plans list and dashboard show the state. A new page, `/plan/conflict?id=…`, shows both
  versions side by side: title, description, and songs in order with notes. Differences are highlighted
  in text, not only color.

| Situation | Choices |
|---|---|
| Edited elsewhere | **Keep theirs** (drop my changes, use the server copy) · **Keep mine** (force; recorded in activity) · **Save mine as a new plan** (a copy titled "… (my version)"; the original takes the server copy) |
| Archived elsewhere | **Restore with my changes** (force with status draft) · **Save mine as a new plan** |
| Deleted by an administrator | **Save mine as a new plan** · **Discard my changes** |
| Rejected (e.g. a song's sheet was archived while I was offline) | Explanation, with the problem song highlighted; **Remove it and sync** or **Discard my changes** |

Nothing is discarded without the member choosing it.

### 1.6 Save and sync states
The plan editor and plan page show one of:
- *Saved on this device*
- *Syncing…*
- *Synced*
- *Waiting for connection*
- *Sync failed — retrying*
- *Needs your attention*

These are spec §4.3's states. The Plans list marks plans with unsynced changes, and Settings shows
"N plans waiting to sync".

### 1.7 App updates keep the queue (OFF-12)
- When a new service worker is waiting, a bar offers **Reload to update**.
- If changes are waiting to sync, it says they're kept. The outbox lives in IndexedDB, and Dexie schema
  upgrades are additive.
- Reload sends `skip-waiting` to the worker, then reloads when the new one takes control.
- Otherwise the update still applies on the next app start, as today.

### 1.8 Warnings about unsynced changes (OFF-11)
Before any of these, a warning shows how many plans have unsynced changes and offers to sync first
where possible:
- **Clear all offline data**;
- **Sign out** (administrator);
- **Remove from device** on a plan with pending changes.

---

## 2. Files

| Area | Change |
|---|---|
| `supabase/migrations/20261130000000_sync_plan.sql` | `sync_changes`, `sync_plan()`, activity action `conflict_overwritten`, pruning. |
| `supabase/tests/07_sync_plan.test.sql` | Covered in §3. |
| `features/local-db/db.ts` | Schema version 3: `outbox` table. |
| `features/edits/` (new) | Local plan operations (create, rename, describe, add/remove/move song, notes, status, duplicate) as single Dexie transactions that also update the outbox. Snapshot building. |
| `features/sync/push.ts` (new) | Outbox push, result handling, uncertain retries, rebase. |
| `features/sync/engine.ts` | `requestSync` = push, then pull. Pull skips plans with pending entries. |
| `features/sync/apply.ts` | Skip logic for pending plans. |
| `features/edits/conflicts.ts` (new) | Keep theirs / Keep mine / Save as new / Restore / Discard / Remove-and-sync. |
| `/plan/edit`, `/plan/conflict` (new static pages) | Editor and conflict screen; both added to the service worker shell. |
| `components/plans/plan-editor.tsx`, `library-panel.tsx` | Rewired from server actions to local operations; library search uses the device database. |
| `components/plans/new-plan-form.tsx`, `plan-actions.tsx` | Create, duplicate and archive work offline (local operations). |
| `components/layout/update-bar.tsx` (new) | Update prompt. |
| Removed | `/plans/[id]/edit`; plan server actions for create, details, items, notes, status and duplicate. `deletePlan` and `fetchPlanActivity` stay. |

No new dependencies.

---

## 3. Tests

**pgTAP `07_sync_plan`:**
- Create a plan with device ids.
- Apply on the matching version; activity rows written.
- Stale version → `conflict` with the server copy.
- The same `change_id` twice → `duplicate`, applied once.
- Archived elsewhere → conflict; force restores it.
- Deleted → `deleted`.
- Rejected cases: a new song with an archived sheet; an item id belonging to another plan; a title that
  is too long; too many songs.
- A blocked device and no session get nothing.
- Every existing suite keeps passing.

**Unit (`fake-indexeddb`, mocked RPC):**
- Local operations update the plan and outbox together; edits collapse into one entry.
- Push results: applied, duplicate (snapshot same / changed), conflict, deleted, rejected, network error
  leaves *uncertain*.
- Pull skips pending plans.
- Each conflict choice.

**Browser (local production build, servers stopped for "offline"):**
1. With both servers down: create a plan, add songs from the device library, reorder, edit notes, rename,
   duplicate another plan, archive one. Everything shows *Saved on this device*.
2. Restart: everything syncs without a tap. The server matches (checked with a query), and the activity
   history is readable.
3. Conflict: edit a plan offline; meanwhile change the same plan through a script (as another device);
   reconnect → *Needs your attention*. Try each choice on fresh conflicts and check the outcomes on the
   server.
4. Archive or delete elsewhere while offline-edited: the right choices show.
5. Rejected: a sheet archived by an admin while the device added it offline.
6. Retry safety: interrupt a push by stopping the app server mid-sync, then restart; the change is
   applied once.
7. A new build while changes wait: the update bar shows; reloading keeps and then syncs them.
8. The warnings before Clear data and Sign out.

Lint, typecheck, unit, build, pgTAP on a fresh database.

## 4. Steps

1. Branch. Migration + `07_sync_plan` tests; regenerate types.
2. Outbox table, local operations, snapshot + unit tests.
3. Push engine (results, uncertain retries, rebase), pull skip + unit tests.
4. Editor page rewired to local operations; library panel on the device database; new-plan, duplicate and
   archive offline.
5. Save/sync states across pages; conflict page and choices.
6. Update bar; unsynced-change warnings.
7. Remove the old editor route and actions; docs; full checks; browser test; commit on the branch.

## 5. Constitution check

- **Principle I:**
  - One SQL function and one table instead of a sync service.
  - Whole-plan snapshots instead of operation logs or merge logic; item-level merging stays a spec
    non-goal.
  - No new dependencies.
- **Principle II:** the editor keeps mobile tabs and drag/move controls; checked on both sizes.

## 6. Risks

| Risk | Handling |
|---|---|
| Two members edit the same plan online at nearly the same moment | Same path as offline: the second gets a conflict and chooses. It's rarer than today, where every single click needed a matching version. |
| Losing edits if the device is cleared or the browser evicts data | The OFF-11 warnings; install guidance from M8; pushes start 2 s after editing while online. |
| A large rewrite of the editor | It keeps its look and controls; only where data is read and written changes. Covered by unit and browser tests. |
| A snapshot overwriting a concurrent change made with an old app version | The old editor and actions are removed in the same release; the server function is the only writer the app uses. |
| Activity detail from snapshot diffs | Computed in SQL from before/after; tested. |
