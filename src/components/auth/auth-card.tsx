import type { ReactNode } from "react";

/** A sign-in style screen: centred heading, then the form, flat on the page. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2 text-center">
        <h1 className="text-[1.75rem] leading-tight font-medium md:text-3xl">{title}</h1>
        {description ? <p className="text-pretty text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-11 animate-pulse rounded-full bg-muted" />
    </div>
  );
}
