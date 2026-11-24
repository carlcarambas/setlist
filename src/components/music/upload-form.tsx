"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  abandonUpload,
  finalizeUpload,
  findPossibleDuplicates,
  prepareUpload,
  type DuplicateHint,
} from "@/features/library/actions";
import { checkPdfFile, sha256Hex, uploadToSignedUrl } from "@/features/library/upload-client";
import type { FormState } from "@/features/auth/form-state";

type Phase = "idle" | "uploading" | "checking";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  uploading: "Uploading…",
  checking: "Checking the file…",
};

/**
 * Add music (new piece + first arrangement) or, with `pieceId`, add an arrangement to an
 * existing piece. The PDF goes straight to Storage; the server then verifies it.
 */
export function UploadForm({
  maxMb,
  categories = [],
  pieceId,
}: {
  maxMb: number;
  categories?: string[];
  pieceId?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sha256, setSha256] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [duplicates, setDuplicates] = useState<DuplicateHint[]>([]);
  const busy = phase !== "idle";
  const isNewPiece = !pieceId;

  async function checkDuplicates(nextSha: string | null) {
    if (!isNewPiece) return;
    const title = (formRef.current?.elements.namedItem("title") as HTMLInputElement | null)?.value ?? "";
    setDuplicates(await findPossibleDuplicates({ title, sha256: nextSha }));
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    const problem = checkPdfFile(next, maxMb);
    setState(problem && next ? { status: "error", message: problem, fieldErrors: { file: [problem] } } : { status: "idle" });
    const hash = next && !problem ? await sha256Hex(next) : null;
    setSha256(hash);
    if (hash) await checkDuplicates(hash);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fileProblem = checkPdfFile(file, maxMb);
    if (fileProblem || !file) {
      setState({ status: "error", message: fileProblem ?? "Choose a PDF file.", fieldErrors: { file: [fileProblem ?? ""] } });
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.delete("file");
    formData.set("fileName", file.name);
    formData.set("fileSize", String(file.size));
    formData.set("sha256", sha256 ?? "");
    if (pieceId) formData.set("pieceId", pieceId);

    setPhase("uploading");
    setState({ status: "idle" });
    try {
      const prepared = await prepareUpload(formData);
      if (!prepared.ok) {
        setState({ status: "error", message: prepared.message, fieldErrors: prepared.fieldErrors });
        return;
      }

      const uploaded = await uploadToSignedUrl(prepared.path, prepared.token, file);
      if (!uploaded) {
        await abandonUpload({ arrangementId: prepared.arrangementId, createdPiece: prepared.createdPiece });
        setState({ status: "error", message: "The upload failed. Check your connection and try again." });
        return;
      }

      setPhase("checking");
      const result = await finalizeUpload({
        arrangementId: prepared.arrangementId,
        createdPiece: prepared.createdPiece,
      });
      if (!result.ok) {
        setState({ status: "error", message: result.message, fieldErrors: { file: [result.message] } });
        return;
      }

      toast.success(isNewPiece ? "Music added." : "Arrangement added.");
      router.push(`/song?id=${result.pieceId}`);
    } catch {
      setState({ status: "error", message: "Something went wrong. Check your connection and try again." });
    } finally {
      setPhase("idle");
    }
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid max-w-2xl gap-6" noValidate>
      <FormMessage state={state} />

      {isNewPiece ? (
        <fieldset className="grid gap-4" disabled={busy}>
          <legend className="mb-2 font-semibold">Song</legend>
          <Field
            name="title"
            label="Title"
            required
            maxLength={200}
            errors={errors.title}
            onBlur={() => checkDuplicates(sha256)}
          />
          {duplicates.length ? <DuplicateWarning duplicates={duplicates} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="composer" label="Composer / artist (optional)" maxLength={200} errors={errors.composer} />
            <Field
              name="category"
              label="Category (optional)"
              list="music-categories"
              maxLength={60}
              hint="e.g. Hymn, Worship, Communion"
              errors={errors.category}
            />
            <datalist id="music-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <Field
            name="tags"
            label="Tags (optional)"
            hint="Separate with commas, e.g. easter, christmas"
            errors={errors.tags}
          />
          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" name="description" maxLength={2000} rows={3} />
          </div>
        </fieldset>
      ) : null}

      <fieldset className="grid gap-4" disabled={busy}>
        <legend className="mb-2 font-semibold">{isNewPiece ? "Sheet" : "New arrangement"}</legend>
        <Field
          name="arrangementTitle"
          label="Arrangement name"
          defaultValue={isNewPiece ? "Original" : ""}
          hint="e.g. Original, Key of C, Guitar chords, Vocal"
          required
          maxLength={200}
          errors={errors.arrangementTitle}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="musicalKey" label="Key (optional)" maxLength={20} placeholder="e.g. G" errors={errors.musicalKey} />
          <Field name="bpm" label="BPM (optional)" inputMode="numeric" placeholder="e.g. 72" errors={errors.bpm} />
        </div>
        <Field
          name="instrumentNotes"
          label="Instrument / arrangement notes (optional)"
          maxLength={500}
          errors={errors.instrumentNotes}
        />

        <div className="grid gap-2">
          <Label htmlFor="file">PDF file</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            required
            onChange={onFileChange}
            aria-invalid={errors.file?.length ? true : undefined}
            aria-describedby="file-hint"
            className="block w-full rounded-md border bg-background text-sm file:mr-3 file:h-11 file:border-0 file:border-r file:bg-muted file:px-4 file:font-medium"
          />
          <p id="file-hint" className="text-xs text-muted-foreground">
            PDF only, up to {maxMb} MB.
          </p>
          {file && !errors.file?.length ? (
            <p className="flex items-center gap-2 text-sm">
              <FileText className="size-4" aria-hidden />
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          ) : null}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" className="h-11 sm:w-48" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {busy ? PHASE_LABEL[phase] : isNewPiece ? "Add music" : "Add arrangement"}
        </Button>
        <Button type="button" variant="ghost" className="h-11" disabled={busy} onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DuplicateWarning({ duplicates }: { duplicates: DuplicateHint[] }) {
  return (
    <div role="status" className="flex gap-3 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">This might already be in the library:</p>
        <ul className="mt-1 list-disc pl-5">
          {duplicates.map((d) => (
            <li key={d.musicPieceId}>
              <Link href={`/song?id=${d.musicPieceId}`} target="_blank" className="underline underline-offset-4">
                {d.title}
              </Link>{" "}
              ({d.reason === "same_file" ? "same file" : "similar title"})
            </li>
          ))}
        </ul>
        <p className="mt-1 text-muted-foreground">
          You can still upload. To add a new version of an existing song, open it and choose
          &ldquo;Add arrangement&rdquo; instead.
        </p>
      </div>
    </div>
  );
}
