"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/Badge";
import { FormError } from "@/components/FormError";
import { ChevronRightIcon, KeyIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveSheet, SheetBody, SheetFooter, sheetFormClass } from "@/components/ResponsiveSheet";
import { RowMenu } from "@/components/RowMenu";
import { SubmitButton } from "@/components/SubmitButton";
import { useToast } from "@/components/Toaster";
import { useSheetAction } from "@/components/useSheetAction";
import { createAdminAction, deleteAdminAction, resetAdminPasswordAction } from "./actions";

export type AdminItem = { id: string; username: string; isSuper: boolean; createdAt: string; isMe: boolean };

type Kind = "create" | "detail" | "password" | "delete";

export function AdminsView({ admins, minPassword }: { admins: AdminItem[]; minPassword: number }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [target, setTarget] = useState<AdminItem | null>(null);
  const live = target ? admins.some((a) => a.id === target.id) : false;
  const close = () => setKind(null);

  function openFor(next: Kind, a: AdminItem) {
    setTarget(a);
    setKind(next);
  }

  return (
    <>
      <PageHeader
        title="Admins"
        meta={admins.length}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setKind("create")}>
            <PlusIcon />
            <span className="max-md:hidden">Create admin</span>
            <span className="md:hidden">New</span>
          </button>
        }
      />

      <ul className="panel divide-y divide-line overflow-hidden md:hidden">
        {admins.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => openFor("detail", a)}
              className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-zinc-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium leading-5">
                  {a.username}
                  {a.isMe ? <span className="ml-1.5 text-[13px] font-normal text-muted">(you)</span> : null}
                </p>
                <p className="mt-0.5 truncate text-[13px] text-muted">Added {a.createdAt}</p>
              </div>
              <RoleBadge isSuper={a.isSuper} />
              <ChevronRightIcon className="-mr-1 h-4 w-4 shrink-0 text-zinc-300" />
            </button>
          </li>
        ))}
      </ul>

      <div className="panel hidden md:block">
        <table className="data-table no-sticky">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Added</th>
              <th className="w-10">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">
                  {a.username}
                  {a.isMe ? <span className="ml-1.5 font-normal text-muted">(you)</span> : null}
                </td>
                <td>
                  <RoleBadge isSuper={a.isSuper} />
                </td>
                <td className="text-zinc-600">{a.createdAt}</td>
                <td className="text-right">
                  <RowMenu
                    label={`Actions for ${a.username}`}
                    items={[
                      { label: "Reset password", icon: <KeyIcon />, onSelect: () => openFor("password", a) },
                      ...(a.isMe
                        ? []
                        : [{ label: "Delete", icon: <TrashIcon />, onSelect: () => openFor("delete", a), danger: true }]),
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Super admins manage admin accounts. Other admins manage workers and attendance only.
      </p>

      <ResponsiveSheet open={kind === "create"} onClose={close} title="Create admin"
        description="Give someone access to this portal."
      >
        <CreateAdminContent onClose={close} minPassword={minPassword} />
      </ResponsiveSheet>

      <ResponsiveSheet
        open={kind === "detail" && live}
        onClose={close}
        title={target?.username ?? ""}
        description={target ? `${target.isSuper ? "Super admin" : "Admin"}, added ${target.createdAt}` : undefined}
      >
        <div className="py-1">
          <button
            type="button"
            className="flex h-12 w-full items-center gap-3 px-4 text-left text-[15px] active:bg-zinc-50"
            onClick={() => setKind("password")}
          >
            <KeyIcon className="h-5 w-5 text-muted" />
            Reset password
          </button>
          {target && !target.isMe ? (
            <button
              type="button"
              className="flex h-12 w-full items-center gap-3 px-4 text-left text-[15px] text-red-600 active:bg-zinc-50"
              onClick={() => setKind("delete")}
            >
              <TrashIcon className="h-5 w-5" />
              Delete admin
            </button>
          ) : null}
        </div>
        <div className="sheet-footer" />
      </ResponsiveSheet>

      <ResponsiveSheet
        open={kind === "password" && live}
        onClose={close}
        title="Reset password"
        description={target ? `Set a new password for ${target.username}.` : undefined}
      >
        {target ? <ResetPasswordContent admin={target} onClose={close} minPassword={minPassword} /> : null}
      </ResponsiveSheet>

      <ResponsiveSheet open={kind === "delete" && live} onClose={close} title="Delete admin?"
        description="This cannot be undone."
      >
        {target ? <DeleteAdminContent admin={target} onClose={close} /> : null}
      </ResponsiveSheet>
    </>
  );
}

