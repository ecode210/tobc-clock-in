"use client";

import { useState } from "react";
import { logout } from "@/app/(portal)/actions";
import { LogoutIcon } from "./icons";
import { ResponsiveSheet, SheetBody, SheetFooter, sheetFormClass } from "./ResponsiveSheet";
import { SubmitButton } from "./SubmitButton";

/** Confirmation before signing out: dialog on desktop, bottom sheet on mobile. */
export function SignOutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ResponsiveSheet open={open} onClose={onClose} title="Sign out?" description="End your admin session.">
      <form action={logout} className={sheetFormClass}>
        <SheetBody>
          <p className="text-sm text-zinc-600">You will need your username and password to sign in again.</p>
        </SheetBody>
        <SheetFooter>
          <button type="button" className="btn btn-default" onClick={onClose} data-autofocus>
            Cancel
          </button>
          <SubmitButton pendingText="Signing out…">Sign out</SubmitButton>
        </SheetFooter>
      </form>
    </ResponsiveSheet>
  );
}

export function SignOutButton({
  className = "btn btn-default",
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={iconOnly ? "Sign out" : undefined}
        title={iconOnly ? "Sign out" : undefined}
      >
        <LogoutIcon className={iconOnly ? "h-4 w-4" : undefined} />
        {iconOnly ? null : "Sign out"}
      </button>
      <SignOutSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
