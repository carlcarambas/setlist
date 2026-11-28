import { useId, type ReactNode } from "react";

/** One block of the Settings page: a heading, a line of explanation, then flat content. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <div className="grid gap-1">
        <h2 id={id} className="text-2xl font-semibold text-balance">
          {title}
        </h2>
        {description ? <p className="text-base text-pretty text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A name and its value on one hairline-divided row. Use inside a <dl>. */
export function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b py-3">
      <dt className="text-charcoal">{label}</dt>
      <dd className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3 text-right break-words">{children}</dd>
    </div>
  );
}
