# Launch checklist

Do these in order. **You** = steps in your accounts. **Me** = steps I run when you say go. Tick each box.

---

## 0. Before anything

- [ ] **You:** delete or disconnect the old Netlify site (Netlify → Site → Site configuration → Delete
  site, or Build & deploy → Stop builds). Otherwise merging into `main` starts a Netlify build.
- [ ] **You:** have a password manager entry ready for: the Supabase database password, the Turnstile
  secret, the backup passphrase.

## 1. Cloudflare Turnstile (bot check, free)

- [ ] **You:** Cloudflare dashboard → Turnstile → *Add widget*.
  - Name: Setlist.
  - Hostnames: your Railway address once you have it (step 3). You can add it later; `localhost` isn't
    needed.
  - Mode: *Managed*.
- [ ] **You:** copy the **site key** (public) and the **secret key** (keep private).

## 2. Supabase (the existing project)

- [ ] **You:** Settings → General → rename the project to **setlist** (optional, cosmetic).
- [ ] **You:** Authentication → Sign In / Providers:
  - **Allow new users to sign up: on** (required for member devices);
  - **Allow anonymous sign-ins: on**;
  - Email provider: on.
- [ ] **You:** Authentication → Attack Protection → **Enable CAPTCHA**: provider *Turnstile*, paste the
  **secret key**.
- [ ] **Me:** clear the old test data from Milestones 1–2. Your administrator account stays.
- [ ] **Me:** run the Backup workflow once (needs step 5's secrets), then `npx supabase db push --remote`
  for the new migrations. **I'll show you the list and wait for your OK before it runs.**
- [ ] **You:** Authentication → Emails → templates: paste `supabase/templates/invite.html` and
  `recovery.html` (I'll send their contents).
- [ ] **You (optional now, needed for inviting more admins):** Authentication → Emails → SMTP with
  Resend. This needs a sending domain you own. Members never need email, so this can wait.
- [ ] **You:** if you don't have an administrator yet, make the first one (README → Deployment →
  Supabase → step 8).

## 3. Railway

- [ ] **You:** New Project → Deploy from GitHub repo → this repository, branch **main**.
- [ ] **You:** Variables (from Supabase → Settings → API keys, and step 1):

  | Name | Value |
  |---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
  | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
  | `SUPABASE_SECRET_KEY` | `sb_secret_…` (mark as sealed) |
  | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile **site** key |

- [ ] **You:** Settings → Networking → **Generate domain**. Note it (`https://<name>.up.railway.app`).
- [ ] **You:** add that hostname to the Turnstile widget (step 1).
- [ ] **You:** Supabase → Authentication → URL Configuration:
  - Site URL = the Railway address;
  - redirect URLs `https://<name>.up.railway.app/**` and `http://localhost:3000/**`.
- [ ] **You:** Settings → Deploy → healthcheck path `/robots.txt`.
- [ ] **You:** Workspace → Usage → set a **usage limit** you're comfortable with.

## 4. Release

- [ ] **Me:** open one pull request bringing Milestones 3–10 into `main`. You merge it. Railway deploys it.
- [ ] **You:** the first deploy only works once all four variables exist. If a deploy ran before that,
  press *Redeploy*.

## 5. Backups

- [ ] **You:** GitHub → repository → Settings → Secrets and variables → Actions → add:
  - `SUPABASE_DB_URL`: Supabase → Connect → Session pooler string, with your database password;
  - `SUPABASE_URL`;
  - `SUPABASE_SECRET_KEY`;
  - `BACKUP_PASSPHRASE`: a long random phrase, **also saved in your password manager**.
- [ ] **You:** Actions → Backup → *Run workflow*. It should finish green with an artifact.

## 6. Smoke test on the live address (together)

- [ ] A phone that has never opened it: the welcome step passes, and Home shows songs.
- [ ] Library search; a song; *View* a sheet.
- [ ] Create a plan, add two songs, reorder, add it to an event.
- [ ] **Share** the plan to yourself; open the link on another phone.
- [ ] **Keep offline**, airplane mode, open the plan and every sheet.
- [ ] Administrator sign-in; upload a PDF; sign out (the device carries on as a member).
- [ ] If SMTP is set up: invite another administrator and accept the email.

Then continue with [`device-checklist.md`](device-checklist.md) and [`member-trial.md`](member-trial.md).
