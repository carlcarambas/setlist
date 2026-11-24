"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check, Copy, Link2, Loader2, Share2, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createShareLink,
  revokeShare,
  revokeShareLink,
  searchMembersToShare,
  shareWithMember,
  type ShareResult,
} from "@/features/sharing/actions";
import type { PlanSharing } from "@/features/sharing/queries";
import { LINK_EXPIRY_OPTIONS, linkState, type LinkExpiry, type SharePermission } from "@/features/sharing/schemas";

const selectClass =
  "h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50";

type Candidate = Awaited<ReturnType<typeof searchMembersToShare>>[number];

/** Owner-only sharing controls (spec §4.5): members as viewer/editor, and view-only links. */
export function ShareButton({ planId, planTitle, sharing }: { planId: string; planTitle: string; sharing: PlanSharing }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="h-11 gap-2" onClick={() => setOpen(true)}>
        <Share2 className="size-4" aria-hidden />
        Share
        {sharing.shares.length ? <span className="text-muted-foreground">({sharing.shares.length})</span> : null}
      </Button>
      {open ? <ShareDialog planId={planId} planTitle={planTitle} sharing={sharing} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ShareDialog({
  planId,
  planTitle,
  sharing,
  onClose,
}: {
  planId: string;
  planTitle: string;
  sharing: PlanSharing;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal(); // native modal: focus trap and Esc to close
      dialog.querySelector<HTMLInputElement>("input[type=search]")?.focus();
    }
  }, []);

  /** Runs a sharing action and announces the outcome. */
  function run(action: () => Promise<ShareResult | { ok: false; message: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      setStatus(result.ok ? { kind: "ok", text: success } : { kind: "error", text: result.message });
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[min(100vw-1rem,40rem)] max-w-none rounded-lg border bg-background p-0 text-foreground backdrop:bg-black/50"
    >
      <div className="flex max-h-[min(90dvh,48rem)] flex-col">
        <header className="flex items-start gap-2 border-b p-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-semibold">
              Share “{planTitle}”
            </h2>
            <p className="text-sm text-muted-foreground">You stay the owner. Only you can change sharing.</p>
          </div>
          <Button variant="ghost" className="size-11 shrink-0" onClick={() => dialogRef.current?.close()} aria-label="Close">
            <X className="size-5" aria-hidden />
          </Button>
        </header>

        <div className="grid gap-6 overflow-y-auto p-4">
          <p
            role={status?.kind === "error" ? "alert" : "status"}
            className={status ? (status.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground") : "sr-only"}
          >
            {status?.text}
          </p>

          <MembersSection planId={planId} sharing={sharing} pending={pending} run={run} />
          <LinksSection planId={planId} sharing={sharing} pending={pending} setStatus={setStatus} run={run} />
        </div>
      </div>
    </dialog>
  );
}

function MembersSection({
  planId,
  sharing,
  pending,
  run,
}: {
  planId: string;
  sharing: PlanSharing;
  pending: boolean;
  run: (action: () => Promise<ShareResult>, success: string) => void;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [newPermission, setNewPermission] = useState<SharePermission>("viewer");
  const sharedIds = new Set(sharing.shares.map((s) => s.userId));

  useEffect(() => {
    if (query.trim().length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchMembersToShare(query).catch(() => []);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const visible = query.trim().length >= 2 ? (results ?? []).filter((r) => !sharedIds.has(r.id)) : [];

  return (
    <section aria-labelledby={`${searchId}-heading`} className="grid gap-3">
      <h3 id={`${searchId}-heading`} className="text-sm font-semibold">
        Members
      </h3>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor={searchId} className="sr-only">
            Find a member by name or email
          </label>
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a member by name or email"
            className="h-11"
            autoComplete="off"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only sm:not-sr-only">Add as</span>
          <select
            className={`${selectClass} h-11`}
            value={newPermission}
            onChange={(e) => setNewPermission(e.target.value as SharePermission)}
            aria-label="Permission for new members"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
        </label>
      </div>

      {query.trim().length >= 2 ? (
        <div aria-live="polite">
          {searching && !results ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Searching…
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other active members match.</p>
          ) : (
            <ul className="grid gap-1">
              {visible.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{m.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                  </span>
                  <Button
                    variant="outline"
                    className="h-10 shrink-0 gap-1"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => shareWithMember({ planId, userId: m.id, permission: newPermission }),
                        `${m.name} can now ${newPermission === "editor" ? "edit" : "view"} this plan.`,
                      )
                    }
                    aria-label={`Add ${m.name} as ${newPermission}`}
                  >
                    <UserPlus className="size-4" aria-hidden />
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {sharing.shares.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members have access yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {sharing.shares.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 p-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.email}</span>
              </span>
              <select
                className={selectClass}
                value={s.permission}
                disabled={pending}
                aria-label={`Permission for ${s.name}`}
                onChange={(e) => {
                  const permission = e.target.value as SharePermission;
                  run(
                    () => shareWithMember({ planId, userId: s.userId, permission }),
                    `${s.name} is now ${permission === "editor" ? "an editor" : "a viewer"}.`,
                  );
                }}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <Button
                variant="ghost"
                className="size-10"
                disabled={pending}
                onClick={() => run(() => revokeShare({ shareId: s.id }), `${s.name} no longer has access.`)}
                aria-label={`Remove ${s.name}'s access`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Viewers can open the plan and its sheets. Editors can also change songs, order and notes.</p>
    </section>
  );
}

function LinksSection({
  planId,
  sharing,
  pending,
  setStatus,
  run,
}: {
  planId: string;
  sharing: PlanSharing;
  pending: boolean;
  setStatus: (status: { kind: "ok" | "error"; text: string } | null) => void;
  run: (action: () => Promise<ShareResult>, success: string) => void;
}) {
  const headingId = useId();
  const [expiry, setExpiry] = useState<LinkExpiry>("7d");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, startCreating] = useTransition();

  function create() {
    startCreating(async () => {
      const result = await createShareLink({ planId, expiry });
      if (!result.ok) {
        setStatus({ kind: "error", text: result.message });
        return;
      }
      setCreated(`${window.location.origin}${result.path}`);
      setCopied(false);
      setStatus({ kind: "ok", text: "Link created. Copy it now: it won't be shown again." });
    });
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
      setStatus({ kind: "ok", text: "Link copied." });
    } catch {
      setStatus({ kind: "error", text: "Couldn't copy automatically. Select the link and copy it." });
    }
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <h3 id={headingId} className="text-sm font-semibold">
        View-only link
      </h3>
      <p className="text-sm text-muted-foreground">
        Anyone with the link can view this plan and its sheets without signing in. They can&apos;t edit it or see anything else.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          className={`${selectClass} h-11`}
          value={expiry}
          onChange={(e) => setExpiry(e.target.value as LinkExpiry)}
          aria-label="Link expiry"
        >
          {LINK_EXPIRY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button className="h-11 gap-2" onClick={create} disabled={creating || pending}>
          {creating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
          Create link
        </Button>
      </div>

      {created ? (
        <div className="grid gap-2 rounded-md border border-primary/40 bg-muted/40 p-3">
          <label htmlFor={`${headingId}-url`} className="text-sm font-medium">
            New link (copy it now: for security it won&apos;t be shown again)
          </label>
          <div className="flex gap-2">
            <Input
              id={`${headingId}-url`}
              readOnly
              value={created}
              className="h-11 font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button variant="outline" className="h-11 shrink-0 gap-2" onClick={copy}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}

      {sharing.links.length ? (
        <ul className="divide-y rounded-md border">
          {sharing.links.map((link) => {
            const state = linkState(link);
            return (
              <li key={link.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block">Link created {formatDate(link.created_at)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {state === "revoked"
                      ? `Revoked ${formatDate(link.revoked_at!)}`
                      : state === "expired"
                        ? `Expired ${formatDate(link.expires_at!)}`
                        : link.expires_at
                          ? `Active · expires ${formatDate(link.expires_at)}`
                          : "Active · never expires"}
                  </span>
                </span>
                {state === "active" ? (
                  <Button
                    variant="outline"
                    className="h-10"
                    disabled={pending}
                    onClick={() => run(() => revokeShareLink({ linkId: link.id }), "Link revoked. It no longer opens the plan.")}
                    aria-label={`Revoke link created ${formatDate(link.created_at)}`}
                  >
                    Revoke
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
}
