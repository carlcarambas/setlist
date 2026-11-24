# Setlist

Music ministry planning: a shared PDF music library, setlists (plans) and events. Members use it
without an account; administrators sign in to manage the library.
One responsive web app for desktop and mobile, installable from the browser.

- **Requirements:** [`spec.md`](spec.md) v2.0 (offline-first, no member login) is the source of truth.
  v1.0 is kept at [`docs/spec-v1.md`](docs/spec-v1.md); the migration rationale is in
  [`docs/offline-first-assessment.md`](docs/offline-first-assessment.md).
- **Technical plan:** [`docs/implementation-plan.md`](docs/implementation-plan.md) covers schema, RLS, milestones and cost notes.
- **Principles:** [`.specify/memory/constitution.md`](.specify/memory/constitution.md).

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 + shadcn/ui · Supabase (Postgres, Auth,
Storage) · Railway.

## Status

| Milestone | Scope | State |
|---|---|---|
| 0 | Foundation: app shell, Supabase helpers, tooling, deploy | Done |
| 1 | Auth and membership: sign-in, password reset, invitations, member admin | Done |
| 2 | Music library: PDF upload with server-side checks, search, arrangements, viewer | Done |
| 3 | Plans: editor with drag and drop, autosave, conflict protection; offline viewing | Done (not deployed) |
| 4 | Sharing: members as viewer/editor, Shared with Me, view-only links with expiry | Done (not deployed; removed by spec v2) |
| 5 | Events (upcoming/past in the church timezone, attach plans) and the dashboard | Done (not deployed) |
| 6 | Access model: no member login (anonymous devices + bot check), admin-only library, sharing removed | Done (not deployed) |
| 7 | Local data and offline app shell: pages read from the device, background sync, precached app | Done (not deployed) |
| 8 | Offline sheets | Next |
| 9 | Offline editing and sync | Planned |
| 10 | Hardening and launch | Planned |

## Local setup

