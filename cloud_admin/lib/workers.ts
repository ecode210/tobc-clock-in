import "server-only";
import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { query, withTransaction } from "./db";

const SETUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateSetupCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += SETUP_CODE_ALPHABET[randomInt(SETUP_CODE_ALPHABET.length)];
  }
  return code;
}

export function baseUsername(name: string): string {
  const parts = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  if (parts.length === 0) return "worker";
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${parts[parts.length - 1]}`;
}

async function nextUsername(client: PoolClient, name: string): Promise<string> {
  const base = baseUsername(name);
  const { rows } = await client.query<{ username: string }>(
    "SELECT username FROM workers WHERE username = $1 OR username ~ ('^' || $2 || '[0-9]+$')",
    [base, base.replace(/\./g, "\\.")],
  );
  const taken = new Set(rows.map((r) => r.username));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export type NewWorker = { name: string; department: string };

export type WorkerRow = {
  id: string;
  name: string;
  department: string;
  username: string;
  setup_code: string;
  device_token: string | null;
  mac_address: string | null;
  registered_at: Date | null;
  created_at: Date;
  updated_at: Date;
  device_updated_at: Date | null;
};

export function cleanText(value: unknown, max = 120): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function createWorkers(items: NewWorker[]): Promise<WorkerRow[]> {
  return withTransaction(async (client) => {
    await client.query("LOCK TABLE workers IN SHARE ROW EXCLUSIVE MODE");
    const created: WorkerRow[] = [];
    for (const item of items) {
      const username = await nextUsername(client, item.name);
      const { rows } = await client.query<WorkerRow>(
        `INSERT INTO workers (name, department, username, setup_code)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [item.name, item.department, username, generateSetupCode()],
      );
      created.push(rows[0]);
    }
    return created;
  });
}

export type DeviceFilter = "locked" | "pending";

export function parseDeviceFilter(value: string | null | undefined): DeviceFilter | undefined {
  return value === "locked" || value === "pending" ? value : undefined;
}

export async function listWorkers(filters: { q?: string; department?: string; device?: DeviceFilter } = {}) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.q) {
    params.push(`%${filters.q}%`);
    where.push(`(name ILIKE $${params.length} OR username ILIKE $${params.length})`);
  }
  if (filters.department) {
    params.push(filters.department);
    where.push(`department = $${params.length}`);
  }
  if (filters.device === "locked") where.push("device_token IS NOT NULL");
  if (filters.device === "pending") where.push("device_token IS NULL");
  return query<WorkerRow>(
    `SELECT * FROM workers ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY lower(name), username`,
    params,
  );
}

export async function listDepartments(): Promise<string[]> {
  const rows = await query<{ department: string }>(
    "SELECT DISTINCT department FROM workers WHERE department <> '' ORDER BY department",
  );
  return rows.map((r) => r.department);
}

export async function getWorker(id: string): Promise<WorkerRow | null> {
  if (!isUuid(id)) return null;
  const rows = await query<WorkerRow>("SELECT * FROM workers WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function resetWorkerDevice(id: string): Promise<void> {
  await query(
    `UPDATE workers
     SET device_token = NULL,
         mac_address = NULL,
         registered_at = NULL,
         setup_code = $2,
         device_updated_at = date_trunc('second', now()),
         updated_at = date_trunc('second', now())
     WHERE id = $1`,
    [id, generateSetupCode()],
  );
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
