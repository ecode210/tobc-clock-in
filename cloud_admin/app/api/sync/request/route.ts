import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await query("UPDATE sync_status SET sync_requested_at = now() WHERE id = 1");
  return NextResponse.json({ ok: true });
}