function RoleBadge({ isSuper }: { isSuper: boolean }) {
  return isSuper ? <Badge tone="brand">Super admin</Badge> : <Badge>Admin</Badge>;
}

function CreateAdminContent({ onClose, minPassword }: { onClose: () => void; minPassword: number }) {
  const toast = useToast();
  const [state, action] = useSheetAction(createAdminAction, (s) => {
    onClose();
    toast(s.message ?? "Admin created.");
  });
  const id = useId();
  return (
    <form action={action} className={sheetFormClass}>
      <SheetBody className="space-y-4">
        <div>
          <label htmlFor={`${id}-u`} className="label">
            Username
          </label>
          <input
            id={`${id}-u`}
            name="username"
            className="input"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            data-autofocus
          />
          <p className="hint">3 to 40 characters: letters, numbers, dot, dash, or underscore.</p>
        </div>
        <div>
          <label htmlFor={`${id}-p`} className="label">
            Temporary password
          </label>
          <input
            id={`${id}-p`}
            name="password"
            type="password"
            className="input"
            minLength={minPassword}
            required
            autoComplete="new-password"
          />
          <p className="hint">At least {minPassword} characters. Ask them to change it after signing in.</p>
        </div>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-line px-3.5 py-2.5">
          <input type="checkbox" name="is_super" className="mt-0.5 h-4 w-4 accent-[#f8096d]" />
          <span>
            <span className="block text-sm font-medium">Super admin</span>
            <span className="block text-xs text-muted">Can create, reset and delete other admins.</span>
          </span>
        </label>
        <FormError error={state.error} />
      </SheetBody>
      <SheetFooter>
        <button type="button" className="btn btn-default" onClick={onClose}>
          Cancel
        </button>
        <SubmitButton pendingText="Creating…">Create admin</SubmitButton>
      </SheetFooter>
    </form>
  );
}

function ResetPasswordContent({ admin, onClose, minPassword }: { admin: AdminItem; onClose: () => void; minPassword: number }) {
  const toast = useToast();
  const [state, action] = useSheetAction(resetAdminPasswordAction, (s) => {
    onClose();
    toast(s.message ?? "Password reset.");
  });
  const id = useId();
  return (
    <form action={action} className={sheetFormClass}>
      <input type="hidden" name="id" value={admin.id} />
      <SheetBody>
        <label htmlFor={`${id}-p`} className="label">
          New password
        </label>
        <input
          id={`${id}-p`}
          name="password"
          type="password"
          className="input"
          minLength={minPassword}
          required
          autoComplete="new-password"
          data-autofocus
        />
        <p className="hint">At least {minPassword} characters.</p>
        <FormError error={state.error} />
      </SheetBody>
      <SheetFooter>
        <button type="button" className="btn btn-default" onClick={onClose}>
          Cancel
        </button>
        <SubmitButton pendingText="Saving…">Reset password</SubmitButton>
      </SheetFooter>
    </form>
  );
}

function DeleteAdminContent({ admin, onClose }: { admin: AdminItem; onClose: () => void }) {
  const toast = useToast();
  const [state, action] = useSheetAction(deleteAdminAction, (s) => {
    onClose();
    toast(s.message ?? "Admin deleted.");
  });
  return (
    <form action={action} className={sheetFormClass}>
      <input type="hidden" name="id" value={admin.id} />
      <SheetBody>
        <p className="text-sm text-zinc-600">
          <span className="font-medium text-foreground">{admin.username}</span> will no longer be able to sign in to the
          portal or the church laptop.
        </p>
        <FormError error={state.error} />
      </SheetBody>
      <SheetFooter>
        <button type="button" className="btn btn-default" onClick={onClose} data-autofocus>
          Cancel
        </button>
        <SubmitButton variant="danger" pendingText="Deleting…">
          Delete admin
        </SubmitButton>
      </SheetFooter>
    </form>
  );
}
