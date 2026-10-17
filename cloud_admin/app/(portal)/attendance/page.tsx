import type { Metadata } from "next";
import Link from "next/link";
import { FilterChips, type FilterChip } from "@/components/FilterChips";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "@/components/icons";
import { PageHeader, Toolbar } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { filtersToQuery, getAttendance, parseAttendanceFilters, type AttendanceRow } from "@/lib/attendance";
import { requireAdmin } from "@/lib/auth";
import { getDefaultCutoff } from "@/lib/settings";
import { todayDate } from "@/lib/time";
import { hrefWith, type Params } from "@/lib/url";
import { listDepartments } from "@/lib/workers";
import { AttendanceFilters } from "./AttendanceFilters";

export const metadata: Metadata = { title: "Attendance" };

const DISPLAY_LIMIT = 2000;

function shift(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function dayLabel(date: string, withWeekday = true): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: withWeekday ? "short" : undefined,
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T00:00:00Z`));
}

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const defaultCutoff = await getDefaultCutoff();
  const filters = parseAttendanceFilters(await searchParams, defaultCutoff);
  const today = todayDate();
  const [rows, departments] = await Promise.all([getAttendance(filters), listDepartments()]);

  const onTime = rows.filter((r) => r.status === "ON TIME").length;
  const late = rows.filter((r) => r.status === "LATE").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const shown = rows.slice(0, DISPLAY_LIMIT);
  const singleDay = filters.from === filters.to;

  const params = {
    from: filters.from,
    to: filters.to,
    department: filters.department,
    cutoff: filters.cutoff,
    status: filters.status,
  };
  const days = Math.round((Date.parse(filters.to) - Date.parse(filters.from)) / 86_400_000) + 1;
  const prevHref = hrefWith("/attendance", params, { from: shift(filters.from, -days), to: shift(filters.to, -days) });
  const nextHref = hrefWith("/attendance", params, { from: shift(filters.from, days), to: shift(filters.to, days) });
  const rangeLabel = singleDay
    ? filters.from === today
      ? `Today, ${dayLabel(filters.from, false)}`
      : dayLabel(filters.from)
    : `${dayLabel(filters.from, false)} to ${dayLabel(filters.to, false)}`;

  const chips: FilterChip[] = [];
  if (filters.department) {
    chips.push({ label: filters.department, href: hrefWith("/attendance", params, { department: null }) });
  }
  if (filters.status !== "all") {
    chips.push({
      label: filters.status === "present" ? "Present only" : "Absent only",
      href: hrefWith("/attendance", params, { status: null }),
    });
  }
  if (filters.cutoff !== defaultCutoff) {
    chips.push({ label: `Cutoff ${filters.cutoff}`, href: hrefWith("/attendance", params, { cutoff: null }) });
  }

  const summary = [
    onTime ? `${onTime} on time` : null,
    late ? `${late} late` : null,
    absent ? `${absent} absent` : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Attendance"
        meta={rows.length}
        description={`${summary.length ? summary.join(", ") : "No records"}. Cutoff ${filters.cutoff}.`}
      />

      <Toolbar>
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-line-strong bg-surface md:h-9 md:max-w-xs md:flex-none">
          <Link
            href={prevHref}
            scroll={false}
            className="flex h-full w-11 shrink-0 items-center justify-center text-muted hover:text-foreground md:w-9"
            aria-label={singleDay ? "Previous day" : "Previous period"}
          >
            <ChevronLeftIcon />
          </Link>
          <span className="min-w-0 flex-1 truncate text-center text-sm font-medium tabular-nums md:px-2">{rangeLabel}</span>
          <Link
            href={nextHref}
            scroll={false}
            className="flex h-full w-11 shrink-0 items-center justify-center text-muted hover:text-foreground md:w-9"
            aria-label={singleDay ? "Next day" : "Next period"}
          >
            <ChevronRightIcon />
          </Link>
        </div>
        {filters.from !== today || filters.to !== today ? (
          <Link href={hrefWith("/attendance", params, { from: null, to: null })} className="btn btn-default hidden md:inline-flex">
            Today
          </Link>
        ) : null}
        <AttendanceFilters params={params} today={today} departments={departments} activeCount={chips.length} />
        <a
          href={`/api/attendance/export?${filtersToQuery(filters)}`}
          className="btn btn-default max-md:w-11 max-md:px-0 md:ml-auto"
          aria-label="Export CSV"
        >
          <DownloadIcon />
          <span className="max-md:sr-only">Export CSV</span>
        </a>
      </Toolbar>

      <FilterChips
        chips={chips}
        clearHref={hrefWith("/attendance", params, { department: null, status: null, cutoff: null })}
      />

      {shown.length === 0 ? (
        <div className="panel mt-1 px-6 py-14 text-center">
          <p className="font-medium">No records</p>
          <p className="mt-1 text-sm text-muted">Nothing matches these filters for {rangeLabel.toLowerCase()}.</p>
        </div>
      ) : (
        <>
          <MobileList rows={shown} singleDay={singleDay} />
          <div className="panel mt-1 hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th className="hidden lg:table-cell">Username</th>
                  {singleDay ? null : <th>Date</th>}
                  <th>Clock-in</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={`${r.workerId}-${r.date}`}>
                    <td className="font-medium">
                      <Link href={`/workers/${r.workerId}`} className="block max-w-[16rem] truncate hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="text-zinc-600">
                      <span className="block max-w-[12rem] truncate">
                        {r.department || <span className="text-zinc-400">None</span>}
                      </span>
                    </td>
                    <td className="hidden font-mono text-[13px] text-zinc-600 lg:table-cell">{r.username}</td>
                    {singleDay ? null : <td className="whitespace-nowrap tabular-nums text-zinc-600">{dayLabel(r.date)}</td>}
                    <td className="tabular-nums">{r.time ?? <span className="text-zinc-400">None</span>}</td>
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
      {rows.length > DISPLAY_LIMIT ? (
        <p className="mt-3 text-xs text-muted">
          Showing the first {DISPLAY_LIMIT} of {rows.length} rows. Export CSV for everything.
        </p>
      ) : null}
    </>
  );
}

function MobileList({ rows, singleDay }: { rows: AttendanceRow[]; singleDay: boolean }) {
  const groups: { date: string; rows: AttendanceRow[] }[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === r.date) last.rows.push(r);
    else groups.push({ date: r.date, rows: [r] });
  }
  return (
    <div className={`space-y-4 md:hidden ${singleDay ? "mt-1" : "mt-3"}`}>
      {groups.map((g) => (
        <section key={g.date}>
          {singleDay ? null : (
            <h2 className="mb-1.5 px-1 text-xs font-medium text-muted">
              {dayLabel(g.date)}
              <span className="ml-1.5 tabular-nums text-zinc-400">{g.rows.length}</span>
            </h2>
          )}
          <ul className="panel divide-y divide-line overflow-hidden">
            {g.rows.map((r) => (
              <li key={`${r.workerId}-${r.date}`}>
                <Link
                  href={`/workers/${r.workerId}`}
                  className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 active:bg-zinc-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium leading-5">{r.name}</p>
                    <p className="mt-0.5 truncate text-[13px] text-muted">
                      {r.department || "No department"}
                      <span className="px-1.5 text-zinc-300">·</span>
                      <span className="tabular-nums">{r.time ? r.time.slice(0, 5) : "No clock-in"}</span>
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
