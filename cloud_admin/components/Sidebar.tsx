"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarIcon,
  ChevronRightIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  ShieldIcon,
  SyncIcon,
  UserIcon,
  UsersIcon,
} from "./icons";
import { ResponsiveSheet } from "./ResponsiveSheet";
import { SignOutButton, SignOutSheet } from "./SignOutButton";

type NavItem = { href: string; label: string; Icon: (p: { className?: string }) => React.ReactNode };

const PRIMARY: NavItem[] = [
  { href: "/", label: "Dashboard", Icon: HomeIcon },
  { href: "/workers", label: "Workers", Icon: UsersIcon },
  { href: "/attendance", label: "Attendance", Icon: CalendarIcon },
];
const SYNC: NavItem = { href: "/sync", label: "Sync", Icon: SyncIcon };
const ADMINS: NavItem = { href: "/admins", label: "Admins", Icon: ShieldIcon };
const ACCOUNT: NavItem = { href: "/account", label: "My account", Icon: UserIcon };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function AdminChip() {
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-secondary/10 px-2 text-[11px] font-semibold text-secondary-hover ring-1 ring-inset ring-secondary/25">
      Admin
    </span>
  );
}

function Brand({ stacked = false }: { stacked?: boolean }) {
  const logo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.svg" alt="The Olivebrook Church" width={83} height={30} className="h-[30px] w-auto" />
  );
  const name = (
    <span className="flex items-center gap-1.5">
      <span className="whitespace-nowrap text-[15px] font-semibold tracking-tight">TOBC Clock-In</span>
      <AdminChip />
    </span>
  );
  return stacked ? (
    <Link href="/" className="flex flex-col items-start gap-2 rounded-2xl" aria-label="TOBC Clock-In Admin, dashboard">
      {logo}
      {name}
    </Link>
  ) : (
    <Link href="/" className="flex items-center gap-2.5 rounded-full" aria-label="TOBC Clock-In Admin, dashboard">
      {logo}
      <span className="h-5 w-px bg-line-strong" aria-hidden="true" />
      {name}
    </Link>
  );
}

export function Sidebar({ username, isSuper }: { username: string; isSuper: boolean }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const secondary = [SYNC, ...(isSuper ? [ADMINS] : []), ACCOUNT];
  const moreActive = secondary.some((i) => isActive(pathname, i.href));

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-surface lg:flex print:hidden">
        <div className="px-4 pb-3 pt-5">
          <Brand stacked />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2" aria-label="Main">
          {[...PRIMARY, ...secondary.slice(0, -1)].map((item) => (
            <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <div className="border-t border-line p-2">
          <SideLink item={ACCOUNT} active={isActive(pathname, ACCOUNT.href)} />
          <div className="mt-1 flex items-center gap-2 px-2.5 py-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold uppercase text-zinc-600">
              {username.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-medium">{username}</p>
              <p className="text-[11px] text-muted">{isSuper ? "Super admin" : "Admin"}</p>
            </div>
            <SignOutButton
              iconOnly
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-zinc-100 hover:text-foreground"
            />
          </div>
        </div>
      </aside>

      {/* Mobile and tablet top bar */}
      <header
        className="sticky top-0 z-30 bg-surface/95 backdrop-blur lg:hidden print:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)", boxShadow: "0 1px 0 var(--line)" }}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Brand />
          <Link
            href="/account"
            className="-mr-0.5 flex h-11 w-11 items-center justify-center"
            aria-label={`My account, signed in as ${username}`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-[15px] font-semibold uppercase text-white">
              {username.slice(0, 1)}
            </span>
          </Link>
        </div>
      </header>

      {/* Mobile and tablet bottom tabs */}
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 lg:hidden print:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        aria-label="Main"
      >
        <div className="pointer-events-auto mx-auto grid h-16 max-w-lg grid-cols-4 gap-1 rounded-full bg-primary p-1.5 shadow-[0_10px_30px_-8px_rgba(248,9,109,0.55),0_4px_12px_-4px_rgba(24,24,27,0.25)]">
          {PRIMARY.map((item) => (
            <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`${TAB_CLASS} ${moreActive ? TAB_ACTIVE : TAB_IDLE}`}
            aria-haspopup="dialog"
          >
            <MenuIcon className="h-[22px] w-[22px]" />
            More
          </button>
        </div>
      </nav>

      <ResponsiveSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={username}
        description={isSuper ? "Super admin" : "Admin"}
      >
        <div className="overflow-y-auto py-1">
          {secondary.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMoreOpen(false)}
              className={`flex h-12 items-center gap-3 px-4 text-[15px] active:bg-zinc-50 md:px-5 ${
                isActive(pathname, href) ? "font-medium text-primary" : ""
              }`}
            >
              <Icon className="h-5 w-5 text-muted" />
              <span className="flex-1">{label}</span>
              <ChevronRightIcon className="h-4 w-4 text-zinc-300" />
            </Link>
          ))}
        </div>
        <div className="sheet-footer border-t border-line px-4 pt-3 md:px-5">
          <button
            type="button"
            className="btn btn-default w-full"
            onClick={() => {
              setMoreOpen(false);
              setSignOutOpen(true);
            }}
            aria-haspopup="dialog"
          >
            <LogoutIcon />
            Sign out
          </button>
        </div>
      </ResponsiveSheet>
      <SignOutSheet open={signOutOpen} onClose={() => setSignOutOpen(false)} />
    </>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const { href, label, Icon } = item;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-9 items-center gap-2.5 rounded-full px-3 text-[13px] font-medium transition-colors ${
        active ? "bg-primary-soft text-primary" : "text-zinc-600 hover:bg-zinc-100 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

const TAB_CLASS =
  "flex flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors";
const TAB_ACTIVE = "bg-white/20 text-white";
const TAB_IDLE = "text-white/80 active:bg-white/10";

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const { href, label, Icon } = item;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${TAB_CLASS} ${active ? TAB_ACTIVE : TAB_IDLE}`}
    >
      <Icon className="h-[22px] w-[22px]" />
      {label}
    </Link>
  );
}
