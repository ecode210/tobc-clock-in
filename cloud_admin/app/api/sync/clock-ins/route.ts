import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { badRequest, isSyncAuthorized, unauthorized } from "@/lib/sync-auth";
import { isUuid } from "@/lib/workers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export async function POST(request: Request) {
  if (!isSyncAuthorized(request)) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("invalid JSON");
  }
  const clockIns = (body as { clock_ins?: unknown })?.clock_ins;
  if (!Array.isArray(clockIns)) return badRequest("clock_ins must be an array");

  const pool = await ensureDb();
  const accepted: string[] = [];
  const rejected: { id: string; reason: string }[] = [];

  for (const raw of clockIns) {
    const c = (raw ?? {}) as Record<string, unknown>;
    const id = typeof c.id === "string" ? c.id : "";
    const workerId = c.worker_id;
    const date = c.clock_in_date;
    const at = c.clocked_in_at;

    if (!isUuid(id)) {
      rejected.push({ id, reason: "invalid_id" });
      continue;
    }
    if (typeof date !== "string" || !DATE_RE.test(date) || typeof at !== "string" || !DATETIME_RE.test(at)) {
      rejected.push({ id, reason: "invalid_timestamp" });
      continue;
    }
    if (!isUuid(workerId)) {
      rejected.push({ id, reason: "worker_not_found" });
      continue;
    }

    const { rows: worker } = await pool.query("SELECT 1 FROM workers WHERE id = $1", [workerId]);
    if (worker.length === 0) {
      rejected.push({ id, reason: "worker_not_found" });
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO clock_ins (id, worker_id, clock_in_date, clocked_in_at, ip_address, mac_address, synced_to_cloud)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         ON CONFLICT DO NOTHING`,
        [
          id,
          workerId,
          date,
          at,
          typeof c.ip_address === "string" ? c.ip_address : "",
          typeof c.mac_address === "string" ? c.mac_address : "",
        ],
      );
      accepted.push(id);
    } catch (err) {
      if ((err as { code?: string }).code === "23503") {
        rejected.push({ id, reason: "worker_not_found" });
      } else {
        throw err;
      }
    }
  }

  return NextResponse.json({ accepted, rejected });
}
