import Link from "next/link";
import { XIcon } from "./icons";

export type FilterChip = { label: string; href: string };

/** Removable chips for active filters, plus a clear-all link. */
export function FilterChips({ chips, clearHref }: { chips: FilterChip[]; clearHref: string }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-3 pt-1 md:pt-0">
      {chips.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          scroll={false}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface pl-3 pr-1.5 text-[13px] text-foreground hover:border-line-strong md:h-7"
          aria-label={`Remove filter ${c.label}`}
        >
          {c.label}
          <XIcon className="h-3.5 w-3.5 text-muted" />
        </Link>
      ))}
      {chips.length > 1 ? (
        <Link href={clearHref} scroll={false} className="ml-1 px-1.5 text-[13px] font-medium text-muted hover:text-foreground">
          Clear all
        </Link>
      ) : null}
    </div>
  );
}
