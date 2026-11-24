# Setlist runbook

Operating notes for the live app: backups, restoring, and handling misuse. Setup and deployment steps
are in the README.

---

## Backups

**What:** `.github/workflows/backup.yml` runs every Monday at 04:00 (Manila) and on demand (GitHub →
Actions → Backup → *Run workflow*). It saves:
- `data.sql`: every row in the `public` and `auth` schemas (plans, songs, events, settings, profiles,
  administrator accounts including password hashes);
- `storage/`: every sheet PDF, by its storage path;
- `commit.txt`: the app version at backup time.

All of it is encrypted (AES-256, `BACKUP_PASSPHRASE`) into one artifact, kept 90 days.

**Before risky changes** (pushing migrations to the live database, bulk edits): run the workflow by
hand and wait for it to finish.

**The passphrase is the only way to open a backup.** Keep it in a password manager, not only in GitHub.

**What's not in a backup:**
- Supabase dashboard settings (auth, CAPTCHA, SMTP, email templates): re-apply from the README.
- Devices' offline copies: they rebuild themselves on the next sync.

---

## Restoring

Use a backup when data is lost or the project is gone. Restoring into the **same** project only makes
sense if its database was emptied. Usually you restore into a new project and point the app at it.

1. **Get the backup:** GitHub → Actions → Backup → pick a run → download the artifact, then:

   ```bash
   gpg -d setlist-backup.tar.gz.gpg > setlist-backup.tar.gz
   ```

   ```bash
   tar -xzf setlist-backup.tar.gz
   ```

   This creates `backup/` with `data.sql`, `storage/` and `commit.txt`.
2. **Prepare the target project:** create it (or empty the old one), link it, and build the schema from
   the migrations, using the app version in `commit.txt`:

   ```bash
   npx supabase link --project-ref <new-ref>
   ```

   ```bash
   npx supabase db push --remote
   ```

3. **Load the data.** Use the Session pooler connection string of the target as `TARGET_DB_URL`. Run
   these through Docker, since there's no local `psql`:

   ```bash
   docker run --rm -v "$PWD/backup:/b" postgres:17 psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -c "SET session_replication_role = replica" -c "DELETE FROM public.app_settings" -f /b/data.sql
   ```

   - `session_replication_role = replica` skips triggers. Without it, the profile trigger would create
     profiles a second time and foreign keys would trip on load order.
   - Deleting `app_settings` first removes the migration's default row; the backup has the real one.
4. **Restore the sheet files**, with the target's URL and secret key:

   ```bash
   SUPABASE_URL=https://<new-ref>.supabase.co SUPABASE_SECRET_KEY=<secret> node scripts/restore-storage.mjs backup/storage
   ```

   File records are recreated by the upload, which is why the data dump leaves out the `storage` schema.
5. **Re-apply dashboard settings** (README → Deployment → Supabase) and point Railway's variables at
   the new project. Then redeploy: `NEXT_PUBLIC_*` values are built in.
6. **Check:**
   - an administrator signs in;
   - the library shows the songs;
   - a sheet opens;
   - a new device gets past the welcome step.

### Restore drill (2026-11-24, local)

| Step | Result |
|---|---|
| Data before | 6 auth users, 6 profiles, 3 songs, 3 sheets, 2 plans, 5 plan songs, 1 event, 1 event link, 3 files, settings |
| Backup | `supabase db dump --data-only --use-copy -s public,auth` + `backup-storage.mjs` |
| Wipe | `supabase db reset --no-seed` (empty database, schema from migrations) |
| Restore | The steps above (step 3's SQL run inside the local database container; `restore-storage.mjs`) |
| After | **Identical counts**. A restored sheet downloads as a valid PDF, and the restored administrator signs in with the old password. |
| Lesson | The first attempt also dumped the `storage` schema, which would restore file records without files. The dump now covers `public,auth` only, and files are restored by upload. |

Repeat the drill against a real backup once the workflow has run in production.

---

## Misuse

Anyone with the address can use Setlist; the protections are layered:

| Layer | What it does |
|---|---|
| Bot check (Turnstile) | Every new device and every administrator sign-in passes Cloudflare's check. |
| Rate limits | Supabase allows 30 new anonymous devices per hour per IP address. |
| Archive, not delete | Members can only archive plans. Archived plans can be restored by anyone from *Plans → Show archived*. |
| Activity | Each plan's history shows which device changed what. |
| Block a device | *Administrators → Member devices → Block.* The device loses access at once. Someone determined can clear their browser and come back as a new device, so blocking slows misuse down rather than ending it. |
| Permanent delete | Only administrators can delete plans or events, and music can only be archived. |

**If plans get vandalized:**
1. Block the device.
2. Restore archived plans, or fix them in the editor.
3. Check the history to see what else that device touched.

**If it keeps happening:** raise the bot check's difficulty in Cloudflare (Turnstile widget → mode), and
consider the rate limits in Supabase → Auth → Rate limits.

---

## Costs and limits to watch (monthly)

| What | Limit | Where to look |
|---|---|---|
| Supabase storage (sheets) | 1 GB on Free | Supabase → Project → Usage |
| Supabase egress (sheet downloads, sync) | 5 GB/month on Free | same |
| Supabase pausing | Free projects pause after 7 days without database activity | an email from Supabase before it happens |
| Railway usage | Your usage limit (Workspace → Usage) | Railway dashboard |

**Rough egress:**
- About 30 members keeping 2 plans of 8 sheets (~1.5 MB each) a week is about 3 GB a month.
- Sync itself is tiny (kilobytes).
- If it approaches 5 GB, upgrade Supabase to Pro (250 GB) or ask members to keep only the week's plan.
