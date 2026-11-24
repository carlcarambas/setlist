# Milestone 10 — Hardening and launch: implementation plan

**Status:** approved (2026-11-24). Part A built (see "As built"); parts B and C need the owner.
**Spec:** `spec.md` 2.1 §12, §14 (Milestone 10), §15 (acceptance checklist), §18 (success criteria).
**Branch:** `milestone-10-launch` from `view-only-offline`.
**Exit criteria:** Setlist runs on Railway against the production Supabase project, passes the §15 checklist
on real phones, has a tested backup, and a few ministry members have used it for a real service.

The work splits into three parts:
- **A.** What I build and test locally.
- **B.** The launch, done together: some steps need your accounts.
- **C.** Real-world checks only you can do: phones and members.

---

## A. Hardening (I build and test locally)

| # | Work | Why |
|---|---|---|
| A1 | **Friendly error pages**: `error.tsx` for the app and admin areas, `global-error.tsx`, `not-found.tsx`. Each offers "Try again" / "Go home" and logs the error (with no personal data) to the server log, which Railway keeps. | Today an unexpected error shows Next.js's default page. |
| A2 | **Block a device** (ACC-09): on the Administrators page, a "Member devices" list (device name or "Unnamed device", last plan change, number of changes) with **Block** / **Unblock**. The database part already exists from Milestone 6. | The only answer today to a stranger vandalizing plans is a database query. |
| A3 | **Automated offline tests** with Playwright: the browser genuinely switched offline, not just servers stopped. It covers: first visit → keep a plan offline → go offline → plans, songs, events and sheets open, and every change says *Needs a connection* → back online → changes made elsewhere arrive. New dev dependency `@playwright/test` (with Chromium); run locally with `npm run test:e2e`. | Spec §16.7 asks for tests with the network actually off; my manual tests could only stop the servers. |
| A4 | **Backups**: a GitHub Actions workflow, weekly and on demand. It runs `supabase db dump` (schema and data) and copies every sheet PDF, then stores both as a workflow artifact kept 90 days. Secrets live in GitHub, never in the repo. | The Free plan has no backups (spec §9, §12). Artifacts are free at this size and need no extra service. |
| A5 | **Restore drill**: `docs/runbook.md` with step-by-step restore instructions, then actually restore a backup into the local Supabase and check counts and a sheet. | Spec: "restoration tested once". |
| A6 | **Review pass**: RLS and grants across all tables; the abuse controls (bot check, rate limits, archive-not-delete, activity, block); upload checks (already covered: renamed file, truncated file, oversized); an egress estimate. Findings are fixed or written down in the runbook. | Spec §14 Milestone 10 list. |
| A7 | **Clean-up**: drop code and docs references that only existed for removed features; README "Deploying" rewritten for the final steps. | Constitution Principle I. |

---

## B. Launch (together)

### B1. Decisions I need from you first

| # | Question | My suggestion |
|---|---|---|
| D1 | Which Supabase project is production? | **Reuse the existing `setlist-staging` project and rename it.** It only holds Milestone 1–2 test data, which I'd clear. A second project would cost a second Free slot and double the setup. Local Supabase stays the development copy. |
| D2 | Supabase Pro ($25/month) now or later? | **Later.** Launch on Free with the weekly backup from A4. Free pauses after 7 days without activity, but weekly services and the sync keep it active. Upgrade if it ever pauses or storage nears 1 GB. |
| D3 | Address | **The Railway address to start** (`<name>.up.railway.app`). A custom domain can be added any time; every link and setting is updated in one place. |
| D4 | OK to add Playwright as a dev-only dependency? | **Yes.** It's the only way to test real offline behavior automatically, and it never ships to users. |

### B2. Steps (I prepare commands and docs; you do the account parts)

1. **Netlify off first.** Delete or disconnect the old Netlify site. Otherwise merging into `main` triggers a
   Netlify build, against the credits you already used up.
2. **Cloudflare Turnstile** (you, free): create a widget for the Railway domain; copy its site key and
   secret key.
3. **Supabase dashboard** (you, with my checklist):
   - turn on sign-ups and anonymous sign-ins;
   - Bot protection → Turnstile + secret;
   - URL configuration (Railway URL);
   - email templates (invite, reset);
   - custom SMTP (Resend, free tier; needs a sending domain you own, or Resend's test domain, which only
     delivers to your own address);
   - first administrator.
4. **Database:** I run `npx supabase db push --remote` for migrations 3–9 after clearing the test data.
   You approve before it runs; it changes the live database.
5. **Railway** (you, with my checklist): new project from the GitHub repo; variables; generate the
   domain; healthcheck `/robots.txt`; set a usage limit.
