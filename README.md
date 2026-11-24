# Setlist

Music ministry planning: a shared PDF music library, setlists (plans), events and sharing.
One responsive web app for desktop and mobile, installable from the browser.

- **Requirements:** [`spec.md`](spec.md) is the source of truth; approved amendments are in §19.
- **Technical plan:** [`docs/implementation-plan.md`](docs/implementation-plan.md) covers schema, RLS, milestones and cost notes.
- **Principles:** [`.specify/memory/constitution.md`](.specify/memory/constitution.md).

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 + shadcn/ui · Supabase (Postgres, Auth,
Storage) · Netlify.

## Status

| Milestone | Scope | State |
|---|---|---|
| 0 | Foundation: app shell, Supabase helpers, tooling, deploy | Done |
| 1 | Auth and membership: sign-in, password reset, invitations, member admin | Done |
| 2 | Music library: PDF upload with server-side checks, search, arrangements, viewer | Done |
| 3 | Plans: editor with drag and drop, autosave, conflict protection; offline viewing | Done (not deployed) |
| 4 | Sharing and collaboration | Next |
| 5–6 | Events, dashboard, hardening | Planned |

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

**Local test accounts** (created by `supabase/seed.sql`; the password is in that file):

| Email | Role |
|---|---|
| `admin@setlist.test` | Active administrator |
| `member@setlist.test` | Active member |
| `invited@setlist.test` | Invited, hasn't joined yet |

Local Supabase Studio runs at http://127.0.0.1:54323, and emails sent locally (invites, resets) appear in
Mailpit at http://127.0.0.1:54324.

## Testing offline mode locally

The service worker only runs in a production build (in development it would serve stale code).

1. Build:

   ```bash
   npm run build
   ```

2. Start the production server:

   ```bash
   npm start
   ```

3. Sign in, open a plan once, and wait for "Available offline on this device".
4. Stop the server (or turn on airplane mode). Reload the plan: it still opens, and its sheets open from
   the device. Other pages show the offline page with the list of saved plans.

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
| `NEXT_PUBLIC_SITE_URL` | Yes | Base URL for auth redirects and share links. Optional on Netlify (defaults to the project's main address) |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | Yes | Optional. PDF size limit (default 20); keep in sync with `supabase/config.toml` |
| `SUPABASE_PROJECT_ID` | n/a | Optional, local only. Used by `npm run db:types:remote` |

## Deployment

### Supabase (cloud)

1. Create a project (free tier) named `setlist-staging`. Production (`setlist-prod`) is created at Milestone 6.
2. **Authentication → Sign In / Providers:** turn **off** "Allow new users to sign up" (Setlist is
   invitation-only).
3. **Authentication → URL Configuration:** set the Site URL to the Netlify URL, and add redirect URLs:
   - `http://localhost:3000/**`
   - `https://<site>.netlify.app/**`
   - `https://deploy-preview-*--<site>.netlify.app/**`
4. Run `npx supabase login`, then link the project and push migrations (see [Database changes](#database-changes)).
5. **Email templates** (Authentication → Emails): replace the **Invite user** and **Reset password**
   templates with the HTML in `supabase/templates/invite.html` and `recovery.html`. Their links go to
   `/auth/confirm`, which signs the person in on the server.
6. **Custom SMTP** (Authentication → Emails → SMTP Settings): Supabase's built-in email only delivers to
   your Supabase team's own addresses and is heavily rate-limited, so invitations to other members need a
   provider. Resend's free tier works: verify a sending domain, then enter its SMTP host, port, user and
   password here.
7. **First administrator** (once): invitations need an admin, so the first one is made by hand.
   1. **Authentication → Users → Add user → Create new user** with your email and a password, and tick
      "Auto Confirm User".
   2. **SQL Editor**, run (with your email):

      ```sql
      update public.profiles set role = 'admin', status = 'active' where email = 'you@example.com';
      ```

   3. Sign in to the app. Invite everyone else from **Members**.

### Netlify

1. **Add new site → Import from Git** and pick this GitHub repository. Netlify detects Next.js; the build
   settings come from `netlify.toml`.
2. **Project configuration → Environment variables:** add `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (mark it as containing secret values).
   `NEXT_PUBLIC_SITE_URL` is optional: without it the app uses the project's main Netlify address.
3. Deploy. Netlify's free plan counts each **production** deploy against its monthly credits. Merge to `main`
   once per milestone and use deploy previews for work in progress.

## Security rules

- RLS is enabled on every table; `npm run test:db` fails if a table in `public` doesn't have it.
- `src/lib/supabase/admin.ts` (secret key) imports `server-only`; importing it from client code fails the
  build.
- PDF sheets live in the private `music-sheets` bucket. Browsers upload straight to Storage with a one-time
  signed URL; the server then checks the stored bytes before a sheet becomes visible. Members can't approve
  their own uploads.
- Never commit `.env*` files except `.env.example`, and never put real member data in `seed.sql`.
