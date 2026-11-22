# Setlist — Music Ministry Planning Platform
## Product Requirements & Technical Specification

**Document status:** Initial implementation baseline  
**Version:** 1.0  
**Date:** 2026-11-22  
**Product name:** Setlist (working name)  
**Primary platform:** Responsive web application  
**Initial organization model:** One church / one music ministry  
**Primary users:** Music ministry members and administrators

---

## 1. Product Summary

Setlist is a collaborative web application for a church music ministry. It centralizes PDF music sheets and enables members to create multiple music plans (setlists), associate plans with church events, reorder songs, and share plans with other members or through shareable links.

### 1.1 Product vision

> Plan the music. Share the setlist. Serve together.

### 1.2 Goals

1. Maintain one searchable, shared music library.
2. Let every active member upload and manage music entries.
3. Let members create multiple plans and events.
4. Make it easy to search for songs, select an arrangement, and add it to a plan.
5. Support drag-and-drop reordering.
6. Let plan owners share plans with registered members or through links.
7. Support collaborative editing for members who have edit access.
8. Make music sheets accessible on desktop, tablet, and mobile browsers.
9. Keep infrastructure and maintenance costs low for a solo developer.

### 1.3 Non-goals for the MVP

Do not implement these unless the core MVP is complete:

- Native iOS or Android applications
- Multi-church tenant administration
- Musician or instrument assignment
- Rehearsal scheduling
- Chat, comments, or discussion threads
- Push notifications
- Real-time multiplayer editing / live cursors
- Chord transposition or automatic chord recognition
- AI song recommendations
- Automatic sheet music generation
- Payments or subscriptions

---

## 2. Product Decisions

These decisions are confirmed and should be treated as requirements:

| Area | Decision |
|---|---|
| Organization scope | Single church / music ministry |
| Registration | Invitation-based membership is preferred |
| Music library | All active members can upload and manage music |
| Music format | PDF for MVP |
| Plans | Members can create multiple plans |
| Plan editing | All members who have access with Editor permission can edit |
| Sharing | Both registered-member sharing and shareable links |
| Link access | View-only by default |
| Platform | Responsive web application |
| Initial budget | Minimize recurring costs; use free tiers during development |
| Architecture | Simple modular application; avoid microservices |

### 2.1 Important access distinction

"All members can edit plans" means all members explicitly granted access as Editors can edit a shared plan. It does **not** mean every registered member automatically has access to every private plan.

The plan owner can grant Viewer or Editor access. The owner retains ownership and control of sharing.

---

## 3. Users and Permissions

### 3.1 User types

**Member**
- Can access the shared music library.
- Can upload music and arrangements.
- Can edit music metadata and archive music.
- Can create multiple plans and events.
- Owns plans they create.
- Can view or edit plans shared with them according to their permission.

**Administrator**
- Has all member capabilities.
- Can invite, activate, deactivate, and manage members.
- Can manage application-level settings.
- Can perform administrative recovery actions when necessary.
- Does not automatically become the owner of every plan.

### 3.2 Plan-level permissions

| Capability | Owner | Editor | Viewer | Public link viewer |
|---|---:|---:|---:|---:|
| View plan | Yes | Yes | Yes | Yes |
| View referenced music sheets | Yes | Yes | Yes | Yes |
| Add songs | Yes | Yes | No | No |
| Remove songs | Yes | Yes | No | No |
| Reorder songs | Yes | Yes | No | No |
| Edit plan title/description | Yes | Yes | No | No |
| Manage member shares | Yes | No | No | No |
| Create/revoke public links | Yes | No | No | No |
| Delete/archive plan | Yes | No | No | No |

An administrator may have a documented recovery override, but normal access should still be enforced through resource-level authorization.

### 3.3 Membership lifecycle

- New users should join through an invitation or administrator-approved process.
- Only active members can sign in and access protected resources.
- Deactivated members must lose access, including access through previously issued public or private sessions where feasible.
- Existing records created by a deactivated user must remain intact.
- Never hard-delete user records merely because membership is deactivated.

---

## 4. Functional Requirements

Priority definitions:
- **Must:** Required for MVP.
- **Should:** Important but can follow the first usable release.
- **Could:** Optional enhancement.

### 4.1 Authentication and membership

| ID | Requirement | Priority |
|---|---|---|
| AUTH-01 | Users can sign in securely | Must |
| AUTH-02 | Users can sign out | Must |
| AUTH-03 | Users can reset forgotten passwords | Must |
| AUTH-04 | Users can view and update their profile | Should |
| AUTH-05 | Administrators can invite members | Must |
| AUTH-06 | Administrators can activate/deactivate members | Must |
| AUTH-07 | Unauthorized users cannot access private application pages or data | Must |

Use managed authentication. Do not build password storage or authentication cryptography from scratch.

### 4.2 Music library

