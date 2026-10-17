import { NextResponse, type NextRequest } from "next/server";
import { getAttendance, parseAttendanceFilters } from "@/lib/attendance";
import { getCurrentAdmin } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { getDefaultCutoff } from "@/lib/settings";

export async function GET(request: NextRequest) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const filters = parseAttendanceFilters(Object.fromEntries(request.nextUrl.searchParams), await getDefaultCutoff());
  const rows = await getAttendance(filters);
  const body = toCsv(
    ["Name", "Department", "Username", "Date", "Clock-In Time", "Status"],
    rows.map((r) => [r.name, r.department, r.username, r.date, r.time ?? "", r.status]),
  );
  const range = filters.from === filters.to ? filters.from : `${filters.from}_to_${filters.to}`;
  return csvResponse(`attendance-${range}.csv`, body);
}
