# Milestone 6 — Access model: implementation plan

**Status:** approved and built (2026-11-24). See "As built" at the end.
**Spec:** `spec.md` v2.0 §2, §3, §4.1, §4.2, §4.4, §10, §14 (Milestone 6).
**Branch:** `milestone-6-access` from `milestone-5-events`.
**Exit criteria (spec §14):** anyone can use the app without signing in; only administrators change the library.

Offline work is not part of this milestone; it starts in Milestone 7. The existing P9 offline plan
pages stay as they are until then.

---

## 1. Approach

### Database: one migration on top
`supabase/migrations/20261128000000_access_model.sql`.

The cloud database has migrations up to Milestone 2 applied. Milestones 3–5 were never pushed, but
adding on top (rather than editing old files) keeps history linear and lets the cloud apply 3 → 6 in
order. Milestone 4 creates the sharing tables and this migration drops them, which is harmless with
no data.

The central trick: most existing rules call two helpers. Redefining them moves the whole app to the new
model without rewriting every policy.
- `is_active_member()` becomes "this session belongs to an active profile, anonymous or not". Blocked
  devices and deactivated administrators fail it.
- `can_view_plan(id)` and `can_edit_plan(id)` become `is_active_member()` plus "plan exists and isn't
  permanently deleted". Every Milestone 3 edit function (`add_plan_item`, `reorder_plan_items`,
  `bump_plan_version`…) inherits this unchanged.

### App: a "getting ready" gate instead of the sign-in redirect
- On the first visit with no session, the app shows a short *Getting Setlist ready…* screen.
- It runs Cloudflare Turnstile (usually invisible) and calls `supabase.auth.signInAnonymously()` with
  the CAPTCHA token, then refreshes.
- The session cookie works exactly like today's, so Server Components, RLS and the existing pages
  keep working.

---

## 2. Database changes

| Area | Change |
|---|---|
| Auth config | `enable_anonymous_sign_ins = true`; `[auth.captcha]` Turnstile with the secret from `env()`; anonymous rate limit kept (30/hour/IP). Same settings documented for the cloud dashboard. |
| `profiles` | Add `is_anonymous boolean`. `display_name` becomes optional. The new-user trigger makes anonymous users `member` + `active` at once, and non-anonymous users `admin` + `invited` (only administrators are invited now). |
| Profile privacy | Column grants: authenticated may read `id, display_name, role, status, is_anonymous`, **not `email`**. An admin-only `list_administrators()` function returns emails. Today any member can read every email; strangers must not. |
| Helpers | Redefine `is_active_member()`, `can_view_plan()`, `can_edit_plan()` as above. `is_admin()` adds `not is_anonymous`. |
| Library | Insert and update policies on `music_pieces` and `arrangements`, and the storage upload policy: `is_admin()` instead of `is_active_member()`. Reads stay `is_active_member()`. |
| Plans | Read and edit for every active session. `plans_guard`: anyone may archive or restore (D4). New admin-only `delete_plan(id)`; it hard-deletes, since sync tombstones arrive in Milestone 7. |
| Sharing | Drop `plan_shares`, `plan_links`, the `share_permission` type, and the share/link functions. Remove `share_*` and `link_*` from the activity action check. |
| Events | Update by any active session; delete by `is_admin()` only. Attach/detach already follows `can_edit_plan`. |
| Admin safety | `set_member_status` also refuses to deactivate the **last active administrator**. Blocking a device = an admin setting an anonymous profile to `inactive` (data support now; UI in Milestone 10, ACC-09 is a Should). |

### To verify first (step 1)
- Whether `enable_signup = false` also blocks anonymous sign-ins.
- If it does, signups get turned on, but email/password self-signup stays harmless: such users get
  `invited` status, no access, and still face the CAPTCHA. If possible, the email provider's own
  signup gets turned off instead.

---

## 3. App changes

| Area | Change |
|---|---|
| `src/lib/supabase/proxy.ts` | No sign-in redirect for member pages. Admin pages (`/admin/*`, library write pages) redirect to `/sign-in` when not an administrator. |
| `src/lib/auth/member.ts` | `requireActiveMember()` → `requireSession()`. With no session it renders the gate; inactive → "This device has been blocked". `requireAdmin()` unchanged. `getCurrentMember` stops selecting `email`. |
| New `components/auth/device-gate.tsx` | Turnstile via its script tag (no new npm dependency), `signInAnonymously`, retry message on failure or offline. |
| Library | Add/edit/replace/archive buttons and pages only for administrators. Every library server action checks `requireAdmin`. Readers keep search, view and download. |
| Plans | "My Plans" → **Plans**: all plans, owner name hidden for anonymous creators. Archive/restore for everyone. Delete (admin only) with confirmation. Remove owner-only branches, *Shared by…* text and Share buttons. |
| Sharing | Delete `features/sharing`, `components/plans/share-dialog.tsx`, `/shared`, `/share/[token]` (page and sheet route), the `/share/` proxy prefix, and the `/share/:path*` headers in `next.config.ts`. |
| Events | Edit for everyone; Delete only for administrators. |
| Dashboard | Widgets: upcoming events, **recently updated plans** (all), recent music. Quick actions: New plan; Upload music for administrators only. "Shared with me" is removed. |
| Navigation | Home · Library · Plans · Events · Settings. Admin links appear for administrators. Mobile tab bar: Shared → Settings. |
| Settings | Device name (optional), *Sign in as administrator* or *Sign out*. Sign-out no longer clears offline copies (spec §4.1), and the device continues as a member. |
| Administrators page | `/admin/members` → `/admin/administrators`: list, invite (role admin), deactivate/reactivate; last-admin guard message. |
| Indexing | `robots.ts` disallowing all; root metadata `robots: noindex`. |
| Env | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public). `SUPABASE_AUTH_CAPTCHA_SECRET` only in Supabase config, never in Netlify or the browser. `.env.example` and README updated. Local dev uses Cloudflare's published always-pass test keys. |
| Seed | `admin@setlist.test` (active admin) and `invited@setlist.test` (invited admin). `member@setlist.test` is removed: members are anonymous now. |