| ID | Requirement | Priority |
|---|---|---|
| LIB-01 | Active members can upload PDF music sheets | Must |
| LIB-02 | Music title is required | Must |
| LIB-03 | Members can search by title | Must |
| LIB-04 | Members can view music details | Must |
| LIB-05 | Members can preview PDFs in the browser | Must |
| LIB-06 | Members can download PDFs | Must |
| LIB-07 | Members can edit music metadata | Must |
| LIB-08 | Members can archive music | Must |
| LIB-09 | A music piece can have multiple arrangements | Must |
| LIB-10 | An arrangement can specify a musical key | Should |
| LIB-11 | An arrangement can specify an instrument/arrangement description | Should |
| LIB-12 | Members can filter by category or tags | Should |
| LIB-13 | System detects possible duplicate uploads | Should |
| LIB-14 | System records uploader and timestamps | Must |
| LIB-15 | Members can replace an arrangement PDF without silently breaking existing references | Should |

#### Music piece vs. arrangement

A `MusicPiece` represents the song itself. An `Arrangement` represents a specific sheet/version of that song.

Example:

**Amazing Grace**
- Original arrangement — Key of G
- Transposed arrangement — Key of C
- Guitar chord sheet
- Vocal arrangement

A plan item must reference a specific arrangement, not merely the general music piece.

#### Music metadata

Music piece:
- Title
- Composer / artist (optional)
- Description (optional)
- Category (optional)
- Tags (optional)
- Status: active or archived
- Created by
- Created at
- Updated by
- Updated at

Arrangement:
- Music piece ID
- Arrangement title
- Musical key (optional)
- BPM (optional)
- Instrument / arrangement notes (optional)
- Private storage object key
- Original filename
- File size and MIME type
- Uploaded by
- Uploaded at
- Status

#### Library rules

- All active members can upload and edit metadata.
- Prefer archive over permanent deletion.
- A music piece or arrangement referenced by a plan must not be hard-deleted through normal UI actions.
- Replacing a PDF should not change the identity of the arrangement unexpectedly.
- Validate uploaded content. Do not trust the filename or browser-provided MIME type alone.
- Set a configurable upload-size limit appropriate for PDF sheet music (initial default: 20 MB; make configurable).

### 4.3 Plan / setlist management

| ID | Requirement | Priority |
|---|---|---|
| PLAN-01 | Members can create multiple plans | Must |
| PLAN-02 | Plan title is required | Must |
| PLAN-03 | Plan description is optional | Should |
| PLAN-04 | Members can search the music library from the plan editor | Must |
| PLAN-05 | Members can add a selected arrangement to a plan | Must |
| PLAN-06 | Members can remove a plan item | Must |
| PLAN-07 | Members can reorder items using drag and drop | Must |
| PLAN-08 | Members can open/preview the selected sheet from the plan | Must |
| PLAN-09 | Plans save changes reliably | Must |
| PLAN-10 | Members can duplicate a plan | Should |
| PLAN-11 | Members can archive a plan | Should |
| PLAN-12 | Members can add notes to a plan item | Should |
| PLAN-13 | Members can see who last updated a plan | Should |
| PLAN-14 | Plan activity is recorded for important changes | Should |

#### Plan fields

- ID
- Title
- Description
- Owner user ID
- Status: draft, published, archived
- Version number for concurrency protection
- Created at / by
- Updated at / by

A plan can exist without an event. A plan is private to its owner until shared.

#### Plan item fields

- ID
- Plan ID
- Arrangement ID
- Position (integer)
- Notes (optional)
- Added by
- Created at
- Updated at

#### Ordering rules

- Position determines the visible order.
- Reordering must be persisted transactionally.
- Reordering should use one server operation for the new ordered item IDs or positions.
- The server must verify that every submitted item belongs to the plan.
- Concurrent changes must not silently overwrite another member's changes.

#### Autosave behavior

- Save after a short debounce for text fields.
- Add/remove/reorder actions should persist promptly.
- Show clear save states: Saving, Saved, and Save failed.
- On failure, preserve the user's unsaved input and provide retry.
- Use a plan version or equivalent optimistic concurrency mechanism.
- If a stale update is rejected, show a conflict message and allow refresh/retry; do not silently overwrite.

### 4.4 Events

| ID | Requirement | Priority |
|---|---|---|
| EVT-01 | Members can create events | Must |
| EVT-02 | Event title is required | Must |
| EVT-03 | Event date is required | Must |
| EVT-04 | Event time is optional | Should |
| EVT-05 | Members can add a description | Should |
| EVT-06 | Members can associate multiple plans with an event | Must |
| EVT-07 | A plan can exist without an event | Must |
| EVT-08 | Members can view upcoming and past events | Must |
| EVT-09 | Members can duplicate an event | Could |

