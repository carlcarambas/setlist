import { z } from "zod";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

/** "hymn, Easter , hymn" → ["hymn", "easter"]: trimmed, lower-case, unique, max 20. */
export const tagsSchema = z
  .string()
  .default("")
  .transform((raw) =>
    Array.from(
      new Set(
        raw
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ),
  )
  .pipe(
    z
      .array(z.string().max(30, "Each tag must be at most 30 characters."))
      .max(20, "Use at most 20 tags."),
  );

export const pieceSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200, "Use at most 200 characters."),
  composer: optionalText(200, "Composer"),
  category: optionalText(60, "Category"),
  description: optionalText(2000, "Description"),
  tags: tagsSchema,
});

export const arrangementSchema = z.object({
  arrangementTitle: z
    .string()
    .trim()
    .min(1, "Name this arrangement, e.g. \"Original\" or \"Key of C\".")
    .max(200, "Use at most 200 characters."),
  musicalKey: optionalText(20, "Key"),
  bpm: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(
      z
        .number({ error: "BPM must be a number." })
        .int("BPM must be a whole number.")
        .min(20, "BPM must be between 20 and 400.")
        .max(400, "BPM must be between 20 and 400.")
        .nullable(),
    ),
  instrumentNotes: optionalText(500, "Notes"),
});

export const MAX_FILENAME = 255;

export function fileSchema(maxBytes: number) {
  return z.object({
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(MAX_FILENAME, "The file name is too long.")
      .refine((n) => n.toLowerCase().endsWith(".pdf"), "Only PDF files can be uploaded."),
    fileSize: z.coerce
      .number()
      .int()
      .positive("The file is empty.")
      .max(maxBytes, `The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`),
    sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable()
      .catch(null),
  });
}

export const PAGE_SIZE = 25;

export const librarySearchSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  category: z.string().trim().max(60).catch(""),
  tag: z.string().trim().toLowerCase().max(30).catch(""),
  archived: z
    .string()
    .optional()
    .transform((v) => v === "1")
    .catch(false),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type LibrarySearch = z.infer<typeof librarySearchSchema>;


export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