**Prerequisites:** Node.js 22+, and [Docker Desktop](https://www.docker.com/products/docker-desktop/)
running (for the local Supabase stack).

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start local Supabase. This applies `supabase/migrations/` and `supabase/seed.sql`, then prints the API URL
   and keys:

   ```bash
   npm run db:start
   ```

3. Create `.env.local` from the example, then fill it in from the `db:start` output: the **Publishable** key
   goes in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the **Secret** key in `SUPABASE_SECRET_KEY`.

   ```bash
   cp .env.example .env.local
   ```

4. Run the app at http://localhost:3000:

   ```bash
   npm run dev
   ```

**Members** don't have accounts: any browser that opens the app becomes an anonymous member device after an
invisible bot check (Cloudflare Turnstile). Locally the check uses Cloudflare's published test keys, which
always pass: `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` in `.env.local`, and the matching test
secret in `supabase/config.toml`. The bot check needs internet access, even locally.

**Local administrator accounts** (created by `supabase/seed.sql`; the password is in that file):

| Email | Role |
|---|---|
| `admin@setlist.test` | Active administrator |
| `invited@setlist.test` | Invited administrator, hasn't joined yet |

Local Supabase Studio runs at http://127.0.0.1:54323, and emails sent locally (invites, resets) appear in
Mailpit at http://127.0.0.1:54324.

## Testing offline mode locally

How it works: member pages (Home, Library, a song, a sheet, Plans, a plan, Events, an event, Settings) are
static and read from a database on the device (IndexedDB), which syncs with Supabase in the background.
`npm run build` also generates `public/sw.js` (from `scripts/sw-template.js`) with the build's file list, so
the service worker can cache the whole app. Each build is a new version; a device switches to it the next
time Setlist is opened after being fully closed. The service worker only runs in a production build (in
development it would serve stale code).

1. Build:

   ```bash
   npm run build
   ```

2. Start the production server:

   ```bash
   npm start
   ```

3. Open the app once (it syncs everything except PDFs). Open a plan to save its sheets on the device
   ("Available offline on this device").
4. Stop the server and the local Supabase (`npm run db:stop`), or turn on airplane mode. Every plan, song
   and event still opens, including ones never opened before; sheets opened earlier still show. Editing
   and admin pages say they need a connection.

To start over, unregister the service worker and clear site data in the browser's developer tools.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run check` | Lint, typecheck, unit tests and production build. Run before every merge |
| `npm run lint` / `typecheck` / `test` | The individual checks |
| `npm run test:db` | pgTAP tests in `supabase/tests/` (RLS and schema). Needs `db:start` |
| `npm run db:start` / `db:stop` | Start or stop the local Supabase stack |
| `npm run db:reset` | Rebuild the local database from migrations and seed |
| `npm run db:types` | Regenerate `src/types/database.ts` from the local database. Run after every migration |

## Database changes

All schema changes are migrations in `supabase/migrations/`; never edit a cloud database by hand.

1. Create a migration, then write the SQL in the new file (including RLS policies):

   ```bash
   npx supabase migration new <name>
   ```

2. Apply it locally:

   ```bash
   npm run db:reset
   ```

3. Regenerate the types:

   ```bash
   npm run db:types
   ```

4. Add or extend the tests in `supabase/tests/`, then run them:

   ```bash
   npm run test:db
   ```

5. To apply migrations to the cloud project, link it once and push:

   ```bash
   npx supabase link --project-ref <ref>
   ```

   ```bash
   npx supabase db push --remote
   ```

   Without `--remote`, this version of the Supabase CLI targets the local database. Add `--dry-run` first to
   see which migrations will be applied.

## Environment variables

See [`.env.example`](.env.example).

| Variable | Exposed to browser | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable key; all access is governed by RLS |
| `SUPABASE_SECRET_KEY` | **No** | Bypasses RLS. Server only, used solely in `src/lib/supabase/admin.ts` |
| `NEXT_PUBLIC_SITE_URL` | Yes | Base URL for auth email redirects. Optional on Railway (defaults to `https://` + `RAILWAY_PUBLIC_DOMAIN`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes | Cloudflare Turnstile site key for the bot check (public by design). Its secret goes only in Supabase |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | Yes | Optional. PDF size limit (default 20); keep in sync with `supabase/config.toml` |
| `SUPABASE_PROJECT_ID` | n/a | Optional, local only. Used by `npm run db:types:remote` |

## Deployment

### Supabase (cloud)

1. Create a project (free tier) named `setlist-staging`. Production (`setlist-prod`) is created at Milestone 6.
2. **Authentication → Sign In / Providers:** turn **on** "Allow new users to sign up" and "Allow anonymous
   sign-ins". Supabase refuses anonymous sign-ins (member devices) when sign-ups are off. People who
   register by email themselves get no administrator rights and can't sign in to the app.
3. **Authentication → Attack Protection (bot protection):** enable CAPTCHA with **Cloudflare Turnstile** and
   paste the Turnstile **secret key**. Create the Turnstile widget (free) in the Cloudflare dashboard for the
   site's domain; its **site key** goes into Railway as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
4. **Authentication → URL Configuration:** set the Site URL to the Railway URL, and add redirect URLs:
   - `http://localhost:3000/**`
   - `https://<service>.up.railway.app/**` (and your custom domain, if you add one)
5. Run `npx supabase login`, then link the project and push migrations (see [Database changes](#database-changes)).
6. **Email templates** (Authentication → Emails): replace the **Invite user** and **Reset password**
   templates with the HTML in `supabase/templates/invite.html` and `recovery.html`. Their links go to
   `/auth/confirm`, which signs the person in on the server.
7. **Custom SMTP** (Authentication → Emails → SMTP Settings): Supabase's built-in email only delivers to
   your Supabase team's own addresses and is heavily rate-limited, so invitations to other administrators need a
   provider. Resend's free tier works: verify a sending domain, then enter its SMTP host, port, user and
   password here.
8. **First administrator** (once): invitations need an admin, so the first one is made by hand.
   1. **Authentication → Users → Add user → Create new user** with your email and a password, and tick
      "Auto Confirm User".
   2. **SQL Editor**, run (with your email):

      ```sql
      update public.profiles set role = 'admin', status = 'active' where email = 'you@example.com';
      ```

   3. Sign in to the app (**Settings → Administrator sign in**). Invite other administrators from
      **Administrators**. Members need nothing: they just open the app.

### Railway

Railway runs the app as an ordinary Node.js server (`npm run build`, then `npm start`, which runs
`next start` on the `PORT` Railway provides). Its default builder (Railpack) detects this from
`package.json`; there is no Railway config file (Railway has deprecated `railway.json`).

1. **New Project → Deploy from GitHub repo** and pick this repository.
2. **Variables:** add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `SUPABASE_SECRET_KEY` (sealed). `NEXT_PUBLIC_*` values are built into
   the browser code, so redeploy after changing them. `NEXT_PUBLIC_SITE_URL` is optional: without it the
   app uses `https://` + the service's public domain.
3. **Settings → Networking:** generate a public domain (or add a custom one), then put it in Supabase's
   URL configuration (above).
4. **Settings → Deploy:** set the healthcheck path to `/robots.txt` (static and reachable without a
   session), and keep the restart policy on failure.
5. Railway bills by usage. Deploys from `main` go live, so merge once per milestone and set a usage
   limit in the workspace's billing settings.

## Security rules

- RLS is enabled on every table; `npm run test:db` fails if a table in `public` doesn't have it.
- `src/lib/supabase/admin.ts` (secret key) imports `server-only`; importing it from client code fails the
  build.
- PDF sheets live in the private `music-sheets` bucket. Browsers upload straight to Storage with a one-time
  signed URL; the server then checks the stored bytes before a sheet becomes visible. Only administrators can
  upload, and they can't approve their own uploads.
- Members are anonymous Supabase users. Emails are never readable by members (column grants); the
  `anon` role (no session) has no table access. Pages are `noindex` and `robots.txt` disallows crawling.
- Never commit `.env*` files except `.env.example`, and never put real member data in `seed.sql`.
