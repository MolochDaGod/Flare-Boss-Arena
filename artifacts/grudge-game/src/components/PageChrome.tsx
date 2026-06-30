import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  subtitle,
  action,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="shrink-0 flex flex-col gap-4 border-b border-[#c5a059]/20 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {kicker && (
          <p className="font-serif text-xs uppercase tracking-[0.3em] text-muted-foreground">{kicker}</p>
        )}
        <h1 className="font-serif text-4xl uppercase tracking-widest text-primary">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground font-serif tracking-widest text-sm mt-2">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}