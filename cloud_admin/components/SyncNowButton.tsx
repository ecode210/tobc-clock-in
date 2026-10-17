"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshIcon, SyncIcon } from "./icons";
import { useToast } from "./Toaster";

export function SyncNowButton() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  async function requestSync() {
    setBusy(true);
    try {
      const res = await fetch("/api/sync/request", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast("Sync requested. The laptop picks it up on its next check-in, usually within 15 seconds.");
      router.refresh();
    } catch {
      toast("Could not request a sync. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-default max-md:w-11 max-md:px-0"
        onClick={() => startRefresh(() => router.refresh())}
        disabled={refreshing}
        aria-label="Refresh status"
      >
        <RefreshIcon className={refreshing ? "animate-spin" : undefined} />
        <span className="max-md:sr-only">Refresh</span>
      </button>
      <button type="button" className="btn btn-primary" onClick={requestSync} disabled={busy}>
        <SyncIcon />
        {busy ? "Requesting…" : "Sync now"}
      </button>
    </>
  );
}