---

## 4. Tests

- **pgTAP:**
  - Rewrite `01_membership`: trigger roles, email hidden, last-admin guard, anonymous users can't
    become admin.
  - Rewrite `02_music_library`: member reads, admin-only writes and uploads.
  - Rewrite `03_plans`: any member edits, archives and restores; only admins delete; inactive device
    blocked.
  - Delete `04_sharing`.
  - Update `05_events`: anyone edits, only admins delete.
  - Keep "no session = no access" for every table.
  - Anonymous test users are inserted with `is_anonymous = true`.
- **Unit:** drop the sharing tests; keep the rest.
- **Browser (local production build, desktop and mobile):**
  1. A fresh browser with no session lands on the dashboard after the gate.
  2. It can search, view and download a sheet.
  3. It can create, edit, reorder and archive a plan.
  4. It sees no upload buttons, and `/library/new` sends it to sign-in.
  5. A second fresh browser sees and edits the same plan.
  6. Sign in as admin: upload, delete a plan, delete an event, invite an admin.
  7. Sign out: the device continues as a member.
  8. Old `/shared` and `/share/x` addresses return 404.
- Lint, typecheck, build, and pgTAP on a fresh database.

---

## 5. Steps

1. Branch; check how anonymous sign-in and signup settings interact; enable anonymous sign-ins and
   Turnstile test keys locally.
2. Migration + pgTAP rewrite; regenerate types.
3. Session gate, `requireSession`, proxy, sign-out behavior.
4. Remove sharing code and routes.
5. Library, plans, events, dashboard, navigation and settings UI by role.
6. Administrators page and invite-as-admin.
7. `noindex`, env docs, seed, README, implementation notes.
8. Full checks and browser test; commit on the branch.

---

## 6. Constitution check

- **Principle I (simplicity):**
  - No new npm dependencies; Turnstile loads through its script tag.
  - Redefining three helpers avoids rewriting about 40 policies.
  - The removed sharing code shrinks the app.
- **Principle II (one PWA):** unchanged; mobile and desktop layouts both checked.

## 7. Risks and notes

| Risk | Handling |
|---|---|
| Anonymous sign-in needs a connection | The first visit is online by nature; offline arrives in Milestone 7. The gate shows a retry if it fails. |
| Clearing browser data creates a new identity | Acceptable: identities own nothing (D1). Old anonymous users simply stay unused. |
| A blocked device can clear data and come back | Blocking is a speed bump; the real protections are CAPTCHA, rate limits, archive-not-delete and the activity log. |
| Cloud setup | When deploying: enable anonymous sign-ins and Turnstile in the Supabase dashboard, add the Turnstile site key to Netlify, push migrations 3–6. **No deploy happens in this milestone** unless you ask. |
| Admin signing in on a device | That device's anonymous identity is replaced by the admin session; signing out creates a fresh anonymous identity. Nothing is lost, since plans aren't owned. |

---

## 8. As built

- **Sign-ups must be on.** Verified locally: with `enable_signup = false`, Supabase refuses anonymous
  sign-ins ("Signups not allowed"). Email self-signup can't be switched off separately (the per-provider
  setting is deprecated and ignored). So:
  - The trigger gives every non-anonymous new user `member` + `invited`; only the server's invite path
    sets `role = 'admin'`.
  - The sign-in form refuses non-administrators.
  - A self-registered email account therefore has, at most, what any anonymous device has.
- **The bot check also covers admin sign-in and password reset.** Supabase applies the CAPTCHA to every
  password sign-in and reset request once it's enabled, so those forms carry a Turnstile token too.
- **No last-admin guard.** It can never trigger: only an active administrator can deactivate someone,
  and nobody can deactivate themselves, so one active administrator always remains. Removed rather than
  shipped as dead code.
- **Emails:** the profile email column isn't granted to members. Administrators read emails through
  `list_administrators()`; the signed-in admin's own email comes from the session.
- Removed with sharing: `features/sharing`, the share dialog, `/shared`, `/share/[token]` and its sheet
  route, the `/share/*` headers, `member@setlist.test`, and the sign-out cache clearing.
- pgTAP: 128 tests (`01` rewritten for devices/administrators, `02` admin-only writes, `03` shared editing
  and admin delete, `05` events, `04_sharing` deleted).
