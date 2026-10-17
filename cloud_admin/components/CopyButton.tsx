"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";

export function CopyButton({
  value,
  label,
  className = "",
  children,
}: {
  value: string;
  label: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (children) {
    return (
      <button type="button" onClick={copy} className={`btn btn-default ${className}`}>
        {copied ? <CheckIcon className="h-4 w-4 text-emerald-600" /> : <CopyIcon />}
        {copied ? "Copied" : children}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`btn btn-ghost btn-icon text-muted hover:text-foreground ${className}`}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
    >
      {copied ? <CheckIcon className="h-4 w-4 text-emerald-600" /> : <CopyIcon />}
    </button>
  );
}

/** A labelled monospace value with a copy button, e.g. a username or setup code. */
export function CopyField({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-full border border-line bg-subtle py-1 pl-4 pr-1">
      <div className="min-w-0 py-1">
        <p className="text-xs text-muted">{label}</p>
        <p
          className={`truncate font-mono ${
            emphasis ? "text-lg font-semibold tracking-[0.2em] text-foreground" : "text-[15px] font-medium"
          }`}
        >
          {value}
        </p>
      </div>
      <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
    </div>
  );
}
