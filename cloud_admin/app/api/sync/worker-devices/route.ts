import { NextResponse } from "next/server";
import { ensureDb, isUniqueViolation } from "@/lib/db";
import { badRequest, isSyncAuthorized, unauthorized } from "@/lib/sync-auth";
import { parseTimestamp } from "@/lib/time";
import { isUuid } from "@/lib/workers";

type DeviceResult = { worker_id: string; status: "applied" | "rejected" | "not_found" };

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export async function POST(request: Request) {
  if (!isSyncAuthorized(request)) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("invalid JSON");
  }
  const devices = (body as { devices?: unknown })?.devices;
  if (!Array.isArray(devices)) return badRequest("devices must be an array");

  const pool = await ensureDb();
  const results: DeviceResult[] = [];

  for (const raw of devices) {
    const d = (raw ?? {}) as Record<string, unknown>;
    const workerId = typeof d.worker_id === "string" ? d.worker_id : "";
    const incomingUpdated = parseTimestamp(d.device_updated_at);
    if (!isUuid(workerId)) {
      results.push({ worker_id: workerId, status: "not_found" });
      continue;
    }
    if (!incomingUpdated) {
      results.push({ worker_id: workerId, status: "rejected" });
      continue;
    }

    try {
      const { rows } = await pool.query<{ applied: boolean | null }>(
        `WITH target AS (SELECT id, device_updated_at FROM workers WHERE id = $1),
         upd AS (
           UPDATE workers w
           SET device_token = $2,
               mac_address = $3,
               registered_at = $4,
               device_updated_at = $5,
               updated_at = date_trunc('second', now())
           FROM target t
           WHERE w.id = t.id
             AND (w.device_updated_at IS NULL OR $5::timestamptz > w.device_updated_at)
           RETURNING w.id
         )
         SELECT (SELECT count(*) FROM upd) > 0 AS applied
         FROM target`,
        [
          workerId,
          optionalString(d.device_token),
          optionalString(d.mac_address),
          parseTimestamp(d.registered_at),
          incomingUpdated,
        ],
      );
      if (rows.length === 0) {
        results.push({ worker_id: workerId, status: "not_found" });
      } else {
        results.push({ worker_id: workerId, status: rows[0].applied ? "applied" : "rejected" });
      }
    } catch (err) {
      if (isUniqueViolation(err)) {
        results.push({ worker_id: workerId, status: "rejected" });
      } else {
        throw err;
      }
    }
  }

  return NextResponse.json({ results });
}