Event fields:
- ID
- Title
- Description
- Event date
- Start time (optional)
- Created by
- Created at
- Updated at

Use a join table for event-plan associations. An event can have multiple plans, and a plan may be associated with more than one event if the product rules allow it. Removing an association must not delete either record.

Use the church's configured timezone for event display and date interpretation. Initial default can be `Asia/Manila`, but store timestamps consistently and avoid relying on browser-local timezone.

### 4.5 Sharing

| ID | Requirement | Priority |
|---|---|---|
| SHARE-01 | Owners can share a plan with registered members | Must |
| SHARE-02 | Owners can assign Viewer or Editor permission | Must |
| SHARE-03 | Owners can revoke a member's access | Must |
| SHARE-04 | Owners can create a shareable link | Must |
| SHARE-05 | Public links are view-only by default | Must |
| SHARE-06 | Owners can revoke a link | Must |
| SHARE-07 | Owners can optionally set link expiration | Should |
| SHARE-08 | Public links expose only the selected plan and its referenced arrangements | Must |
| SHARE-09 | Shared plans appear in the recipient's Shared with Me area | Must |

#### Share link security

- Generate cryptographically random, unguessable tokens.
- Store only a hash of the token in the database.
- Never use sequential IDs as public access tokens.
- Allow the owner to revoke a link.
- Check expiration and revocation on every public-link access.
- Do not expose database credentials, private storage keys, or unrelated records.
- Public-link access must not grant access to the full music library.
- Public link permissions must be constrained to Viewer for MVP unless an explicit, separately reviewed Editor-link feature is implemented.

### 4.6 Dashboard

The dashboard should include:
- Upcoming events
- Recently updated plans owned by the user
- Plans shared with the user
- Recently added music
- Quick action to create a plan
- Quick action to upload music

Keep the dashboard focused. Avoid unnecessary charts and administrative metrics in the MVP.

---

## 5. Main User Journeys

### 5.1 Upload music

1. Member opens Music Library.
2. Member selects Add Music.
3. Member uploads a PDF.
4. Member enters the music title and optional metadata.
5. Member saves.
6. The system validates the file and stores it privately.
7. The music piece and arrangement become searchable.
8. The system records the uploader.

### 5.2 Create a plan

1. Member opens My Plans.
2. Member selects Create Plan.
3. Member enters a title and optional description.
4. The system creates a draft owned by the member.
5. Member searches the library inside the editor.
6. Member selects a specific arrangement.
7. Member adds it to the plan.
8. Member repeats for additional songs.
9. Member drags songs into the desired order.
10. The system saves changes and updates the plan activity.
11. Member shares the plan if needed.

### 5.3 Collaborate

1. Owner opens a plan.
2. Owner shares it with a registered member.
3. Owner chooses Viewer or Editor.
4. Recipient sees the plan in Shared with Me.
5. Editor can add, remove, and reorder songs.
6. Viewer can view and access referenced PDFs but cannot modify the plan.
7. Important changes record the actor and timestamp.

### 5.4 Share by link

1. Owner opens Share.
2. Owner creates a view-only link.
3. System generates a secure token and stores its hash.
4. Owner copies and distributes the link.
5. Recipient opens the link.
6. System validates the token and displays only the shared plan and referenced music sheets.
7. Owner can revoke the link at any time.

---

## 6. Application Pages and Navigation

### Primary navigation

- Dashboard
- Music Library
- My Plans
- Events
- Shared with Me
- Profile / Settings

Administrator-only:
- Member Management
- Application Settings

### Required screens

| Screen | Purpose |
|---|---|
| Sign in | Authenticate member |
| Invitation acceptance | Join the music ministry |
| Dashboard | Overview and quick actions |
| Music Library | Search and browse music |
| Add/Edit Music | Upload PDF and manage metadata |
| Music Details | View arrangements and preview PDFs |
| My Plans | List owned plans |
| Plan Editor | Search, add, remove, reorder music |
| Plan Details | Read-only/shared plan view |
| Events | List upcoming and past events |
| Event Details | View event and associated plans |
| Shared with Me | List plans shared with current user |
| Public Plan | View plan through a valid share link |
| Profile | Update personal information |
| Member Management | Administrator membership controls |

### Plan Editor UX

The Plan Editor is the most important screen in the product.

Desktop:
- Main area: ordered setlist.
- Side panel: searchable music library.
- Header: plan title, event association, share action, save state.
- Song row: drag handle, order, title, arrangement/key, PDF preview action, remove action.

Mobile:
- Use tabs, drawers, or stacked panels.
- Keep the setlist easy to read and reorder.
- Ensure controls have touch-friendly target sizes.
- PDF preview should use the available screen width.

### Design principles

- Responsive and mobile-friendly.
- Clear typography and restrained visual design.
- Prioritize music title and arrangement details.
- Avoid clutter and unnecessary dashboard widgets.
- Provide useful empty states.
- Provide clear loading, error, and save states.
- Keyboard accessibility for important controls.
- Do not rely on color alone to communicate permission or status.

