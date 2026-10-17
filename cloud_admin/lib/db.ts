import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

type DbGlobal = {
  pool?: Pool;
  ready?: Promise<void>;
};

const g = globalThis as typeof globalThis & { __clockinDb?: DbGlobal };
const state: DbGlobal = (g.__clockinDb ??= {});

function getPool(): Pool {
  if (!state.pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    state.pool = new Pool({ connectionString, max: 10 });
    // Idle clients emit "error" when Postgres restarts; unhandled, that
    // crashes the Node process. The pool drops the client and reconnects.
    state.pool.on("error", (err) => {
      console.error("postgres idle client error:", err.message);
    });
  }
  return state.pool;
}

const SCHEMA_LOCK_KEY = 72_514_001;

async function initialize(): Promise<void> {
  const sql = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  const client = await getPool().connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [SCHEMA_LOCK_KEY]);
    await client.query(sql);
    const { rows } = await client.query<{ n: string }>("SELECT count(*) AS n FROM admins");
    if (Number(rows[0].n) === 0) {
      const hash = await bcrypt.hash("admin", 10);
      await client.query(
        `INSERT INTO admins (username, password_hash, is_super)
         SELECT 'admin', $1, TRUE
         WHERE NOT EXISTS (SELECT 1 FROM admins)`,
        [hash],
      );
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [SCHEMA_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

export async function ensureDb(): Promise<Pool> {
  const pool = getPool();
  if (!state.ready) {
    state.ready = initialize().catch((err) => {
      state.ready = undefined;
      throw err;
    });
  }
  await state.ready;
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = await ensureDb();
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = await ensureDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}
