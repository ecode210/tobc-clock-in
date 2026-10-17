"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { hrefWith } from "@/lib/url";
import { SearchIcon, XIcon } from "./icons";

/** Live search bound to the `q` query param. Re-key it on `params.q` so it follows the URL. */
export function SearchInput({ params, placeholder }: { params: Record<string, string>; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(params.q ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | undefined>(undefined);

  function go(q: string) {
    window.clearTimeout(timer.current);
    startTransition(() => router.replace(hrefWith(pathname, params, { q: q.trim() || null }), { scroll: false }));
  }

  return (
    <form
      role="search"
      className="relative min-w-0 flex-1 md:max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
    >
      <SearchIcon
        className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${pending ? "text-primary" : "text-muted"}`}
      />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => go(next), 300);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className="input pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted hover:text-foreground"
          onClick={() => {
            setValue("");
            go("");
          }}
          aria-label="Clear search"
        >
          <XIcon className="h-4 w-4" />
        </button>
      ) : null}
    </form>
  );
}
