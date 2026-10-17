import "server-only";
import { formatDateTime } from "@/lib/time";
import type { WorkerRow } from "@/lib/workers";
import type { WorkerItem } from "./types";

export function toWorkerItem(w: WorkerRow): WorkerItem {
  return {
    id: w.id,
    name: w.name,
    department: w.department,
    username: w.username,
    setupCode: w.setup_code,
    locked: w.device_token !== null,
    macAddress: w.mac_address,
    registeredAt: w.registered_at ? formatDateTime(w.registered_at) : null,
    createdAt: formatDateTime(w.created_at),
    updatedAt: formatDateTime(w.updated_at),
  };
}
