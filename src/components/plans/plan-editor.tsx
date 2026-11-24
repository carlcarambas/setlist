"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, Check, Eye, GripVertical, Loader2, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOnline } from "@/features/offline/use-online";
import {
  addPlanItem,
  changePlanStatus,
  removePlanItem,
  reorderPlanItems,
  updateItemNotes,
  updatePlanDetails,
  type PlanEditResult,
} from "@/features/plans/actions";
import type { PlanItemView } from "@/features/plans/queries";
import { PLAN_EDIT_MESSAGES, type PlanEditError } from "@/features/plans/schemas";
import { cn } from "@/lib/utils";
import { LibraryPanel, type SongResult } from "./library-panel";

type SaveState =
  | { kind: "idle" | "saving" | "saved" }
  | { kind: "error"; error: PlanEditError; retry: () => void }
  | { kind: "conflict" };

type EditorItem = PlanItemView & { pending?: boolean };

const TEXT_DEBOUNCE_MS = 800;

/**
 * The plan editor (spec §6). Every change is saved right away (text after a short
 * pause); edits run one at a time, in order, so each knows the plan version it's based
 * on. If someone else changed the plan first, editing stops and asks for a reload
 * instead of overwriting their work (spec §4.3).
 */
export function PlanEditor({
  plan,
  initialItems,
}: {
  plan: { id: string; title: string; description: string | null; version: number; status: "draft" | "published" };
  initialItems: PlanItemView[];
}) {
  const online = useOnline();
  const dndId = useId(); // stable across server and browser (avoids a hydration mismatch)
  const [title, setTitle] = useState(plan.title);
  const [description, setDescription] = useState(plan.description ?? "");
  const [status, setStatus] = useState(plan.status);
  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [tab, setTab] = useState<"setlist" | "library">("setlist");

  const versionRef = useRef(plan.version);
  const itemsRef = useRef<EditorItem[]>(initialItems);
  const detailsRef = useRef({ title: plan.title, description: plan.description ?? "" });
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);
  const stoppedRef = useRef(false);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const updateItems = useCallback((next: (items: EditorItem[]) => EditorItem[]) => {
    itemsRef.current = next(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  /** Runs edits one after another. `op` reads refs when it runs, so it uses the latest version. */
  const enqueue = useMemo(() => {
    type Handlers = { onOk?: (r: Extract<PlanEditResult, { ok: true }>) => void; onFail?: () => void };
    const run = (op: () => Promise<PlanEditResult>, handlers: Handlers = {}) => {
      pendingRef.current += 1;
      setSave({ kind: "saving" });
      queueRef.current = queueRef.current.then(async () => {
        if (stoppedRef.current) {
          pendingRef.current -= 1;
          return;
        }
        const result = await op().catch((): PlanEditResult => ({ ok: false, error: "error" }));
        pendingRef.current -= 1;
        if (result.ok) {
          versionRef.current = result.version;
          handlers.onOk?.(result);
          if (pendingRef.current === 0 && !stoppedRef.current) setSave({ kind: "saved" });
        } else if (result.error === "conflict" || result.error === "archived" || result.error === "not_found") {
          stoppedRef.current = true;
          handlers.onFail?.();
          setSave({ kind: "conflict" });
        } else {
          handlers.onFail?.();
          setSave({ kind: "error", error: result.error, retry: () => run(op, handlers) });
        }
      });
    };
    return run;
  }, []);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pendingRef.current > 0 || timersRef.current.size > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const debounce = useCallback((key: string, run: () => void) => {
    const timers = timersRef.current;
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        run();
      }, TEXT_DEBOUNCE_MS),
    );
  }, []);

  // ---- Title and description -------------------------------------------------
  const titleError = title.trim() ? null : "Give the plan a title.";

  function onDetailsChange(next: { title?: string; description?: string }) {
    detailsRef.current = { ...detailsRef.current, ...next };
    if (next.title !== undefined) setTitle(next.title);
    if (next.description !== undefined) setDescription(next.description);
    if (!detailsRef.current.title.trim()) return; // don't save an empty title
    setSave({ kind: "saving" });
    debounce("details", () =>
      enqueue(() =>
        updatePlanDetails({
          planId: plan.id,
          expectedVersion: versionRef.current,
          title: detailsRef.current.title,
          description: detailsRef.current.description,
        }),
      ),
    );
  }

  // ---- Songs ----------------------------------------------------------------------
  function addSong(song: SongResult, arrangement: SongResult["arrangements"][number]) {
    const tempId = `pending-${crypto.randomUUID()}`;
    updateItems((list) => [
      ...list,
      {
        id: tempId,
        arrangementId: arrangement.id,
        notes: null,
        songTitle: song.title,
        arrangementTitle: arrangement.title,
        musicalKey: arrangement.musicalKey,
        bpm: arrangement.bpm,
        fileVersion: "0",
        unavailable: false,
        pending: true,
      },
    ]);
    enqueue(
      async () => {
        const result = await addPlanItem({ planId: plan.id, arrangementId: arrangement.id });
        if (result.ok && "itemId" in result) {
          updateItems((list) => list.map((i) => (i.id === tempId ? { ...i, id: result.itemId, pending: false } : i)));
        }
        return result;
      },
      { onFail: () => updateItems((list) => list.filter((i) => i.id !== tempId)) },
    );
  }

  function removeSong(item: EditorItem) {
    const before = itemsRef.current;
    updateItems((list) => list.filter((i) => i.id !== item.id));
    enqueue(() => removePlanItem({ itemId: item.id }), { onFail: () => updateItems(() => before) });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const before = itemsRef.current;
    const from = before.findIndex((i) => i.id === active.id);
    const to = before.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    updateItems((list) => arrayMove(list, from, to));
    enqueue(
      () =>
        reorderPlanItems({
          planId: plan.id,
          expectedVersion: versionRef.current,
          itemIds: itemsRef.current.map((i) => i.id),
        }),
      { onFail: () => updateItems(() => before) },
    );
  }

  function onNotesChange(item: EditorItem, notes: string) {
    updateItems((list) => list.map((i) => (i.id === item.id ? { ...i, notes } : i)));
    setSave({ kind: "saving" });
    debounce(`notes:${item.id}`, () =>
      enqueue(() =>
        updateItemNotes({
          itemId: item.id,
          expectedVersion: versionRef.current,
          notes: itemsRef.current.find((i) => i.id === item.id)?.notes ?? "",
        }),
      ),
    );
  }

  function onStatusChange(next: "draft" | "published") {
    const before = status;
    setStatus(next);
    enqueue(() => changePlanStatus({ planId: plan.id, status: next }), { onFail: () => setStatus(before) });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Screen-reader announcements in words, not internal ids.
  const describe = (id: string | number) => {
    const index = itemsRef.current.findIndex((i) => i.id === id);
    return index < 0 ? "song" : `${itemsRef.current[index].songTitle}`;
  };
  const position = (id: string | number | undefined) =>
    id === undefined ? null : itemsRef.current.findIndex((i) => i.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(active.id)}, position ${position(active.id)} of ${itemsRef.current.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${describe(active.id)} moved to position ${position(over.id)} of ${itemsRef.current.length}.` : `${describe(active.id)} is not over a position.`,
    onDragEnd: ({ active, over }) =>
      over ? `${describe(active.id)} dropped at position ${position(over.id)}.` : `${describe(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${describe(active.id)} cancelled.`,
  };

  const locked = !online || save.kind === "conflict";
  const hasPending = items.some((i) => i.pending);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SaveIndicator save={save} online={online} />
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="plan-status" className="sr-only">
            Status
          </label>
          <select
            id="plan-status"
            value={status}
            disabled={locked}
            onChange={(e) => onStatusChange(e.target.value as "draft" | "published")}
            className="h-11 rounded-md border bg-background px-3 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <Button asChild variant="outline" className="h-11 gap-2">
            <Link href={`/plans/${plan.id}`}>
              <Eye className="size-4" aria-hidden />
              Done
            </Link>
          </Button>
        </div>
      </div>

      {!online ? (
        <p role="status" className="flex items-center gap-2 rounded-md border p-3 text-sm">
          <WifiOff className="size-4 shrink-0" aria-hidden />
          You&apos;re offline. Editing is paused until you reconnect; nothing you typed is lost.
        </p>
      ) : null}

      <fieldset disabled={locked} className="grid gap-4">
        <legend className="sr-only">Plan details</legend>
        <div className="grid gap-2">
          <Label htmlFor="plan-title">Title</Label>
          <Input
            id="plan-title"
            value={title}
            maxLength={200}
            onChange={(e) => onDetailsChange({ title: e.target.value })}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? "plan-title-error" : undefined}
            className="h-11 text-lg font-semibold"
          />
          {titleError ? (
            <p id="plan-title-error" className="text-sm text-destructive">
              {titleError}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="plan-description">Description (optional)</Label>
          <Textarea
            id="plan-description"
            value={description}
            rows={2}
            maxLength={2000}
            onChange={(e) => onDetailsChange({ description: e.target.value })}
          />
        </div>
      </fieldset>

      {/* Mobile: switch between the setlist and the library. Desktop shows both. */}
      <div role="tablist" aria-label="Editor panels" className="grid grid-cols-2 rounded-md border p-1 lg:hidden">
        {(["setlist", "library"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            onClick={() => setTab(t)}
            className={cn("h-11 rounded text-sm font-medium", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {t === "setlist" ? `Setlist (${items.length})` : "Add songs"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section
          id="panel-setlist"
          aria-labelledby="setlist-heading"
          className={cn(tab !== "setlist" && "hidden lg:block")}
        >
          <h2 id="setlist-heading" className="mb-3 font-semibold">
            Setlist ({items.length})
          </h2>
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No songs yet. Search the library{" "}
              <button type="button" className="underline underline-offset-4 lg:hidden" onClick={() => setTab("library")}>
                on the Add songs tab
              </button>
              <span className="hidden lg:inline">on the right</span> and choose an arrangement.
            </p>
          ) : (
            <DndContext
              id={dndId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
              accessibility={{
                announcements,
                screenReaderInstructions: {
                  draggable:
                    "To reorder, press Space or Enter to pick up the song, use the arrow keys to move it, then press Space or Enter to drop it. Press Escape to cancel.",
                },
              }}
            >
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ol className="grid gap-2">
                  {items.map((item, index) => (
                    <SortableSong
                      key={item.id}
                      item={item}
                      index={index}
                      disabled={locked || hasPending}
                      onRemove={() => removeSong(item)}
                      onNotesChange={(notes) => onNotesChange(item, notes)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </section>

        <section
          id="panel-library"
          aria-labelledby="library-heading"
          className={cn("lg:sticky lg:top-4 lg:self-start", tab !== "library" && "hidden lg:block")}
        >
          <h2 id="library-heading" className="mb-3 font-semibold">
            Add songs
          </h2>
          <LibraryPanel disabled={locked} onAdd={addSong} />
        </section>
      </div>
    </div>
  );
}

function SortableSong({
  item,
  index,
  disabled,
  onRemove,
  onNotesChange,
}: {
  item: EditorItem;
  index: number;
  disabled: boolean;
  onRemove: () => void;
  onNotesChange: (notes: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: disabled || item.pending,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-start gap-2 rounded-lg border bg-background p-2 sm:p-3",
        isDragging && "relative z-10 shadow-lg",
        item.pending && "opacity-60",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:cursor-not-allowed"
        aria-label={`Reorder ${item.songTitle}, position ${index + 1}`}
        disabled={disabled || item.pending}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
      <span className="mt-3 w-5 shrink-0 text-right font-mono text-sm text-muted-foreground" aria-hidden>
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <div>
          <p className="font-medium">{item.songTitle}</p>
          <p className="text-sm text-muted-foreground">
            {[item.arrangementTitle, item.musicalKey && `Key of ${item.musicalKey}`, item.bpm && `${item.bpm} BPM`]
              .filter(Boolean)
              .join(" · ")}
            {item.unavailable ? " · archived sheet" : null}
          </p>
        </div>
        <label className="sr-only" htmlFor={`notes-${item.id}`}>
          Notes for {item.songTitle}
        </label>
        <Input
          id={`notes-${item.id}`}
          value={item.notes ?? ""}
          maxLength={500}
          placeholder="Notes, e.g. intro twice, skip verse 3"
          disabled={disabled || item.pending}
          onChange={(e) => onNotesChange(e.target.value)}
          className="h-10 text-sm"
        />
      </div>
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
        <Button asChild variant="ghost" className="size-11" aria-label={`Preview ${item.songTitle}`}>
          <Link href={`/sheets/${item.arrangementId}`} target="_blank">
            <Eye className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="size-11 text-destructive hover:text-destructive"
          aria-label={`Remove ${item.songTitle}`}
          disabled={disabled || item.pending}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}

function SaveIndicator({ save, online }: { save: SaveState; online: boolean }) {
  const content = (() => {
    if (!online) return <span className="flex items-center gap-2"><WifiOff className="size-4" aria-hidden />Offline</span>;
    switch (save.kind) {
      case "saving":
        return <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" aria-hidden />Saving…</span>;
      case "saved":
        return <span className="flex items-center gap-2"><Check className="size-4" aria-hidden />All changes saved</span>;
      case "error":
        return (
          <span className="flex flex-wrap items-center gap-2 text-destructive">
            <AlertCircle className="size-4" aria-hidden />
            Save failed. {PLAN_EDIT_MESSAGES[save.error]}
            <Button type="button" variant="outline" className="h-9" onClick={save.retry}>
              Retry
            </Button>
          </span>
        );
      case "conflict":
        return (
          <span className="flex flex-wrap items-center gap-2 text-destructive">
            <AlertCircle className="size-4" aria-hidden />
            {PLAN_EDIT_MESSAGES.conflict}
            <Button type="button" variant="outline" className="h-9 gap-2" onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" aria-hidden />
              Reload
            </Button>
          </span>
        );
      default:
        return <span className="text-muted-foreground">Changes save automatically</span>;
    }
  })();
  return (
    <div role="status" aria-live="polite" className="min-h-11 content-center text-sm">
      {content}
    </div>
  );
}