---

## 7. Technical Architecture

### 7.1 Architecture decision

Use a **Next.js modular monolith with Supabase** for the MVP.

Do not create a separate NestJS API or microservices initially. This is a small application maintained by one developer, and the additional server deployment and maintenance would not provide enough value yet.

Use server-side operations for privileged actions and authorization-sensitive workflows. Use Supabase client capabilities only where Row Level Security (RLS) policies make the operation safe.

### 7.2 Recommended stack

| Layer | Technology |
|---|---|
| Web framework | Next.js (App Router) |
| Language | TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Form validation | Zod + React Hook Form |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| File storage | Supabase Storage |
| Database types | Supabase generated TypeScript types |
| PDF preview | PDF.js / react-pdf |
| Drag and drop | dnd-kit |
| Hosting | Netlify |
| Source control | GitHub |
| Optional DNS | Cloudflare DNS |

Use current stable, mutually compatible package versions at implementation time. Do not pin obsolete versions from this document.

### 7.3 High-level architecture

```text
Browser (desktop / tablet / mobile)
              |
              v
        Next.js application
        - App Router
        - UI components
        - Server actions / route handlers
        - Server-side authorization
              |
       +------+------+
       |             |
       v             v
Supabase Auth   Supabase PostgreSQL
                      |
                      v
                Supabase Storage
                Private PDF bucket

GitHub repository
       |
       v
Netlify build and deployment
```

### 7.4 Backend approach

Use Next.js server actions or route handlers for:
- Creating and updating plans
- Reordering plan items
- Sharing and revoking access
- Creating and revoking share links
- Upload authorization and metadata operations
- Administrator actions
- Any operation requiring multi-step validation or transactions

Use Supabase Auth for identity.

Use PostgreSQL RLS as a second security boundary. Never rely only on frontend checks.

Avoid exposing the Supabase service-role key to browser code. Keep it server-side and use it only for operations that genuinely require elevated privileges.

### 7.5 Suggested source structure

```text
src/
  app/
    (auth)/
      sign-in/
      accept-invitation/
    (app)/
      dashboard/
      library/
      plans/
      events/
      shared/
      settings/
      admin/
    share/
      [token]/
    api/
  components/
    ui/
    layout/
    music/
    plans/
    events/
    sharing/
  features/
    auth/
    members/
    music-library/
    plans/
    events/
    sharing/
  lib/
    supabase/
      client.ts
      server.ts
      middleware.ts
    permissions/
    validation/
    utils/
  types/
  hooks/

supabase/
  migrations/
  seed.sql

public/
```

Keep business logic in feature/service modules rather than putting all logic into page components.

---

## 8. Database Specification

Use PostgreSQL with UUID primary keys.

### 8.1 Tables

#### profiles

- `id` UUID, primary key, references auth user
- `display_name` text, required
- `email` text, where needed for display/search
- `role` enum: `member`, `admin`
- `status` enum: `active`, `inactive`, `invited`
- `created_at` timestamptz
- `updated_at` timestamptz

#### music_pieces

- `id` UUID, primary key
- `title` text, required
- `composer` text, nullable
- `description` text, nullable
- `category` text, nullable
- `status` enum: `active`, `archived`
- `created_by` UUID, references profiles
- `updated_by` UUID, references profiles
- `created_at` timestamptz
- `updated_at` timestamptz

#### arrangements

- `id` UUID, primary key
- `music_piece_id` UUID, references music_pieces
- `title` text, required
- `musical_key` text, nullable
- `bpm` integer, nullable
- `instrument_notes` text, nullable
- `storage_path` text, required
- `original_filename` text, required
- `mime_type` text, required
- `file_size_bytes` bigint, required
- `status` enum: `active`, `archived`
- `uploaded_by` UUID, references profiles
- `created_at` timestamptz
- `updated_at` timestamptz

#### plans

- `id` UUID, primary key
- `title` text, required
- `description` text, nullable
- `owner_id` UUID, references profiles
- `status` enum: `draft`, `published`, `archived`
- `version` integer, default 1
- `created_at` timestamptz
- `updated_at` timestamptz
- `updated_by` UUID, references profiles

#### plan_items

- `id` UUID, primary key
- `plan_id` UUID, references plans
- `arrangement_id` UUID, references arrangements
- `position` integer, required
- `notes` text, nullable
- `added_by` UUID, references profiles
- `created_at` timestamptz
- `updated_at` timestamptz

Add an index on `(plan_id, position)`. Consider a uniqueness constraint on `(plan_id, position)` and implement reorder operations safely to avoid transient collisions.

#### plan_shares

