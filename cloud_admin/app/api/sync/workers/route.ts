import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isSyncAuthorized, unauthorized } from "@/lib/sync-auth";
import { toRfc3339 } from "@/lib/time";
import type { WorkerRow } from "@/lib/workers";

export async function GET(request: Request) {
  if (!isSyncAuthorized(request)) return unauthorized();
  const rows = await query<WorkerRow>("SELECT * FROM workers ORDER BY created_at, id");
  return NextResponse.json({
    workers: rows.map((w) => ({
      id: w.id,
      name: w.name,
      department: w.department,
      username: w.username,
      setup_code: w.setup_code,
      device_token: w.device_token,
      mac_address: w.mac_address,
      registered_at: toRfc3339(w.registered_at),
      created_at: toRfc3339(w.created_at),
      updated_at: toRfc3339(w.updated_at),
      device_updated_at: toRfc3339(w.device_updated_at),
    })),
  });
}
