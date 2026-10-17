"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { DotsIcon } from "./icons";

export type RowMenuItem =
  | { label: string; icon?: React.ReactNode; onSelect: () => void; danger?: boolean; href?: never }
  | { label: string; icon?: React.ReactNode; href: string; danger?: boolean; onSelect?: never };

const MENU_WIDTH = 192;

export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const open = pos !== null;

  function toggle() {
    if (open) return setPos(null);
    const r = buttonRef.current!.getBoundingClientRect();
    const estimated = items.length * 36 + 8;
    const below = r.bottom + 4 + estimated < window.innerHeight;
    setPos({
      top: below ? r.bottom + 4 : r.top - 4 - estimated,
      left: Math.max(8, r.right - MENU_WIDTH),
    });
  }

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const close = () => setPos(null);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % nodes.length : (i - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  }

  const itemClass = (danger?: boolean) =>
    `flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm outline-none focus:bg-zinc-100 hover:bg-zinc-100 ${
      danger ? "text-red-600" : "text-foreground"
    }`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-ghost btn-icon btn-sm w-8 text-muted hover:text-foreground"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
      >
        <DotsIcon />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="fixed z-50 rounded-2xl border border-line bg-surface p-1.5 shadow-lg shadow-black/5"
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
        >
          {items.map((item, i) => {
            const content = (
              <>
                <span className={item.danger ? "text-red-500" : "text-muted"}>{item.icon}</span>
                {item.label}
              </>
            );
            const divider = item.danger && i > 0 ? <div className="my-1 h-px bg-line" role="separator" /> : null;
            return item.href ? (
              <div key={item.label}>
                {divider}
                <Link href={item.href} role="menuitem" className={itemClass(item.danger)} onClick={() => setPos(null)}>
                  {content}
                </Link>
              </div>
            ) : (
              <div key={item.label}>
                {divider}
                <button
                  type="button"
                  role="menuitem"
                  className={itemClass(item.danger)}
                  onClick={() => {
                    setPos(null);
                    item.onSelect?.();
                  }}
                >
                  {content}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
