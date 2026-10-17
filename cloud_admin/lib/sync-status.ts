import "server-only";
import { query } from "./db";

export type SyncStatus = {
  last_heartbeat_at: Date | null;
  pending_clock_ins: number;
  last_success_at: Date | null;
  sync_requested_at: Date | null;
  client_version: string | null;
};

export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export async function getSyncStatus(): Promise<SyncStatus> {
  const rows = await query<SyncStatus>(
    `SELECT last_heartbeat_at, pending_clock_ins, last_success_at, sync_requested_at, client_version
     FROM sync_status WHERE id = 1`,
  );
  return (
    rows[0] ?? {
      last_heartbeat_at: null,
      pending_clock_ins: 0,
      last_success_at: null,
      sync_requested_at: null,
      client_version: null,
    }
  );
}

export function isLaptopOnline(status: SyncStatus): boolean {
  return (
    status.last_heartbeat_at !== null &&
    Date.now() - status.last_heartbeat_at.getTime() < ONLINE_WINDOW_MS
  );
}
