"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { endSession, requireAdmin } from "@/lib/auth";
import { isCutoff, setDefaultCutoff } from "@/lib/settings";

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}

export async function setDefaultCutoffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const cutoff = String(formData.get("cutoff") ?? "").trim().slice(0, 5);
  if (!isCutoff(cutoff)) return { error: "Enter a time such as 07:30." };
  await setDefaultCutoff(cutoff);
  revalidatePath("/");
  revalidatePath("/attendance");
  return { ok: true, message: `Default cutoff set to ${cutoff}.` };
}