- `id` UUID, primary key
- `plan_id` UUID, references plans
- `user_id` UUID, references profiles
- `permission` enum: `viewer`, `editor`
- `created_by` UUID, references profiles
- `created_at` timestamptz
- Unique constraint on `(plan_id, user_id)`

#### plan_links

- `id` UUID, primary key
- `plan_id` UUID, references plans
- `token_hash` text, unique, required
- `permission` enum: `viewer` only for MVP
- `expires_at` timestamptz, nullable
- `revoked_at` timestamptz, nullable
- `created_by` UUID, references profiles
- `created_at` timestamptz

Never store the raw public token.

#### events

- `id` UUID, primary key
- `title` text, required
- `description` text, nullable
- `event_date` date, required
- `start_time` time, nullable
- `created_by` UUID, references profiles
- `created_at` timestamptz
- `updated_at` timestamptz

#### event_plans

- `id` UUID, primary key
- `event_id` UUID, references events
- `plan_id` UUID, references plans
- `position` integer, default 0
- `created_at` timestamptz
- Unique constraint on `(event_id, plan_id)`

#### plan_activities

- `id` UUID, primary key
- `plan_id` UUID, references plans
- `user_id` UUID, references profiles
- `action` text or enum
- `metadata` jsonb, nullable
- `created_at` timestamptz

Record important events such as plan creation, title changes, song added/removed, reorder, sharing changes, and archive actions. Do not log secrets or raw share tokens.

### 8.2 Database rules

- Use foreign keys and appropriate indexes.
- Use soft deletion/archive for music and plans.
- Use transactions or PostgreSQL functions for multi-row reorder operations.
- Validate that an arrangement belongs to an active music piece before adding it to a plan.
- Validate that an arrangement is accessible to the current user.
- Use optimistic concurrency for plan updates.
- Avoid storing duplicate profile data that can be derived safely from the auth provider.
- Generate database types and keep application types aligned with migrations.

### 8.3 Future organization support

The first release is for one church. Do not implement multi-tenant management.

However, keep organization ownership easy to introduce later. Avoid hardcoding church names or organization-specific assumptions throughout business logic. An `organization_id` can be added in a later migration if another church needs its own workspace.

---

## 9. File Storage and PDF Security

### 9.1 Storage

Use a private Supabase Storage bucket named `music-sheets`.

Example object path:

```text
music-sheets/{music_piece_id}/{arrangement_id}/{file_name}.pdf
```

Do not use public buckets for music sheets.

### 9.2 Upload flow

1. Authenticate the user.
2. Confirm the user is an active member.
3. Validate file size.
4. Validate actual PDF content; do not trust extension alone.
5. Upload to private storage.
6. Save arrangement metadata and storage path.
7. If metadata persistence fails, clean up the uploaded object or record it for cleanup.
8. Record uploader and timestamp.

### 9.3 Viewing and downloading

- Check the user's plan/library permission before issuing access.
- Generate short-lived signed URLs for authorized files.
- Public plan links may access only arrangements referenced by that plan.
- Do not expose raw private storage paths as authorization.
- Consider a server-side download route if signed URL exposure or revocation semantics require tighter control.

### 9.4 Backup

- Export database data regularly.
- Keep a separate backup of important PDFs or use a storage backup strategy.
- Test restoration, not just backup creation.
- Supabase Free does not include automatic backups; production should use a paid plan or a deliberate independent backup process.

---

## 10. Authorization and RLS

RLS is mandatory for all user-accessible tables and storage objects.

### 10.1 Core access rules

**Profiles**
- Members can view the minimum profile information needed to identify other members.
- Users can update only their own profile fields.
- Only administrators can change roles or membership status.

**Music library**
- Active members can read active music pieces and arrangements.
- Active members can insert and update music records.
- Archive operations are allowed for active members, subject to references and safe business rules.
- Inactive users cannot access the library.

**Plans**
- Owner can read and manage their plans.
- Shared Editors can read and modify the plan and its items.
- Shared Viewers can read the plan and its items.
- Other members cannot read private plans.

**Plan shares**
- Only the plan owner can grant or revoke shares.
- Recipients can see their own share records.
- A user cannot grant themselves access.

**Public links**
- Validate the token through a controlled server-side path.
- Do not expose a broad table policy that lets anonymous users enumerate plans or tokens.
- Public access is limited to the exact plan and its referenced arrangements.
- Revoked or expired tokens must fail.

**Events**
- Define a consistent single-church visibility rule. Recommended MVP: active members can view events; creators and authorized members can manage them. If event privacy is later required, add event-level sharing.

**Storage**
- Keep the bucket private.
- Storage RLS must verify active membership and appropriate library/plan access.
- Never assume that hiding a download button secures the PDF.

### 10.2 Security implementation requirements

