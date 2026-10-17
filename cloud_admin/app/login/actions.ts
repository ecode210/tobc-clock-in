"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth";
import { query } from "@/lib/db";
import type { ActionState } from "@/lib/action-state";

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const rows = await query<{ id: string; username: string; password_hash: string }>(
    "SELECT id, username, password_hash FROM admins WHERE lower(username) = lower($1)",
    [username],
  );
  const admin = rows[0];
  const valid = admin ? await bcrypt.compare(password, admin.password_hash) : false;
  if (!admin || !valid) return { error: "Incorrect username or password." };

  await startSession(admin);
  redirect(safeNext(formData.get("next")));
}
