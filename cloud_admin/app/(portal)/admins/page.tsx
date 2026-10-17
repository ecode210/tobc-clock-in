import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";
import { formatDateTime } from "@/lib/time";
import { AdminsView } from "./AdminsView";

export const metadata: Metadata = { title: "Admins" };

export default async function AdminsPage() {
  const me = await requireSuperAdmin();
  const admins = await query<{ id: string; username: string; is_super: boolean; created_at: Date }>(
    "SELECT id, username, is_super, created_at FROM admins ORDER BY is_super DESC, lower(username)",
  );

  return (
    <AdminsView
      minPassword={MIN_PASSWORD_LENGTH}
      admins={admins.map((a) => ({
        id: a.id,
        username: a.username,
        isSuper: a.is_super,
        createdAt: formatDateTime(a.created_at),
        isMe: a.id === me.id,
      }))}
    />
  );
}
