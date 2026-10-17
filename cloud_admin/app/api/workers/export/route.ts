import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { todayDate } from "@/lib/time";
import { listWorkers, parseDeviceFilter } from "@/lib/workers";

export async function GET(request: NextRequest) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const workers = await listWorkers({
    q: sp.get("q")?.trim() || undefined,
    department: sp.get("department")?.trim() || undefined,
    device: parseDeviceFilter(sp.get("device")),
  });
  const body = toCsv(
    ["Name", "Department", "Username", "Setup Code"],
    workers.map((w) => [w.name, w.department, w.username, w.setup_code]),
  );
  return csvResponse(`workers-setup-codes-${todayDate()}.csv`, body);
}
