import "server-only";
import { query } from "./db";

export const FALLBACK_CUTOFF = "07:30";

export function isCutoff(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function getDefaultCutoff(): Promise<string> {
  const rows = await query<{ on_time_cutoff: string }>("SELECT on_time_cutoff FROM app_settings WHERE id = 1");
  const value = rows[0]?.on_time_cutoff ?? "";
  return isCutoff(value) ? value : FALLBACK_CUTOFF;
}

export async function setDefaultCutoff(cutoff: string): Promise<void> {
  await query(
    `INSERT INTO app_settings (id, on_time_cutoff) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET on_time_cutoff = $1, updated_at = date_trunc('second', now())`,
    [cutoff],
  );
}
