"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import type { ActionState } from "@/lib/action-state";
import { hashPassword, passwordProblem } from "@/lib/passwords";

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const rows = await query<{ password_hash: string }>("SELECT password_hash FROM admins WHERE id = $1", [admin.id]);
  if (!rows[0] || !(await bcrypt.compare(current, rows[0].password_hash))) {
    return { error: "Your current password is incorrect." };
  }
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== confirm) return { error: "The new passwords do not match." };
  if (next === current) return { error: "Choose a password different from the current one." };

  await query(
    "UPDATE admins SET password_hash = $2, updated_at = date_trunc('second', now()) WHERE id = $1",
    [admin.id, await hashPassword(next)],
  );
  revalidatePath("/", "layout");
  return { ok: true, message: "Password changed." };
}
