import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isSyncAuthorized, unauthorized } from "@/lib/sync-auth";
import { toRfc3339 } from "@/lib/time";

export async function GET(request: Request) {
  if (!isSyncAuthorized(request)) return unauthorized();
  const rows = await query<{
    id: string;
    username: string;
    password_hash: string;
    is_super: boolean;
    created_at: Date;
    updated_at: Date;
  }>("SELECT id, username, password_hash, is_super, created_at, updated_at FROM admins ORDER BY created_at, id");
  return NextResponse.json({
    admins: rows.map((a) => ({
      id: a.id,
      username: a.username,
      password_hash: a.password_hash,
      is_super: a.is_super,
      created_at: toRfc3339(a.created_at),
      updated_at: toRfc3339(a.updated_at),
    })),
  });
}
