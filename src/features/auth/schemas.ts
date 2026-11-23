import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254, "That email address is too long."));

// Supabase (bcrypt) ignores bytes past 72; cap there so users aren't surprised.
export const newPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(100, "Use at most 100 characters.");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const updatePasswordSchema = z
  .object({ password: newPasswordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "The passwords don't match.",
    path: ["confirmPassword"],
  });

export const acceptInvitationSchema = z
  .object({
    displayName: displayNameSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "The passwords don't match.",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({ displayName: displayNameSchema });

export const inviteMemberSchema = z.object({ email: emailSchema, displayName: displayNameSchema });

export const memberStatusSchema = z.object({
  userId: z.uuid(),
  status: z.enum(["active", "inactive"]),
});

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const appSettingsSchema = z.object({
  churchName: z.string().trim().min(1, "Enter a name.").max(120, "Use at most 120 characters."),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone."),
});