6. **Merge:** one pull request bringing Milestones 3–10 into `main`. Deploys go out from `main`.
7. **Smoke test** on the live URL: welcome step, library, keep a plan offline, Share, admin sign-in and
   upload, invite email arrives.

---

## C. Real-world checks (you, with my checklists)

1. **Phones:** an iPhone (Safari, then installed to the Home Screen) and an Android phone (Chrome,
   installed). `docs/device-checklist.md` lists each check:
   - opening the app and the install card;
   - Keep offline;
   - **airplane mode**: plans, sheets, "Needs a connection";
   - the Share sheet;
   - PDF readability on stage;
   - rotation;
   - the update after a new deploy.

   You tick boxes and note anything odd; I fix what comes up.
2. **Member trial (UAT):** 3–5 ministry members use it for one real service, following spec §18 (find a
   song, view it, build and order a plan, share it, keep offline, use it at church with no signal).
   `docs/member-trial.md` is a one-page guide and a feedback list.
3. **Go-live:** after fixes, announce the link to the ministry.

---

## Tests and checks

- Every existing check: lint, typecheck, unit, build, pgTAP.
- New: Playwright offline suite (A3); error pages visible in the browser; block device covered in pgTAP
  and in the browser; backup workflow run once (manually triggered) and its artifact restored locally
  (A5).
- After deploy: smoke test (B2.7) and the device checklist (C1).

## Steps

1. Branch. A1 error pages; A2 block-device UI (+ pgTAP).
2. A3 Playwright offline suite.
3. A4 backup workflow and A5 runbook with restore drill (local).
4. A6 review fixes; A7 clean-up and docs; checklists for B and C.
5. Commit, then stop and hand over: decisions D1–D4 and the B2 account steps.
6. Launch together (B2), then real-world checks (C) and fixes.

## Constitution check

- **Principle I:**
  - One new dev-only dependency (Playwright), justified above.
  - Backups use GitHub Actions artifacts instead of a new storage service.
  - Reusing one Supabase project avoids a second environment.
- **Principle II:** real iOS and Android checks are the point of part C.

## Risks

| Risk | Handling |
|---|---|
| `db push` against the live project goes wrong | Run only after a manual backup (A4 workflow) and your OK; migrations are already tested on a fresh database every milestone. |
| Email setup (SMTP, domain) takes longer than expected | Members don't need email at all; only administrator invites and resets do. You can launch with the first admin made by hand and add SMTP after. |
| Free plan pauses | Weekly use keeps it active; Railway's healthcheck doesn't touch the database, so it doesn't count. Supabase emails a warning before pausing. |
| Merging into `main` triggers an old Netlify build | B2 step 1 comes first. |
| iOS surprises (storage eviction, PDF rendering) | That's why C1 exists; fixes come back into this milestone. |

---

## As built (part A)

- **A1:** `error.tsx` (app area), `global-error.tsx` and `not-found.tsx`.
  - Errors show *Try again* / *Go to Home* and a reference code matching the server log entry that
    Next.js writes (Railway → Logs). No error details reach the browser.
  - Next.js 16's error props are `error` and `retry`.
- **A2:** `list_member_devices()` (administrators only) + *Administrators → Member devices* with
  **Block** / **Unblock**. pgTAP `07_member_devices` (7 tests).
- **A3:** Playwright (`npm run test:e2e`), phone and desktop sizes. With the browser genuinely offline:
  - the kept plan, its sheets (PDF canvas), library search and Events open;
  - changes say *Needs a connection*;
  - online-only pages show *This page needs a connection*.

  Back online, a rename made elsewhere arrives. The suite creates and removes its own data, and refuses
  to run against anything but a local Supabase.
- **A4:** `.github/workflows/backup.yml`, weekly and on demand.
  - It dumps `public,auth` data and copies every sheet (`scripts/backup-storage.mjs`), encrypted with
    AES-256 before upload, kept 90 days.
  - I couldn't check whether the repository is public, so encryption makes it safe either way.
- **A5:** the restore drill ran locally (`docs/runbook.md`): identical counts, a valid PDF, and the admin
  signs in with the old password.
  - It found one problem: dumping the `storage` schema would restore file records without files. So the
    dump covers `public,auth`, and files come back by upload (`scripts/restore-storage.mjs`).
- **A6 review:**
  - The `anon` role has no table privileges and no executable functions in `public`.
  - Every `public` table has RLS.
  - The sheet bucket is private, and its only policies are for signed-in sessions.
  - These are now pgTAP tests in `00_foundation` (154 in total).
  - Upload checks (renamed, truncated, oversized) were already unit-tested.
  - Abuse layers and costs are in the runbook.
- **A7:** README deployment and scripts updated; launch, device and member-trial checklists in `docs/`.
