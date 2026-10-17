"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { FormError } from "@/components/FormError";
import { ResponsiveSheet, SheetBody, SheetFooter, sheetFormClass } from "@/components/ResponsiveSheet";
import { SubmitButton } from "@/components/SubmitButton";
import { useToast } from "@/components/Toaster";
import { initialActionState } from "@/lib/action-state";
import { setDefaultCutoffAction } from "./actions";

export function CutoffCard({ cutoff }: { cutoff: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <section className="panel mt-4 px-4 py-4 md:px-5">
      <h2 className="text-sm font-semibold">On-time cutoff</h2>
      <p className="mt-0.5 text-[13px] text-muted">Clock-ins at or before this time count as on time.</p>
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-2xl font-semibold tabular-nums leading-8">{cutoff}</p>
        <button type="button" className="btn btn-primary shrink-0" onClick={() => setOpen(true)} aria-haspopup="dialog">
          Update
        </button>
      </div>
      <ResponsiveSheet open={open} onClose={close} title="Update on-time cutoff"
        description="Set the latest on-time clock-in."
      >
        <CutoffForm cutoff={cutoff} onDone={close} />
      </ResponsiveSheet>
    </section>
  );
}

function CutoffForm({ cutoff, onDone }: { cutoff: string; onDone: () => void }) {
  const [state, formAction] = useActionState(setDefaultCutoffAction, initialActionState);
  const toast = useToast();

  useEffect(() => {
    if (!state.ok) return;
    if (state.message) toast(state.message);
    onDone();
  }, [state, toast, onDone]);

  return (
    <form action={formAction} className={sheetFormClass}>
      <SheetBody>
        <label htmlFor="default-cutoff" className="label">
          Cutoff time
        </label>
        <input
          id="default-cutoff"
          name="cutoff"
          type="time"
          required
          defaultValue={cutoff}
          className="input tabular-nums"
        />
        <FormError error={state.error} />
      </SheetBody>
      <SheetFooter>
        <button type="button" className="btn btn-default" onClick={onDone}>
          Cancel
        </button>
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </SheetFooter>
    </form>
  );
}
