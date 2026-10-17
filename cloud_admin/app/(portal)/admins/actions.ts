"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { isUniqueViolation, withTransaction, query } from "@/lib/db";
import type { ActionState } from "@/lib/action-state";
import { hashPassword, passwordProblem } from "@/lib/passwords";
import { isUuid } from "@/lib/workers";

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,40}$/;

export async function createAdminAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSuperAdmin();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const isSuper = formData.get("is_super") === "on";

  if (!USERNAME_RE.test(username)) {
    return { error: "Username must be 3 to 40 characters: letters, numbers, dot, dash, or underscore." };
  }
  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  try {
    await query("INSERT INTO admins (username, password_hash, is_super) VALUES ($1, $2, $3)", [
      username,
      await hashPassword(password),
      isSuper,
    ]);
  } catch (err) {
    if (isUniqueViolation(err)) return { error: `An admin named ${username} already exists.` };
    throw err;
  }
  revalidatePath("/admins");
  return { ok: true, message: `Created ${isSuper ? "super admin" : "admin"} ${username}.` };
}

export async function resetAdminPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSuperAdmin();
  const id = formData.get("id");
  const password = String(formData.get("password") ?? "");
  if (!isUuid(id)) return { error: "Unknown admin." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const rows = await query<{ username: string }>(
    "UPDATE admins SET password_hash = $2, updated_at = date_trunc('second', now()) WHERE id = $1 RETURNING username",
    [id, await hashPassword(password)],
  );
  if (rows.length === 0) return { error: "Admin not found." };
  revalidatePath("/", "layout");
  return { ok: true, message: `Password reset for ${rows[0].username}.` };
}

export async function deleteAdminAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireSuperAdmin();
  const id = formData.get("id");
  if (!isUuid(id)) return { error: "Unknown admin." };
  if (id === me.id) return { error: "You cannot delete your own account." };

  const result = await withTransaction(async (client) => {
    await client.query("LOCK TABLE admins IN SHARE ROW EXCLUSIVE MODE");
    const { rows } = await client.query<{ is_super: boolean }>("SELECT is_super FROM admins WHERE id = $1", [id]);
    if (rows.length === 0) return { error: "Admin not found." };
    if (rows[0].is_super) {
      const { rows: count } = await client.query<{ n: string }>(
        "SELECT count(*) AS n FROM admins WHERE is_super",
      );
      if (Number(count[0].n) <= 1) return { error: "You cannot delete the last super admin." };
    }
    await client.query("DELETE FROM admins WHERE id = $1", [id]);
    return { ok: true, message: "Admin deleted." };
  });
  revalidatePath("/admins");
  return result;
}
