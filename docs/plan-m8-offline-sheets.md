# Milestone 8 — Offline sheets: implementation plan

**Status:** approved and built (2026-11-24). See "As built" at the end.
**Spec:** `spec.md` v2.0 §4.5 OFF-04, OFF-05, OFF-09, OFF-10, OFF-11 and "Storage limits"; §5.1; §12 (egress);
§14 (Milestone 8).
**Branch:** `milestone-8-sheets` from `milestone-7-offline`.
**Exit criteria (spec §14):** a plan made available offline shows all its sheets with no network.

**Not in this milestone:**
- Editing offline and the "unsynced changes" warning (M9). OFF-11's warning gets wired up when M9 adds
  the queue.
- Real-device checks (M10).

---

## 1. What members get

| Where | New |
|---|---|
| **Plan page** | **Keep offline** button with the size, e.g. "3 sheets · 4.2 MB". Shows progress ("Downloading 2 of 3…"), then *Available offline*. Failures are listed with **Retry**. **Remove from device** undoes it. |
| **Plans list, dashboard, event page** | A small *Offline* badge on kept plans, or *Partly offline* when a sheet is missing. |
| **Song page** | Per sheet: **Save offline** / *On this device* / *Updating…* / **Remove**. |
| **Sheet viewer** | A sheet you open is still kept on the device (as today). If a newer version exists but you're offline, the saved copy shows with a note: "Older version: a newer one will download when you're online". |
| **Settings → Storage on this device** | Used and available space; number and size of saved sheets; whether storage is persistent; **Download the whole library** (size shown first); **Remove all downloaded sheets**; **Clear all offline data** (resyncs afterwards). |
| **Install guidance** | On iPhone/iPad Safari (not installed): one dismissible card. It explains *Add to Home Screen* keeps offline data safe, because Safari can remove data from sites unused for 7 days. On Android/desktop Chrome: an **Install app** button. |

### Behavior change: opening a plan no longer downloads all its sheets
- Today, every time anyone opens a plan online, every sheet in it downloads (Milestone 3's offline
  stopgap). That costs Supabase egress for every member and every plan, whether they need it or not.
- Spec v2 §12 says to download per plan by default and show sizes first, so it becomes the explicit
  **Keep offline** choice.
- A sheet you actually open is still kept, so the last thing you viewed works offline.

### "Keep offline" stays up to date by itself
A kept plan is a promise for Sunday morning. So on every sync (online), the device:
- downloads sheets for **songs newly added** to a kept plan;
- re-downloads sheets whose **PDF was replaced** (the old copy is kept until the new one is saved);
- removes sheets no longer needed by any kept plan, and not saved on their own.

A leader adding a song at 7 am therefore reaches every phone that kept the plan, as long as it was
online at some point after the change.

---

## 2. Design

### 2.1 Where things live
- **PDF bytes:** Cache Storage `setlist-sheets-v1`, as today (survives app updates). The key is the
  arrangement + file version.
- **Index (new Dexie table `sheet_files`):** `arrangement_id`, `version`, `bytes`, `saved_at`, and
  `pinned` (saved on its own via the song page or *Save offline*).
  - Gives live badges and totals without scanning the cache.
  - Reconciled with the cache at app start: index rows without bytes are dropped.