- Use the authenticated user's identity from the verified session.
- Never trust user IDs supplied by the browser for ownership decisions.
- Never expose service-role secrets in client bundles.
- Validate every mutation server-side.
- Add tests for unauthorized access and cross-user access.
- Test anonymous share-link access separately from authenticated member access.

---

## 11. API / Server Operation Requirements

Use Next.js server actions or route handlers. Keep operations grouped by feature.

Suggested operations:

### Music library
- `listMusicPieces`
- `getMusicPiece`
- `createMusicPiece`
- `updateMusicPiece`
- `archiveMusicPiece`
- `createArrangement`
- `updateArrangement`
- `archiveArrangement`
- `createAuthorizedSheetUrl`

### Plans
- `listMyPlans`
- `listSharedPlans`
- `getPlan`
- `createPlan`
- `updatePlan`
- `archivePlan`
- `duplicatePlan`
- `addPlanItem`
- `removePlanItem`
- `reorderPlanItems`

### Sharing
- `sharePlanWithMember`
- `updateMemberPermission`
- `revokeMemberShare`
- `createPlanLink`
- `revokePlanLink`
- `getPublicPlanByToken`

### Events
- `listEvents`
- `createEvent`
- `updateEvent`
- `archiveEvent` (optional)
- `addPlanToEvent`
- `removePlanFromEvent`

### Members
- `listMembers`
- `inviteMember`
- `deactivateMember`
- `updateOwnProfile`

Every operation must:
1. Validate input with Zod.
2. Verify the authenticated user.
3. Verify active membership.
4. Verify resource-level permission.
5. Perform the operation safely.
6. Return a typed, minimal result.
7. Avoid returning secrets or internal storage credentials.

Do not create an endpoint for every database query automatically. Keep the API surface focused on business operations.

---

## 12. Hosting and Budget Plan

### 12.1 Recommended MVP hosting

Use:

- **Netlify Free** — Next.js application hosting and Git-based deployments.
- **Supabase Free** — PostgreSQL, Auth, and private PDF storage.
- **GitHub Free** — source control.
- **Cloudflare DNS** — optional DNS management.
- **Custom domain** — optional during development; purchase when ready to launch.

This avoids maintaining a virtual machine, Docker host, separate API server, and database server.

### 12.2 Why not Vercel Hobby for production?

Vercel Hobby is intended for personal, non-commercial use. Since this app is intended to serve a church music ministry, use a plan/provider whose terms fit the actual use. Vercel Pro is a paid alternative.

### 12.3 Free-tier limitations to plan for

Supabase Free currently includes:
- 500 MB database size per project
- 1 GB file storage
- 5 GB egress and 5 GB cached egress
- 50,000 monthly active users
- Projects may pause after one week of inactivity
- No automatic backups

Netlify Free currently uses a monthly credit allowance with hard limits. Monitor usage and verify current plan limits before launch.

Free tiers are suitable for development and an initial pilot, but do not treat them as a guaranteed production service.

### 12.4 Production upgrade path

When church members begin depending on the app:

- Upgrade Supabase to Pro (currently listed at $25/month).
- Keep Netlify Free if its usage allowance remains sufficient.
- Upgrade Netlify only if usage or required features justify it.
- Consider Cloudflare R2 for PDFs if storage or egress economics make it worthwhile.
- Add an independent database and file backup process.

Indicative starting production budget:
- Supabase Pro: approximately USD $25/month.
- Netlify Free: USD $0/month, within usage limits.
- Domain: additional annual cost.
- Optional email provider: depends on invitation/reset email volume and provider plan.

Prices and quotas can change. Check official pricing pages before subscribing:

- Netlify: https://www.netlify.com/pricing/
- Supabase: https://supabase.com/pricing
- Vercel: https://vercel.com/pricing
- Render: https://render.com/pricing
- Cloudflare R2: https://developers.cloudflare.com/r2/pricing/

### 12.5 Cost controls

- Set usage alerts where available.
- Do not enable paid overages without understanding the billing impact.
- Keep PDF uploads size-limited.
- Paginate library and plan queries.
- Avoid unnecessary realtime subscriptions.
- Use signed URLs with sensible expiry.
- Avoid duplicating PDF files when a plan references an existing arrangement.
- Track storage and egress usage monthly.
- Export backups independently.

---

## 13. Non-functional Requirements

| Area | Requirement |
|---|---|
| Responsiveness | Support mobile, tablet, and desktop |
| Security | Authenticated access, RLS, private storage |
| Performance | Paginated lists and indexed search |
| Reliability | Preserve user input after recoverable failures |
| Data integrity | Foreign keys and transactional mutations |
| Accessibility | Keyboard-accessible controls and semantic markup |
| Maintainability | Feature-based modular code organization |
| Observability | Useful server logs and error reporting |
| Portability | Standard PostgreSQL schema and portable PDF object paths |
| Cost | Free tiers during development; low recurring production cost |

### Performance targets (initial goals)

