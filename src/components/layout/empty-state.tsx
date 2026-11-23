import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
      <Icon className="mb-3 size-8 text-muted-foreground" aria-hidden />
      <h2 className="font-medium">{title}</h2>
      {children ? (
        <div className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>
      ) : null}
    </div>
  );
}
