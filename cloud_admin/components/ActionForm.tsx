"use client";

import { useActionState } from "react";
import { initialActionState, type FormAction } from "@/lib/action-state";
import { FormError } from "./FormError";

export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  resetOnSuccess,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
      key={resetOnSuccess && state.ok ? state.message : undefined}
    >
      {children}
      <FormError error={state.error} />
      {state.message ? (
        <p role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