- Common pages should render quickly under normal broadband/mobile conditions.
- Paginate library and plan lists.
- Avoid loading full PDFs until preview is requested.
- Use PDF.js range loading where supported.
- Avoid loading the entire music library into browser memory.
- Search should remain responsive with a few thousand music pieces.

Do not promise strict uptime or performance SLAs for free-tier hosting.

---

## 14. MVP Delivery Plan

Build in small, verifiable milestones. Do not implement every feature in one large change.

### Milestone 0 — Repository and project foundation

- Create Next.js App Router project.
- Configure TypeScript and linting.
- Configure Tailwind and shadcn/ui.
- Configure Supabase client/server helpers.
- Configure environment variables.
- Create initial responsive layout and navigation.
- Configure GitHub repository and Netlify deployment.
- Add README with local setup instructions.

**Exit criteria:** Application deploys successfully and environment configuration is documented.

### Milestone 1 — Authentication and membership

- Sign in/sign out.
- Invitation acceptance.
- Profile creation.
- Active/inactive membership.
- Administrator member management.
- Protected routes.
- Initial RLS policies.

**Exit criteria:** Only active members can access protected application data.

### Milestone 2 — Music library

- Database migrations for music pieces and arrangements.
- Private PDF bucket.
- Upload and validation.
- Music metadata CRUD.
- Multiple arrangements.
- Search and filtering.
- PDF preview and download.
- Archive behavior.

**Exit criteria:** Active members can safely upload, find, preview, and download music sheets.

### Milestone 3 — Plans and plan editor

- Plan CRUD.
- Add arrangement to plan.
- Remove plan item.
- Drag-and-drop reorder.
- Autosave / save states.
- Version-based conflict handling.
- Duplicate plan.
- Activity history.

**Exit criteria:** A member can create a complete setlist and reload it without losing order or data.

### Milestone 4 — Sharing and collaboration

- Member search for sharing.
- Viewer/Editor permissions.
- Shared with Me page.
- Plan access enforcement.
- Share link creation and revocation.
- Expiration support.
- Public plan view.
- Referenced PDF access.

**Exit criteria:** Viewer/editor permissions work correctly, and public links cannot expose unrelated data.

### Milestone 5 — Events and dashboard

- Event CRUD.
- Associate multiple plans with an event.
- Upcoming and past event lists.
- Dashboard summaries.
- Responsive refinements.

**Exit criteria:** Members can organize multiple plans under real church events.

### Milestone 6 — Hardening and launch

- Authorization tests.
- RLS tests.
- Upload security tests.
- Mobile usability checks.
- Backup and restore procedure.
- Error handling and logging.
- Production environment setup.
- User acceptance testing with a small group of music ministry members.

---

## 15. MVP Acceptance Checklist

### Authentication
- [ ] Member can sign in and sign out.
- [ ] Invitation flow works.
- [ ] Inactive member cannot access protected data.
- [ ] Administrator can deactivate a member.

### Music library
- [ ] Member can upload a valid PDF.
- [ ] Invalid file types are rejected.
- [ ] File size limit is enforced.
- [ ] Member can create a music piece.
- [ ] Member can add multiple arrangements.
- [ ] Member can search music.
- [ ] Member can preview and download authorized PDFs.
- [ ] Archived music is excluded by default.
- [ ] Existing plan references are not broken by archive actions.

### Plans
- [ ] Member can create multiple plans.
- [ ] Member can add a selected arrangement.
- [ ] Member can remove a plan item.
- [ ] Member can reorder songs.
- [ ] Order persists after refresh.
- [ ] Save failures are visible and recoverable.
- [ ] Duplicate plan creates a separate plan and does not copy existing shares.

### Events
- [ ] Member can create an event.
- [ ] Event can have multiple plans.
- [ ] Plan can exist without an event.
- [ ] Removing an event-plan association does not delete the plan.

### Sharing
- [ ] Owner can share with a registered member.
- [ ] Viewer cannot modify.
- [ ] Editor can modify.
- [ ] Owner can revoke member access.
- [ ] Owner can create a view-only link.
- [ ] Owner can revoke a public link.
- [ ] Expired links fail.
- [ ] Public link cannot access unrelated plans or library records.

### Quality
- [ ] Responsive desktop layout works.
- [ ] Responsive mobile layout works.
- [ ] Important actions are keyboard accessible.
- [ ] Errors and empty states are clear.
- [ ] Database and file backup/restore process is documented.

---

## 16. Implementation Instructions for Codex / Claude Code

Treat this document as the product requirements baseline.

### General instructions

