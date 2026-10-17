"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { hrefWith } from "@/lib/url";
import { FilterIcon } from "./icons";
import { ResponsiveSheet, SheetBody, SheetFooter, sheetFormClass } from "./ResponsiveSheet";

/**
 * Filters button with an active-count badge. The sheet's form fields map 1:1 to query params;
 * Apply writes them to the URL (empty values are removed), Reset clears `keys`.
 */
export function FiltersSheet({
  params,
  keys,
  activeCount,
  description,
  children,
}: {
  params: Record<string, string>;
  keys: string[];
  activeCount: number;
  description: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function apply(updates: Record<string, string | null>) {
    setOpen(false);
    router.push(hrefWith(pathname, params, updates), { scroll: false });
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-default relative shrink-0 max-md:w-11 max-md:px-0"
        onClick={() => setOpen(true)}
        aria-label={activeCount ? `Filters, ${activeCount} active` : "Filters"}
      >
        <FilterIcon />
        <span className="max-md:sr-only">Filters</span>
        {activeCount ? (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold leading-none text-white max-md:absolute max-md:-right-1 max-md:-top-1">
            {activeCount}
          </span>
        ) : null}
      </button>
      <ResponsiveSheet open={open} onClose={() => setOpen(false)} title="Filters" description={description}>
        <form
          className={sheetFormClass}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const updates: Record<string, string | null> = {};
            for (const k of keys) updates[k] = String(fd.get(k) ?? "").trim() || null;
            apply(updates);
          }}
        >
          <SheetBody className="space-y-4">{children}</SheetBody>
          <SheetFooter>
            <button
              type="button"
              className="btn btn-default"
              onClick={() => apply(Object.fromEntries(keys.map((k) => [k, null])))}
            >
              Reset
            </button>
            <button type="submit" className="btn btn-primary">
              Apply filters
            </button>
          </SheetFooter>
        </form>
      </ResponsiveSheet>
    </>
  );
}