- **Kept plans (new Dexie table `kept_plans`):** `plan_id`, `kept_at`. Device-only; never synced (it's
  this device's choice).
- **Status is derived**, never stored: a plan is *Available offline* when it's kept and every playable
  sheet is in `sheet_files` at the current version.

### 2.2 Download manager (`features/offline/downloads.ts`)
- One queue for the whole app: 3 downloads at a time, one retry per sheet. Progress is shared, so leaving
  the plan page doesn't cancel anything, and the plan page shows the progress again on return.
- **Before a bulk download:** the total size comes from `file_size_bytes` (already synced), minus what's
  saved. It's compared with `navigator.storage.estimate()`; if it won't fit, the member is told how much
  space is needed and nothing starts.
- **Errors:**
  - Storage full (`QuotaExceededError`): stop the queue, keep what succeeded, show "Storage is full: free
    space or remove downloads".
  - Network or server error: mark that sheet failed and continue with the rest; **Retry** re-queues only
    the failures.
  - 404 (the sheet was removed): skip it, reported as unavailable.
- **Persistent storage:** `navigator.storage.persist()` is requested on the first *Keep offline* or *Save
  offline* tap (a user gesture, which some browsers require). The result shows in Settings.
- **Never runs offline.** Background updates for kept plans run after each successful sync.

### 2.3 Loading a sheet (`loadSheet`)
1. Saved copy at the current version.
2. Online: download, save and index it (as today).
3. Offline or the download failed: **any saved version** of that arrangement, flagged as older. Today an
   exact version match is required, so a replaced PDF stops working offline until it's re-downloaded.

### 2.4 Removing
- **Remove from device** (plan): un-keep it, then delete sheets that no other kept plan uses and that
  aren't pinned.
- **Remove** (sheet): unpin. It stays only if a kept plan needs it, and the button says so.
- **Remove all downloaded sheets:** empty the sheets cache, the index and the kept plans.
- **Clear all offline data:** that, plus delete the IndexedDB database, then reload. The device resyncs
  library, plans and events. App pages stay cached because they hold no data. From M9 it will first warn
  about unsynced changes.

---

## 3. Files

| Area | Change |
|---|---|
| `features/local-db/db.ts` | Schema version 2: `sheet_files`, `kept_plans`. |
| `features/offline/sheets.ts` | Index on save and delete; older-version fallback; delete helpers. |
| `features/offline/downloads.ts` (new) | Queue, progress store, size and quota checks, error classes, persistent-storage request, keep-plans updater. |
| `features/offline/status.ts` (new) | Pure functions: plan offline status, sizes to download, sheets safe to remove. Unit-tested. |
| `features/sync/engine.ts` | After a successful pull: run the kept-plans updater. At start: reconcile the index. |
| `components/offline/keep-offline.tsx` (new) | Plan button, progress, failures, remove. |
| `components/offline/offline-badge.tsx` (new) | Badges for plan lists, dashboard, event page, song page. |
| `components/offline/storage-panel.tsx` (new) | The Settings card. |
| `components/offline/install-hint.tsx` (new) | iOS card and `beforeinstallprompt` button. Dismissal saved in `localStorage`. |
| `components/plans/plan-songs.tsx` | Stop auto-downloading on open; show per-sheet *On this device*. |
| Pages | Plan, plans, dashboard, event, song, sheet and settings views get the new pieces. |

No database migration and no new dependencies.

---

## 4. Tests

- **Unit** (pure functions, plus `fake-indexeddb` for the index):
  - plan status: none, partial, complete, outdated;
  - bytes still to download;
  - removal set: shared sheets survive, pinned sheets survive;
  - quota check;
  - failures are retried only once;
  - older-version fallback choice.
- **Browser** (local production build):
  1. Keep a plan offline; watch the progress and size; the *Offline* badge appears in the list.
  2. Stop the app server and Supabase. Every sheet of the plan opens, and a sheet never opened shows the
     "not saved" message.
  3. Restart. As admin, replace one sheet's PDF and add a song to the kept plan. After the next sync both
     download without any tap.
  4. Remove from device: sheets shared with another kept plan stay.
  5. Settings: the storage numbers change; whole-library download with the size shown; clear offline
     data resyncs.
  6. Install card on a mobile Safari user agent (emulated); dismissal is remembered.
  7. Storage full: can't be forced in this browser; covered by unit tests on the error path.
- Lint, typecheck, unit, build, pgTAP.

## 5. Steps

1. Branch. Dexie v2 tables, index and reconcile, `loadSheet` fallback + unit tests.
2. Download queue, size and quota checks, persistence request + unit tests.
3. Keep offline on the plan page; badges across pages; stop auto-download on open.
4. Kept-plans updater after sync.
5. Song page per-sheet save/remove; sheet viewer older-version note.
6. Settings storage panel, whole-library download, clear data; install hint.
7. Docs, full checks, browser test, commit on the branch.

## 6. Constitution check

- **Principle I:** no new dependencies. Two small local tables instead of scanning Cache Storage.
  Derived status, so there's nothing to keep in step.
- **Principle II:** a PWA feature by nature; checked on mobile and desktop sizes.

## 7. Risks

| Risk | Handling |
|---|---|
| Members expect opening a plan to make it offline (today's behavior) | The plan page shows **Keep offline** prominently with the size; viewed sheets are still kept. |
| Whole-library download on a phone with little space | Size shown and checked against free space first; per plan stays the default. |
| Safari's eviction wipes everything after 7 unused days | Install guidance. After a wipe, the next online open resyncs and re-downloads kept plans (they're kept in IndexedDB too, so a wipe removes that list as well; the card explains why installing matters). |
| Storage estimates are rough (Safari reports loosely) | Used only to warn before big downloads; real failures are caught and reported. |
| Egress from automatic updates | Only for kept plans, and only when a sheet is new or replaced. |

---

## 8. As built

- Built as planned. Dexie schema version 2 adds `sheet_files` and `kept_plans`. Copies saved before the
  index existed are picked up at app start.
- **Sheets downloaded for a kept plan:**
  - They're unpinned; sheets opened or saved on their own are pinned.
  - After each sync, unpinned sheets no kept plan needs are deleted.
  - New and replaced sheets of kept plans, and replaced pinned sheets, are queued.
- `loadSheet` falls back to an older saved version when the current one can't be downloaded, and both
  viewers show "Older version: …".
- **Tests:**
  - Unit: 75, including the status rules (status, sizes, removal set, fit check) and the kept-plan
    bookkeeping with `fake-indexeddb`.
  - pgTAP unchanged (144).
- **Browser test** (local production build, from a cleared device):
  - **Keep offline** showed the size, downloaded both sheets, and badged the plan *Offline*. Another plan
    sharing two sheets showed *Partly offline*.
  - With the app server and Supabase stopped, every sheet of the kept plan rendered. A sheet never saved
    explained it isn't available offline.
  - After an admin-side version bump of one sheet and a song added to the kept plan, the device
    downloaded the new version (old copy removed) and the new song, with no tap.
  - Removing a plan kept sheets another kept plan needed. Removing the last one left no sheets.
  - The song page **Save offline** worked.
  - Settings: counts and space shown, whole-library download, **Clear all offline data** emptied the
    device and resynced.
  - Fixed during testing: the storage panel wrapped badly on phones; an empty total showed "1 KB".
- **Not verifiable here:**
  - The iPhone install card (this browser can't present as iOS Safari) and the Install button (Chromium
    only offers `beforeinstallprompt` when its install criteria are met). Both are checked on real
    devices in M10.
  - "Storage full" can't be forced; the error path is covered by code review and the queue's handling.
  - The browser pane didn't grant persistent storage ("Not yet"), which is normal for a non-installed
    site.
