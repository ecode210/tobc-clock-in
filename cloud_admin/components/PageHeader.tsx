export function PageHeader({
  title,
  meta,
  description,
  actions,
  back,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <div className="pb-3 pt-4 md:pb-4 md:pt-6 lg:pt-8 print:hidden">
      {back ? <div className="mb-2">{back}</div> : null}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-baseline gap-2 text-xl font-semibold tracking-tight md:text-[22px]">
            <span className="truncate">{title}</span>
            {meta !== undefined ? <span className="text-sm font-normal tabular-nums text-muted">{meta}</span> : null}
          </h1>
          {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Sticky row under the top bar holding search, filters and primary actions. */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="sticky z-20 -mx-4 flex items-center gap-2 border-b border-line bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:mx-0 md:border-0 md:px-0"
      style={{ top: "var(--topbar-h)", height: "var(--toolbar-h)" }}
    >
      {children}
    </div>
  );
}
