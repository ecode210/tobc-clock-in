import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isSyncAuthorized, unauthorized } from "@/lib/sync-auth";
import { parseTimestamp } from "@/lib/time";

export async function POST(request: Request) {
  if (!isSyncAuthorized(request)) return unauthorized();

  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    // An empty or malformed body still counts as a heartbeat.
  }

  const pending =
    typeof body.pending_clock_ins === "number" && Number.isFinite(body.pending_clock_ins)
      ? Math.max(0, Math.trunc(body.pending_clock_ins))
      : 0;
  const version = typeof body.version === "string" ? body.version.slice(0, 32) : null;

  const rows = await query<{ sync_requested: boolean }>(
    `WITH prev AS (SELECT sync_requested_at FROM sync_status WHERE id = 1 FOR UPDATE)
     UPDATE sync_status s
     SET last_heartbeat_at = now(),
         pending_clock_ins = $1,
         last_success_at = COALESCE($2, s.last_success_at),
         client_version = $3,
         sync_requested_at = NULL
     FROM prev
     WHERE s.id = 1
     RETURNING prev.sync_requested_at IS NOT NULL AS sync_requested`,
    [pending, parseTimestamp(body.last_success_at), version],
  );

  return NextResponse.json({ sync_requested: rows[0]?.sync_requested ?? false });
}
