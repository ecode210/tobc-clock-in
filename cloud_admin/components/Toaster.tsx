"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckIcon, XIcon } from "./icons";

type Toast = { id: number; text: string; tone: "success" | "error" };
type ToastFn = (text: string, tone?: Toast["tone"]) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const toast = useCallback<ToastFn>(
    (text, tone = "success") => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-2), { id, text, tone }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-6 md:items-end"
        style={{ bottom: "calc(var(--tabbar-h) + 0.75rem)" }}
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl bg-zinc-900 py-2.5 pl-3 pr-1.5 text-sm text-white shadow-lg animate-[toast-in_180ms_ease-out]"
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                t.tone === "success" ? "bg-emerald-500" : "bg-red-500"
              }`}
              aria-hidden
            >
              {t.tone === "success" ? <CheckIcon className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
            </span>
            <p className="min-w-0 flex-1 leading-5">{t.text}</p>
            <button
              type="button"
              className="-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-white"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
