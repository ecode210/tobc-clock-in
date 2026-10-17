"use client";

import { useEffect, useId, useRef, useState } from "react";
import { XIcon } from "./icons";

let scrollLocks = 0;

function lockScroll() {
  if (scrollLocks++ === 0) document.documentElement.style.overflow = "hidden";
}

function unlockScroll() {
  if (--scrollLocks === 0) document.documentElement.style.overflow = "";
}

const CLOSE_MS = 180;
const DRAG_DISMISS_PX = 90;

/**
 * Centered modal dialog at >= 768px, bottom sheet below. Children render only while open,
 * so forms inside reset each time. Put focus on an element at open with `data-autofocus`.
 */
export function ResponsiveSheet({
  open,
  onClose,
  title,
  description,
  size,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Short subtitle under the title. The header leaves room for it, so always pass one. */
  description: React.ReactNode;
  size?: "lg";
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dragRef = useRef<{ startY: number; dy: number } | null>(null);
  const [rendered, setRendered] = useState(open);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  if (open && !rendered) setRendered(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (dialog.open) {
        dialog.removeAttribute("data-closing");
        return;
      }
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.removeAttribute("data-closing");
      dialog.showModal();
      lockScroll();
      const target = dialog.querySelector<HTMLElement>("[data-autofocus]") ?? panelRef.current;
      target?.focus({ preventScroll: true });
      return;
    }
    if (!dialog.open) return;
    dialog.setAttribute("data-closing", "");
    const timer = window.setTimeout(() => {
      dialog.close();
      dialog.removeAttribute("data-closing");
      unlockScroll();
      setRendered(false);
      const el = returnFocusRef.current;
      if (el && el.isConnected) el.focus({ preventScroll: true });
    }, CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) {
        dialog.close();
        unlockScroll();
      }
    };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" || window.matchMedia("(min-width: 768px)").matches) return;
    if ((e.target as HTMLElement).closest("button,a,input,select,textarea")) return;
    dragRef.current = { startY: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    drag.dy = Math.max(0, e.clientY - drag.startY);
    panel.style.transition = "none";
    panel.style.transform = `translateY(${drag.dy}px)`;
  }

  function onPointerUp() {
    const drag = dragRef.current;
    const panel = panelRef.current;
    dragRef.current = null;
    if (!drag || !panel) return;
    panel.style.transition = "transform 180ms ease-out";
    if (drag.dy > DRAG_DISMISS_PX) {
      panel.style.transform = "translateY(100%)";
      onCloseRef.current();
      window.setTimeout(() => {
        panel.style.transform = "";
        panel.style.transition = "";
      }, CLOSE_MS + 20);
    } else {
      panel.style.transform = "";
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault();
        onCloseRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      {rendered ? (
        <div ref={panelRef} className="sheet-panel" data-size={size} tabIndex={-1} role="document">
          <div
            className="shrink-0 touch-none select-none md:touch-auto"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="flex justify-center pt-2 md:hidden" aria-hidden>
              <span className="h-1 w-9 rounded-full bg-line-strong" />
            </div>
            <div className="flex items-start gap-3 border-b border-line px-4 pb-3 pt-2 md:px-5 md:pt-4">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-base font-semibold leading-6">
                  {title}
                </h2>
                {description ? (
                  <p id={descId} className="mt-0.5 text-sm text-muted">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon -mr-2 -mt-1 text-muted md:-mt-1.5"
                onClick={() => onCloseRef.current()}
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export function SheetBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-5 ${className}`}>{children}</div>
  );
}

export function SheetFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sheet-footer flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-surface px-4 pt-3 md:flex-row md:justify-end md:px-5">
      {children}
    </div>
  );
}

/** Use as the className of a <form> that wraps SheetBody and SheetFooter. */
export const sheetFormClass = "flex min-h-0 flex-1 flex-col";
