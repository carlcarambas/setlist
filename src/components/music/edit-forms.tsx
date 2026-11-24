"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/features/auth/form-state";
import {
  finalizeReplacement,
  prepareReplacement,
  setArrangementStatus,
  setPieceStatus,
  updateArrangement,
  updatePiece,
} from "@/features/library/actions";
import { checkPdfFile, sha256Hex, uploadToSignedUrl } from "@/features/library/upload-client";

type Piece = {
  id: string;
  title: string;
  composer: string | null;
  category: string | null;
  description: string | null;
  tags: string[];
};

export function PieceForm({ piece, categories }: { piece: Piece; categories: string[] }) {
  const [state, action] = useActionState(updatePiece, initialFormState);
  const v = state.values;
  return (
    <form action={action} className="grid max-w-2xl gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="pieceId" value={piece.id} />
      <Field name="title" label="Title" required maxLength={200} defaultValue={v?.title ?? piece.title} errors={state.fieldErrors?.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="composer" label="Composer / artist" maxLength={200} defaultValue={v?.composer ?? piece.composer ?? ""} errors={state.fieldErrors?.composer} />
        <Field name="category" label="Category" list="music-categories" maxLength={60} defaultValue={v?.category ?? piece.category ?? ""} errors={state.fieldErrors?.category} />
        <datalist id="music-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <Field name="tags" label="Tags" hint="Separate with commas" defaultValue={v?.tags ?? piece.tags.join(", ")} errors={state.fieldErrors?.tags} />
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={v?.description ?? piece.description ?? ""} />
      </div>
      <div className="sm:w-40">
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}

type Arrangement = {
  id: string;
  title: string;
  musical_key: string | null;
  bpm: number | null;
  instrument_notes: string | null;
};

export function ArrangementForm({ arrangement }: { arrangement: Arrangement }) {
  const [state, action] = useActionState(updateArrangement, initialFormState);
  const v = state.values;
  return (
    <form action={action} className="grid max-w-2xl gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="arrangementId" value={arrangement.id} />
      <Field name="arrangementTitle" label="Arrangement name" required maxLength={200} defaultValue={v?.arrangementTitle ?? arrangement.title} errors={state.fieldErrors?.arrangementTitle} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="musicalKey" label="Key" maxLength={20} defaultValue={v?.musicalKey ?? arrangement.musical_key ?? ""} errors={state.fieldErrors?.musicalKey} />
        <Field name="bpm" label="BPM" inputMode="numeric" defaultValue={v?.bpm ?? arrangement.bpm?.toString() ?? ""} errors={state.fieldErrors?.bpm} />
      </div>
      <Field name="instrumentNotes" label="Instrument / arrangement notes" maxLength={500} defaultValue={v?.instrumentNotes ?? arrangement.instrument_notes ?? ""} errors={state.fieldErrors?.instrumentNotes} />
      <div className="sm:w-40">
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}

/** Replaces an arrangement's PDF. Plans keep pointing at the same arrangement. */
export function ReplaceFileForm({ arrangementId, maxMb }: { arrangementId: string; maxMb: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0] ?? null;
    const problem = checkPdfFile(file, maxMb);
    if (problem || !file) return setMessage(problem);

    setBusy(true);
    setMessage(null);
    try {
      const sha256 = await sha256Hex(file);
      const formData = new FormData();
      formData.set("arrangementId", arrangementId);
      formData.set("fileName", file.name);
      formData.set("fileSize", String(file.size));
      formData.set("sha256", sha256 ?? "");

      const prepared = await prepareReplacement(formData);
      if (!prepared.ok) return setMessage(prepared.message);
      if (!(await uploadToSignedUrl(prepared.path, prepared.token, file))) {
        return setMessage("The upload failed. Check your connection and try again.");
      }
      const done = await finalizeReplacement({ arrangementId, path: prepared.path, fileName: file.name, sha256 });
      if (!done.ok) return setMessage(done.message);

      toast.success("PDF replaced. Plans using this arrangement now show the new file.");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setMessage("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-3" noValidate>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <Label htmlFor="replacement">New PDF</Label>
      <input
        ref={inputRef}
        id="replacement"
        type="file"
        accept="application/pdf,.pdf"
        disabled={busy}
        className="block w-full rounded-md border bg-background text-sm file:mr-3 file:h-11 file:border-0 file:border-r file:bg-muted file:px-4 file:font-medium"
      />
      <Button type="submit" variant="outline" className="h-11 gap-2 sm:w-48" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
        {busy ? "Replacing…" : "Replace PDF"}
      </Button>
    </form>
  );
}

function StatusSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="h-11" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function ArchiveToggle({
  kind,
  id,
  archived,
  name,
}: {
  kind: "piece" | "arrangement";
  id: string;
  archived: boolean;
  name: string;
}) {
  const action = kind === "piece" ? setPieceStatus : setArrangementStatus;
  return (
    <form
      action={async (formData) => {
        await action(formData);
        toast.success(archived ? `${name} restored.` : `${name} archived.`);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={archived ? "active" : "archived"} />
      <StatusSubmit label={archived ? "Restore" : "Archive"} />
    </form>
  );
}
