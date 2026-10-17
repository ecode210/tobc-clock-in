import "server-only";
import { query } from "./db";
import { isCutoff } from "./settings";
import { isDateString, todayDate } from "./time";

export type AttendanceStatus = "ON TIME" | "LATE" | "ABSENT";
export type StatusFilter = "all" | "present" | "absent";

export type AttendanceFilters = {
  from: string;
  to: string;
  department: string;
  cutoff: string;
  status: StatusFilter;
};

export type AttendanceRow = {
  workerId: string;
  name: string;
  department: string;
  username: string;
  date: string;
  time: string | null;
  status: AttendanceStatus;
};

const MAX_RANGE_DAYS = 366;

function pick(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseAttendanceFilters(
  params: Record<string, string | string[] | undefined>,
  defaultCutoff: string,
): AttendanceFilters {
  const today = todayDate();
  let from = pick(params.from);
  let to = pick(params.to);
  if (!isDateString(from)) from = today;
  if (!isDateString(to)) to = from;
  if (to < from) [from, to] = [to, from];

  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const maxTo = new Date(fromMs + (MAX_RANGE_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  if (to > maxTo) to = maxTo;

  let cutoff = pick(params.cutoff);
  if (!isCutoff(cutoff)) cutoff = defaultCutoff;

  const rawStatus = pick(params.status);
  const status: StatusFilter =
    rawStatus === "present" || rawStatus === "absent" ? rawStatus : "all";

  return { from, to, department: pick(params.department), cutoff, status };
}

export function statusFor(clockedInAt: string, cutoff: string): AttendanceStatus {
  const time = clockedInAt.slice(11, 19);
  return time <= `${cutoff}:00` ? "ON TIME" : "LATE";
}

export async function getAttendance(f: AttendanceFilters): Promise<AttendanceRow[]> {
  const results: AttendanceRow[] = [];
  const deptClause = f.department ? "AND w.department = $3" : "";
  const params: unknown[] = [f.from, f.to];
  if (f.department) params.push(f.department);

  if (f.status !== "absent") {
    const rows = await query<{
      worker_id: string;
      name: string;
      department: string;
      username: string;
      clock_in_date: string;
      clocked_in_at: string;
    }>(
      `SELECT c.worker_id, w.name, w.department, w.username, c.clock_in_date, c.clocked_in_at
       FROM clock_ins c JOIN workers w ON w.id = c.worker_id
       WHERE c.clock_in_date BETWEEN $1 AND $2 ${deptClause}`,
      params,
    );
    for (const r of rows) {
      results.push({
        workerId: r.worker_id,
        name: r.name,
        department: r.department,
        username: r.username,
        date: r.clock_in_date,
        time: r.clocked_in_at.slice(11, 19),
        status: statusFor(r.clocked_in_at, f.cutoff),
      });
    }
  }

  if (f.status !== "present") {
    const rows = await query<{
      worker_id: string;
      name: string;
      department: string;
      username: string;
      d: string;
    }>(
      `SELECT w.id AS worker_id, w.name, w.department, w.username, d.d
       FROM generate_series($1::date, $2::date, interval '1 day') AS gs(day)
       CROSS JOIN LATERAL (SELECT to_char(gs.day, 'YYYY-MM-DD') AS d) d
       CROSS JOIN workers w
       WHERE NOT EXISTS (
         SELECT 1 FROM clock_ins c WHERE c.worker_id = w.id AND c.clock_in_date = d.d
       ) ${deptClause}`,
      params,
    );
    for (const r of rows) {
      results.push({
        workerId: r.worker_id,
        name: r.name,
        department: r.department,
        username: r.username,
        date: r.d,
        time: null,
        status: "ABSENT",
      });
    }
  }

  return results.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
      a.username.localeCompare(b.username),
  );
}

export function filtersToQuery(f: AttendanceFilters): string {
  const sp = new URLSearchParams({ from: f.from, to: f.to, cutoff: f.cutoff, status: f.status });
  if (f.department) sp.set("department", f.department);
  return sp.toString();
}
