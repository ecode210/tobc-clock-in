import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "./db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySession,
} from "./session-token";

export type CurrentAdmin = {
  id: string;
  username: string;
  isSuper: boolean;
};

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims) return null;
  const rows = await query<{ id: string; username: string; is_super: boolean }>(
    "SELECT id, username, is_super FROM admins WHERE id = $1",
    [claims.sub],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, username: row.username, isSuper: row.is_super };
}

export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}

export async function requireSuperAdmin(): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (!admin.isSuper) redirect("/");
  return admin;
}

export async function startSession(admin: { id: string; username: string }): Promise<void> {
  const token = await signSession({ sub: admin.id, username: admin.username });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
