import bcrypt from "bcryptjs";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertIcon, ChevronRightIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { CutoffCard } from "./CutoffCard";
import { getAttendance, parseAttendanceFilters } from "@/lib/attendance";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDefaultCutoff } from "@/lib/settings";
import { getSyncStatus, isLaptopOnline } from "@/lib/sync-status";
import { formatDateTime, formatRelative, todayDate } from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };

const RECENT_LIMIT = 10;

async function seededAdminHasDefaultPassword(): Promise<boolean> {
  const rows = await query<{ password_hash: string }>(
    "SELECT password_hash FROM admins WHERE username = 'admin'",
  );
  return rows[0] ? bcrypt.compare("admin", rows[0].password_hash) : false;
}

export default async function DashboardPage() {
  const admin = await requireAdmin();
  const today = todayDate();
  const cutoff = await getDefaultCutoff();
  const [counts, status, defaultPassword, present] = await Promise.all([
    query<{ total: string; registered: string; today: string }>(
      `SELECT
         (SELECT count(*) FROM workers) AS total,
         (SELECT count(*) FROM workers WHERE device_token IS NOT NULL) AS registered,
         (SELECT count(*) FROM clock_ins WHERE clock_in_date = $1) AS today`,
      [today],
    ),
    getSyncStatus(),
    seededAdminHasDefaultPassword(),
    getAttendance({ ...parseAttendanceFilters({}, cutoff), status: "present" }),
  ]);
  const c = counts[0];
  const online = isLaptopOnline(status);
  const total = Number(c.total);
  const registered = Number(c.registered);
  const clockedIn = Number(c.today);
  const recent = [...present].sort((a, b) => (b.time ?? "").localeCompare(a.time ?? "")).slice(0, RECENT_LIMIT);
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${today}T00:00:00Z`));

  return (
    <>
      <PageHeader title="Dashboard" description={dateLabel} />

      {defaultPassword ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm md:items-center">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 md:mt-0" />
          <p className="flex-1 text-amber-900">
            The <span className="font-mono">admin</span> account still uses the default password. Change it before going
            live.
          </p>
          {admin.username === "admin" ? (
            <Link href="/account" className="shrink-0 font-medium text-amber-900 underline underline-offset-2">
              Change
            </Link>
          ) : admin.isSuper ? (
            <Link href="/admins" className="shrink-0 font-medium text-amber-900 underline underline-offset-2">
              Manage
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="panel grid grid-cols-2 overflow-hidden md:grid-cols-4">
        <Stat label="Workers" value={total} href="/workers" className="border-b border-r md:border-b-0" />
        <Stat
          label="Devices locked"
          value={registered}
          hint={total ? `of ${total}` : undefined}
          href="/workers?device=locked"
          className="border-b md:border-b-0 md:border-r"
        />
        <Stat
          label="Clocked in today"
          value={clockedIn}
          hint={total ? `of ${total}` : undefined}
          href="/attendance"
          className="border-r"
        />
        <Stat
          label="Laptop"
          value={
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-zinc-300"}`} aria-hidden />
              {online ? "Online" : status.last_heartbeat_at ? "Offline" : "Not connected"}
            </span>
          }
          hint={status.last_heartbeat_at ? `Seen ${formatRelative(status.last_heartbeat_at)}` : undefined}
          title={status.last_heartbeat_at ? formatDateTime(status.last_heartbeat_at) : undefined}
          href="/sync"
        />
      </div>

      <CutoffCard cutoff={cutoff} />

      <div className="mb-2 mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Latest clock-ins today</h2>
        <Link href="/attendance" className="-mr-1 inline-flex h-8 items-center gap-0.5 px-1 text-[13px] font-medium text-muted hover:text-foreground">
          All attendance
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="panel px-6 py-10 text-center text-sm text-muted">No one has clocked in yet today.</div>
      ) : (
        <>
          <ul className="panel divide-y divide-line overflow-hidden md:hidden">
            {recent.map((r) => (
              <li key={r.workerId} className="flex min-h-[56px] items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium leading-5">{r.name}</p>
                  <p className="mt-0.5 truncate text-[13px] text-muted">{r.department || "No department"}</p>
                </div>
                <span className="text-[13px] tabular-nums text-zinc-600">{r.time?.slice(0, 5)}</span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
          <div className="panel hidden md:block">
            <table className="data-table no-sticky">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Clock-in</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.workerId}>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-zinc-600">{r.department || <span className="text-zinc-400">None</span>}</td>
                    <td className="tabular-nums">{r.time}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  href,
  title,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href: string;
  title?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`block border-line px-4 py-3 hover:bg-subtle md:py-3.5 ${className}`} title={title}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-lg font-semibold tabular-nums leading-6">{value}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </p>
    </Link>
  );
}