1. Inspect the existing repository before making changes.
2. If the repository is empty, initialize the project using the stack specified here.
3. Do not assume a feature exists without inspecting the code.
4. Do not implement all milestones in one pass.
5. Before implementation, produce a concise plan identifying files, schema changes, and dependencies.
6. Work milestone by milestone.
7. Use database migrations for all schema changes.
8. Generate and use Supabase TypeScript database types.
9. Implement and test RLS policies; never rely only on frontend authorization.
10. Never expose service-role keys or other secrets to the browser.
11. Validate all inputs on the server.
12. Add tests for important business rules and unauthorized access.
13. Keep components small and organized by feature.
14. Use responsive layouts from the beginning.
15. Do not add unnecessary dependencies or infrastructure.
16. Do not introduce microservices or a separate NestJS API for the MVP.
17. Do not add features listed as non-goals unless explicitly approved.
18. Update README and environment variable examples when implementation changes require it.
19. Do not commit secrets, local environment files, or real user data.
20. Run lint, type checking, tests, and production build before considering a milestone complete.

### Required implementation order

Implement in this order:

1. Milestone 0 — Project foundation
2. Milestone 1 — Authentication and membership
3. Milestone 2 — Music library
4. Milestone 3 — Plans and plan editor
5. Milestone 4 — Sharing and collaboration
6. Milestone 5 — Events and dashboard
7. Milestone 6 — Hardening and launch

### Definition of done for each milestone

A milestone is complete only when:
- The relevant user flows work end-to-end.
- Database migrations are included.
- RLS policies are included and tested where applicable.
- Validation and error handling exist.
- Responsive behavior has been checked.
- Tests pass.
- Lint and type checks pass.
- Documentation is updated.
- No unrelated functionality has been changed.

### First task for the coding agent

Do not immediately build the entire application.

Start by:
1. Inspecting the repository.
2. Confirming the current project state.
3. Proposing the exact folder structure and dependencies.
4. Proposing the initial Supabase schema and RLS strategy.
5. Listing environment variables and setup steps.
6. Producing a Milestone 0 implementation plan for approval.

Wait for approval before making broad implementation changes.

---

## 17. Open Decisions

Use sensible defaults unless a decision materially affects security or data integrity. Ask before making irreversible decisions.

| Question | Initial default |
|---|---|
| Registration | Invitation-only |
| Default public link permission | Viewer |
| PDF maximum size | 20 MB, configurable |
| Event timezone | Asia/Manila |
| Plan default status | Draft |
| Music deletion | Archive |
| Plan duplication | Copy items, not shares |
| Public link expiration | Optional |
| Realtime editing | Not in MVP |
| Multi-church support | Not in MVP |

---

## 18. Product Success Criteria

The first release is successful when a small group of music ministry members can independently:

1. Sign in.
2. Find a song in the shared library.
3. Preview its music sheet.
4. Create a plan for a service or event.
5. Add multiple songs.
6. Reorder the songs.
7. Share the plan with the band.
8. Allow another member to edit it.
9. Open the plan and its PDFs on a phone.

The product should make this workflow easier than coordinating setlists through chat messages and manually sharing PDF files.

**Build the simplest reliable version of this workflow first.**

---

## 19. Approved Amendments

Approved 2026-11-22. Details and rationale: [`docs/implementation-plan.md`](docs/implementation-plan.md) §7–§8.
Where an amendment conflicts with an earlier section of this document, the amendment wins.

| # | Amendment | Affects |
|---|---|---|
| P1 | PDFs upload directly from the browser to Supabase Storage through a server-issued signed upload URL; the server then validates the stored bytes (`%PDF-` header, `%%EOF` trailer, size) before activating the arrangement. Arrangements gain a `pending` status for uploads not yet validated. | §4.2, §8.1, §9.2 |
| P2 | Sheet routes authorize the request and redirect to a short-lived signed URL; they never stream PDF bytes through the app server. | §9.3 |
| P3 | Add `music_pieces.tags text[]`, `arrangements.content_sha256`, and a single-row `app_settings` table (church name, timezone). | §8.1 |
| P4 | Plan version must match for reorder and title/description edits; adding or removing items increments the version without requiring a match. | §4.3 |
| P5 | Custom SMTP and a sending domain are required from Milestone 1 (Supabase's built-in email only reaches project team members). | §12, §14 |
| P6 | Add reset-password and `/auth/confirm` routes; Next.js 16 uses `src/proxy.ts` instead of `middleware.ts`. | §6, §7.5 |
| P7 | Ambiguity defaults: `published` is a label only; any active member creates events, creator or admin edits/deletes them; events are hard-deleted (associations cascade); archived music stays readable but cannot be added to plans; public links stop working when the owner is inactive; shares survive owner deactivation and an admin transfer-ownership action follows in Milestone 6; anyone who can view a plan can duplicate it; plan owners and editors attach plans to events; event pages show only plans the viewer can access; active members can see member emails for share search; password-based invitation acceptance. | §3, §4, §10 |
| P8 | Installable through a web app manifest only; no service worker or offline caching. | §1, constitution |
