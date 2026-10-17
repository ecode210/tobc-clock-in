"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { DeviceBadge } from "@/components/Badge";
import { CopyButton, CopyField } from "@/components/CopyButton";
import { FormError } from "@/components/FormError";
import { PencilIcon, PrinterIcon, RefreshIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { ResponsiveSheet, SheetBody, SheetFooter, sheetFormClass } from "@/components/ResponsiveSheet";
import { SubmitButton } from "@/components/SubmitButton";
import { useToast } from "@/components/Toaster";
import { useSheetAction } from "@/components/useSheetAction";
import { parseCsv } from "@/lib/csv";
import type { ActionState } from "@/lib/action-state";
import {
  createWorkerAction,
  deleteWorkerAction,
  importWorkersAction,
  resetDeviceAction,
  updateWorkerAction,
} from "../actions";
import type { WorkerItem } from "./types";

type SheetProps = { open: boolean; onClose: () => void };

function DepartmentField({ id, departments, defaultValue }: { id: string; departments: string[]; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        Department <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        id={id}
        name="department"
        className="input"
        placeholder="e.g. Choir"
        list={`${id}-options`}
        defaultValue={defaultValue}
        maxLength={120}
        autoComplete="off"
      />
      <datalist id={`${id}-options`}>
        {departments.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
    </div>
  );
}

/* Add worker */

export function AddWorkerSheet({ open, onClose, departments }: SheetProps & { departments: string[] }) {
  return (
    <ResponsiveSheet open={open} onClose={onClose} title="Add worker"
      description="They get a setup code for their phone."
    >
      <AddWorkerContent onClose={onClose} departments={departments} />
    </ResponsiveSheet>
  );
}

function AddWorkerContent({ onClose, departments }: { onClose: () => void; departments: string[] }) {
  const [created, setCreated] = useState<ActionState["worker"] | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [state, action] = useSheetAction(createWorkerAction, (s) => setCreated(s.worker ?? null));
  const id = useId();

  if (created) {
    return (
      <>
        <SheetBody>
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">{created.name}</span> was added. Give them these details to set
            up their phone.
          </p>
          <div className="mt-4 space-y-2">
            <CopyField label="Username" value={created.username} />
            <CopyField label="Setup code" value={created.setupCode} emphasis />
          </div>
          <CopyButton
            value={`Clock-in setup for ${created.name}\nUsername: ${created.username}\nSetup code: ${created.setupCode}`}
            label="Copy username and setup code"
            className="mt-3 w-full"
          >
            Copy both as a message
          </CopyButton>
        </SheetBody>
        <SheetFooter>
          <button
            type="button"
            className="btn btn-default"
            onClick={() => {
              setCreated(null);
              setFormKey((k) => k + 1);
            }}
          >
            Add another
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </SheetFooter>
      </>
    );
  }

  return (
    <form key={formKey} action={action} className={sheetFormClass}>
      <SheetBody className="space-y-4">
        <div>
          <label htmlFor={`${id}-name`} className="label">
            Full name
          </label>
          <input
            id={`${id}-name`}
            name="name"
            className="input"
            placeholder="Jane Doe"
            required
            maxLength={120}
            autoComplete="off"
            autoCapitalize="words"
            data-autofocus
          />
          <p className="hint">A username and setup code are generated automatically.</p>
        </div>
        <DepartmentField id={`${id}-dept`} departments={departments} />
        <FormError error={state.error} />
      </SheetBody>
      <SheetFooter>
        <button type="button" className="btn btn-default" onClick={onClose}>
          Cancel
        </button>
        <SubmitButton pendingText="Adding…">Add worker</SubmitButton>
      </SheetFooter>
    </form>
  );
}

/* Import CSV */

type Preview = { fileName: string; count: number; skipped: number; sample: string[] };

function looksLikeHeader(row: string[]): boolean {
  const first = row[0]?.trim().toLowerCase() ?? "";
  const second = row[1]?.trim().toLowerCase() ?? "";
  return (
    ["name", "full name", "fullname", "worker", "worker name"].includes(first) || ["department", "dept"].includes(second)
  );
}

export function ImportSheet({ open, onClose }: SheetProps) {
  return (
    <ResponsiveSheet open={open} onClose={onClose} title="Import workers" description="Upload a CSV with Name and Department columns.">
      <ImportContent onClose={onClose} />
    </ResponsiveSheet>
  );
}

function ImportContent({ onClose }: { onClose: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [state, action] = useSheetAction(importWorkersAction, (s) => setResult(s.message ?? "Import complete."));
  const id = useId();

  async function onFile(file: File | undefined) {
    if (!file) return setPreview(null);
    const rows = parseCsv(await file.text());
    if (rows.length > 0 && looksLikeHeader(rows[0])) rows.shift();
    const named = rows.filter((r) => r[0]?.trim());
    setPreview({
      fileName: file.name,
      count: named.length,
      skipped: rows.length - named.length,
      sample: named.slice(0, 3).map((r) => r[0].trim()),
    });
  }

  if (result) {
    return (
      <>
        <SheetBody>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">{result}</div>
          <p className="mt-3 text-sm text-muted">New workers appear in the list with their setup codes.</p>
        </SheetBody>
        <SheetFooter>
          <Link href="/workers/print?unregistered=1" className="btn btn-default">
            <PrinterIcon />
            Print setup codes
          </Link>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </SheetFooter>
      </>
    );
  }

  return (
    <form action={action} className={sheetFormClass}>
      <SheetBody>
        <label
          htmlFor={`${id}-file`}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-3xl border border-dashed border-line-strong bg-subtle px-4 py-6 text-center hover:border-zinc-400"
        >
          <UploadIcon className="mb-1 h-5 w-5 text-muted" />
          <span className="text-sm font-medium">{preview ? preview.fileName : "Choose a CSV file"}</span>
          <span className="text-xs text-muted">{preview ? "Tap to choose a different file" : "2 MB max"}</span>
        </label>
        <input
          id={`${id}-file`}
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />

        {preview ? (
          <div className="mt-4 rounded-2xl border border-line">
            <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <span className="text-sm font-medium">
                {preview.count} worker{preview.count === 1 ? "" : "s"} found
              </span>
              {preview.skipped ? (
                <span className="text-xs text-muted">
                  {preview.skipped} row{preview.skipped === 1 ? "" : "s"} without a name will be skipped
                </span>
              ) : null}
            </div>
            {preview.sample.length ? (
              <ul className="px-3 py-2 text-sm text-muted">
                {preview.sample.map((n, i) => (
                  <li key={`${n}-${i}`} className="truncate py-0.5">
                    {n}
                  </li>
                ))}
                {preview.count > preview.sample.length ? (
                  <li className="py-0.5 text-xs">and {preview.count - preview.sample.length} more</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-subtle px-4 py-3 text-xs text-muted">
            <p className="mb-1 font-medium text-foreground">Expected format</p>
            <pre className="font-mono leading-5">{"Name,Department\nJane Doe,Choir\nJohn Smith,Ushers"}</pre>
            <p className="mt-1">A header row is detected automatically.</p>
          </div>
        )}
        <FormError error={state.error} />
      </SheetBody>
      <SheetFooter>
        <button type="button" className="btn btn-default" onClick={onClose}>
          Cancel
        </button>
        <SubmitButton pendingText="Importing…">
          {preview?.count ? `Import ${preview.count} worker${preview.count === 1 ? "" : "s"}` : "Import"}
        </SubmitButton>
      </SheetFooter>
    </form>
  );
}

/* Edit worker */

export function EditWorkerSheet({
  open,
  onClose,
  worker,
  departments,
}: SheetProps & { worker: WorkerItem | null; departments: string[] }) {
  return (
    <ResponsiveSheet open={open && !!worker} onClose={onClose} title="Edit worker"
      description="Update their name or department."
    >
      {worker ? <EditWorkerContent worker={worker} departments={departments} onClose={onClose} /> : null}
    </ResponsiveSheet>
  );
}

function EditWorkerContent({ worker, departments, onClose }: { worker: WorkerItem; departments: string[]; onClose: () => void }) {
  const toast = useToast();
  const [state, action] = useSheetAction(updateWorkerAction, () => {
    onClose();
    toast("Changes saved.");
  });
  const id = useId();
  return (
    <form action={action} className={sheetFormClass}>
      <input type="hidden" name="id" value={worker.id} />
      <SheetBody className="space-y-4">
        <div>
          <label htmlFor={`${id}-name`} className="label">
            Full name
          </label>
          <input
            id={`${id}-name`}
            name="name"
            defaultValue={worker.name}
            className="input"
            required
            maxLength={120}
            autoComplete="off"
            data-autofocus
          />
          <p className="hint">The username ({worker.username}) does not change.</p>
        </div>
        <DepartmentField id={`${id}-dept`} departments={departments} defaultValue={worker.department} />
        <FormError error={state.error} />
      </SheetBody>
      <SheetFooter>
        <button type="button" className="btn btn-default" onClick={onClose}>
          Cancel
        </button>
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
      </SheetFooter>
    </form>
  );
}

/* Reset device and delete confirmations */

function ConfirmContent({
  worker,
  action,
  onDone,
  onClose,
  confirmLabel,
  pendingText,
  danger,
  onSubmit,
  children,
}: {
  worker: WorkerItem;
  action: typeof resetDeviceAction;
  onDone: (s: ActionState) => void;
  onClose: () => void;
  confirmLabel: string;
  pendingText: string;
  danger?: boolean;
  onSubmit?: () => void;
  children: React.ReactNode;
}) {
  const [state, formAction] = useSheetAction(action, onDone);
  return (
    <form action={formAction} className={sheetFormClass} onSubmit={onSubmit}>
      <input type="hidden" name="id" value={worker.id} />
      <SheetBody>
        <div className="space-y-2 text-sm text-zinc-600">{children}</div>
        <FormError error={state.error} />
      </SheetBody>
      <SheetFooter>
        <button type="button" className="btn btn-default" onClick={onClose} data-autofocus>
          Cancel
        </button>
        <SubmitButton variant={danger ? "danger" : "primary"} pendingText={pendingText}>
          {confirmLabel}
        </SubmitButton>
      </SheetFooter>
    </form>
  );
}

export function ResetDeviceSheet({
  open,
  onClose,
  worker,
  onReset,
}: SheetProps & { worker: WorkerItem | null; onReset: () => void }) {
  const toast = useToast();
  return (
    <ResponsiveSheet open={open && !!worker} onClose={onClose} title="Reset device?"
      description="Unlink their current phone."
    >
      {worker ? (
        <ConfirmContent
          worker={worker}
          action={resetDeviceAction}
          onClose={onClose}
          onDone={(s) => {
            onReset();
            toast(s.message ?? "Device reset.");
          }}
          confirmLabel="Reset device"
          pendingText="Resetting…"
        >
          <p>
            <span className="font-medium text-foreground">{worker.name}</span>&apos;s phone will be unlinked and a new
            setup code issued.
          </p>
          <p>They will need the new code to clock in again.</p>
        </ConfirmContent>
      ) : null}
    </ResponsiveSheet>
  );
}

// The delete action redirects to /workers (remounting the list), so success is detected by the
// list noticing the submitted worker is gone. Module scope survives that remount.
let pendingDelete: { id: string; name: string; at: number } | null = null;

/** Returns the name of a just-deleted worker once it no longer appears in `workers`. */
export function takeDeletedWorker(workers: WorkerItem[]): string | null {
  const p = pendingDelete;
  if (!p || Date.now() - p.at > 30_000) return null;
  if (workers.some((w) => w.id === p.id)) return null;
  pendingDelete = null;
  return p.name;
}

export function DeleteWorkerSheet({ open, onClose, worker }: SheetProps & { worker: WorkerItem | null }) {
  return (
    <ResponsiveSheet open={open && !!worker} onClose={onClose} title="Delete worker?"
      description="This cannot be undone."
    >
      {worker ? (
        <ConfirmContent
          worker={worker}
          action={deleteWorkerAction}
          onClose={onClose}
          onSubmit={() => {
            pendingDelete = { id: worker.id, name: worker.name, at: Date.now() };
          }}
          onDone={onClose}
          confirmLabel="Delete worker"
          pendingText="Deleting…"
          danger
        >
          <p>
            This permanently removes <span className="font-medium text-foreground">{worker.name}</span> and all of their
            attendance records.
          </p>
          <p>This cannot be undone.</p>
        </ConfirmContent>
      ) : null}
    </ResponsiveSheet>
  );
}

/* Mobile row detail */

export function WorkerDetailSheet({
  open,
  onClose,
  worker,
  onEdit,
  onReset,
  onDelete,
}: SheetProps & { worker: WorkerItem | null; onEdit: () => void; onReset: () => void; onDelete: () => void }) {
  return (
    <ResponsiveSheet
      open={open && !!worker}
      onClose={onClose}
      title={worker?.name ?? ""}
      description={worker ? worker.department || "No department" : undefined}
    >
      {worker ? (
        <>
          <SheetBody>
            <div className="space-y-2">
              <CopyField label="Username" value={worker.username} />
              <CopyField label="Setup code" value={worker.setupCode} emphasis />
            </div>
            <dl className="mt-4 divide-y divide-line rounded-2xl border border-line text-sm">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <dt className="text-muted">Device</dt>
                <dd>
                  <DeviceBadge locked={worker.locked} />
                </dd>
              </div>
              {worker.locked ? (
                <>
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <dt className="text-muted">MAC address</dt>
                    <dd className="font-mono text-[13px]">{worker.macAddress ?? "Not set"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <dt className="text-muted">Registered</dt>
                    <dd>{worker.registeredAt ?? "Never"}</dd>
                  </div>
                </>
              ) : null}
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <dt className="text-muted">Added</dt>
                <dd>{worker.createdAt}</dd>
              </div>
            </dl>
            <Link href={`/workers/${worker.id}`} className="btn btn-primary mt-4 w-full">
              View More
            </Link>
          </SheetBody>
          <div className="sheet-footer grid shrink-0 grid-cols-3 gap-2 border-t border-line px-4 pt-3 md:px-5">
            <button type="button" className="btn btn-default px-2" onClick={onEdit}>
              <PencilIcon />
              Edit
            </button>
            <button type="button" className="btn btn-default px-2" onClick={onReset}>
              <RefreshIcon />
              Reset
            </button>
            <button type="button" className="btn btn-default px-2 text-red-600" onClick={onDelete}>
              <TrashIcon />
              Delete
            </button>
          </div>
        </>
      ) : null}
    </ResponsiveSheet>
  );
}
