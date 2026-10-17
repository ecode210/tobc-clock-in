import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { SignOutButton } from "@/components/SignOutButton";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";
import { changePasswordAction } from "./actions";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const admin = await requireAdmin();
  return (
    <div className="max-w-xl">
      <PageHeader title="My account" />

      <section className="panel flex items-center gap-3 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold uppercase text-zinc-600">
          {admin.username.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{admin.username}</p>
          <div className="mt-0.5">
            {admin.isSuper ? <Badge tone="brand">Super admin</Badge> : <Badge>Admin</Badge>}
          </div>
        </div>
        <SignOutButton />
      </section>

      <section className="panel mt-4">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Change password</h2>
        <ActionForm action={changePasswordAction} className="space-y-4 p-4" resetOnSuccess>
          <div>
            <label htmlFor="current" className="label">
              Current password
            </label>
            <input id="current" name="current" type="password" className="input" autoComplete="current-password" required />
          </div>
          <div>
            <label htmlFor="next" className="label">
              New password
            </label>
            <input
              id="next"
              name="next"
              type="password"
              className="input"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
            <p className="hint">At least {MIN_PASSWORD_LENGTH} characters.</p>
          </div>
          <div>
            <label htmlFor="confirm" className="label">
              Confirm new password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              className="input"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>
          <SubmitButton pendingText="Saving…" className="max-md:w-full">
            Change password
          </SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
