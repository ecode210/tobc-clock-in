"use client";

import { useActionState, useEffect, useRef } from "react";
import { initialActionState, type ActionState, type FormAction } from "@/lib/action-state";

/** useActionState for forms inside a sheet: `onSuccess` runs when the action returns ok. */
export function useSheetAction(action: FormAction, onSuccess: (state: ActionState) => void) {
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });
  return useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.ok) onSuccessRef.current(result);
    return result ?? initialActionState;
  }, initialActionState);
}
