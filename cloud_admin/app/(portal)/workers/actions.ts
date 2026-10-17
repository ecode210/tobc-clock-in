"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { query } from "@/lib/db";
import type { ActionState } from "@/lib/action-state";
import { cleanText, createWorkers, isUuid, resetWorkerDevice, type NewWorker } from "@/lib/workers";

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;

export async function createWorkerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = cleanText(formData.get("name"));
  const department = cleanText(formData.get("department"));
  if (!name) return { error: "Name is required." };
  const [worker] = await createWorkers([{ name, department }]);
  revalidatePath("/workers");
  return {
    ok: true,
    message: `Created ${worker.name}: username ${worker.username}, setup code ${worker.setup_code}.`,
    worker: { name: worker.name, username: worker.username, setupCode: worker.setup_code },
  };
}

function looksLikeHeader(row: string[]): boolean {
  const first = row[0]?.trim().toLowerCase() ?? "";
  const second = row[1]?.trim().toLowerCase() ?? "";
  return (
    ["name", "full name", "fullname", "worker", "worker name"].includes(first) ||
    ["department", "dept"].includes(second)
  );
}

export async function importWorkersAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import." };
  if (file.size > MAX_IMPORT_BYTES) return { error: "The file is too large (2 MB max)." };

  const rows = parseCsv(await file.text());
  if (rows.length > 0 && looksLikeHeader(rows[0])) rows.shift();

  const items: NewWorker[] = [];
  let skipped = 0;
  for (const row of rows) {
    const name = cleanText(row[0]);
    if (!name) {
      skipped++;
      continue;
    }
    items.push({ name, department: cleanText(row[1]) });
  }
  if (items.length === 0) return { error: "No workers found. Expected columns: Name,Department." };
  if (items.length > MAX_IMPORT_ROWS) return { error: `Too many rows (max ${MAX_IMPORT_ROWS}).` };

  const created = await createWorkers(items);
  revalidatePath("/workers");
  return {
    ok: true,
    message: `Imported ${created.length} worker${created.length === 1 ? "" : "s"}${
      skipped ? `, skipped ${skipped} row${skipped === 1 ? "" : "s"} without a name` : ""
    }.`,
  };
}

export async function updateWorkerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = formData.get("id");
  const name = cleanText(formData.get("name"));
  const department = cleanText(formData.get("department"));
  if (!isUuid(id)) return { error: "Unknown worker." };
  if (!name) return { error: "Name is required." };
  const rows = await query(
    `UPDATE workers SET name = $2, department = $3, updated_at = date_trunc('second', now())
     WHERE id = $1 RETURNING id`,
    [id, name, department],
  );
  if (rows.length === 0) return { error: "Worker not found." };
  revalidatePath("/workers");
  revalidatePath(`/workers/${id}`);
  return { ok: true, message: "Saved." };
}

export async function resetDeviceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = formData.get("id");
  if (!isUuid(id)) return { error: "Unknown worker." };
  await resetWorkerDevice(id);
  revalidatePath("/workers");
  revalidatePath(`/workers/${id}`);
  return { ok: true, message: "Device reset. Share the new setup code with the worker." };
}

export async function deleteWorkerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = formData.get("id");
  if (!isUuid(id)) return { error: "Unknown worker." };
  await query("DELETE FROM workers WHERE id = $1", [id]);
  revalidatePath("/workers");
  redirect("/workers");
}
