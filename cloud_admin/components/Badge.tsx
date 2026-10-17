const TONES = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  gray: "bg-zinc-100 text-zinc-600 ring-zinc-500/15",
  brand: "bg-primary-soft text-primary-hover ring-primary/15",
  violet: "bg-secondary-soft text-secondary-hover ring-secondary/15",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({ tone = "gray", dot, children }: { tone?: BadgeTone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function DeviceBadge({ locked }: { locked: boolean }) {
  return locked ? (
    <Badge tone="violet" dot>
      Locked
    </Badge>
  ) : (
    <Badge tone="gray">Pending setup</Badge>
  );
}
