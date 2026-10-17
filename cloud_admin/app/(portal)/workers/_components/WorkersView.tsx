"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DeviceBadge } from "@/components/Badge";
import { FiltersSheet } from "@/components/FiltersSheet";
import {
  ChevronRightIcon,
  DotsIcon,
  DownloadIcon,
  ExternalIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  RefreshIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";
import { Toolbar } from "@/components/PageHeader";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { RowMenu } from "@/components/RowMenu";
import { SearchInput } from "@/components/SearchInput";
import { useToast } from "@/components/Toaster";
import type { WorkerItem } from "./types";
import {
  AddWorkerSheet,
  DeleteWorkerSheet,
  EditWorkerSheet,
  ImportSheet,
  ResetDeviceSheet,
  takeDeletedWorker,
  WorkerDetailSheet,
} from "./WorkerSheets";

type Kind = "add" | "import" | "actions" | "detail" | "edit" | "reset" | "delete";

export function WorkersView({
  workers,
  departments,
  params,
  activeFilters,
  exportHref,
  printHref,
  chips,
  hasQuery,
}: {
  workers: WorkerItem[];
  departments: string[];
  params: Record<string, string>;
  activeFilters: number;
  exportHref: string;
  printHref: string;
  chips: React.ReactNode;
  hasQuery: boolean;
}) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [lastTarget, setLastTarget] = useState<WorkerItem | null>(null);

  const toast = useToast();
  useEffect(() => {
    const deleted = takeDeletedWorker(workers);
    if (deleted) toast(`Deleted ${deleted}.`);
  }, [workers, toast]);

  const live = targetId ? (workers.find((w) => w.id === targetId) ?? null) : null;
  const target = live ?? lastTarget;
  const close = () => setKind(null);

  function openFor(next: Kind, w: WorkerItem) {
    setTargetId(w.id);
    setLastTarget(w);
    setKind(next);
  }

  return (
    <>
      <Toolbar>
        <SearchInput key={params.q ?? ""} params={params} placeholder="Search workers" />
        <FiltersSheet
          params={params}
          keys={["department", "device"]}
          activeCount={activeFilters}
          description="Narrow down the worker list."
        >
          <div>
            <label htmlFor="f-department" className="label">
              Department
            </label>
            <select id="f-department" name="department" defaultValue={params.department ?? ""} className="input">
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className="label">Device</legend>
            <div className="grid grid-cols-3 gap-1 rounded-full bg-zinc-100 p-1">
              {[
                ["", "Any"],
                ["locked", "Locked"],
                ["pending", "Pending setup"],
              ].map(([value, label]) => (
                <label key={value} className="relative">
                  <input
                    type="radio"
                    name="device"
                    value={value}
                    defaultChecked={(params.device ?? "") === value}
                    className="peer sr-only"
                  />
                  <span className="flex h-10 cursor-pointer items-center justify-center rounded-full px-2 text-center text-[13px] font-medium text-muted peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-primary md:h-8">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </FiltersSheet>

        <div className="ml-auto flex items-center gap-2">
          <a href={exportHref} className="btn btn-default hidden md:inline-flex">
            <DownloadIcon />
            Export
          </a>
          <Link
            href={printHref}
            className="btn btn-default btn-icon hidden md:inline-flex"
            aria-label="Print setup codes"
            title="Print setup codes"
          >
            <PrinterIcon />
          </Link>
          <button type="button" className="btn btn-default hidden md:inline-flex" onClick={() => setKind("import")}>
            <UploadIcon />
            Import CSV
          </button>
          <button
            type="button"
            className="btn btn-default btn-icon md:hidden"
            onClick={() => setKind("actions")}
            aria-label="More actions"
          >
            <DotsIcon />
          </button>
          <button
            type="button"
            className="btn btn-primary max-md:w-11 max-md:px-0"
            onClick={() => setKind("add")}
            aria-label="Add worker"
          >
            <PlusIcon />
            <span className="max-md:sr-only">Add worker</span>
          </button>
        </div>
      </Toolbar>

      {chips}

      {workers.length === 0 ? (
        <div className="panel mt-1 flex flex-col items-center px-6 py-14 text-center">
          <p className="font-medium">{hasQuery ? "No matching workers" : "No workers yet"}</p>
          <p className="mt-1 text-sm text-muted">
            {hasQuery ? "Try a different search or clear the filters." : "Add workers one at a time or import a CSV."}
          </p>
          {hasQuery ? null : (
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn btn-default" onClick={() => setKind("import")}>
                Import CSV
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setKind("add")}>
                Add worker
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Mobile list */}
          <ul className="panel mt-1 divide-y divide-line overflow-hidden md:hidden">
            {workers.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => openFor("detail", w)}
                  className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-zinc-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium leading-5">{w.name}</p>
                    <p className="mt-0.5 truncate text-[13px] text-muted">
                      {w.department || "No department"}
                      <span className="px-1.5 text-zinc-300">·</span>
                      <span className="font-mono text-[12px]">{w.username}</span>
                    </p>
                  </div>
                  <DeviceBadge locked={w.locked} />
                  <ChevronRightIcon className="-mr-1 h-4 w-4 shrink-0 text-zinc-300" />
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="panel mt-1 hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Username</th>
                  <th>Setup code</th>
                  <th>Device</th>
                  <th className="w-10">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id}>
                    <td className="font-medium">
                      <Link href={`/workers/${w.id}`} className="block max-w-[16rem] truncate hover:underline">
                        {w.name}
                      </Link>
                    </td>
                    <td className="text-zinc-600">
                      <span className="block max-w-[12rem] truncate">
                        {w.department || <span className="text-zinc-400">None</span>}
                      </span>
                    </td>
                    <td className="font-mono text-[13px] text-zinc-600">{w.username}</td>
                    <td className="font-mono text-[13px] tracking-[0.12em]">{w.setupCode}</td>
                    <td>
                      <DeviceBadge locked={w.locked} />
                    </td>
                    <td className="text-right">
                      <RowMenu
                        label={`Actions for ${w.name}`}
                        items={[
                          { label: "View details", icon: <ExternalIcon />, href: `/workers/${w.id}` },
                          { label: "Edit", icon: <PencilIcon />, onSelect: () => openFor("edit", w) },
                          { label: "Reset device", icon: <RefreshIcon />, onSelect: () => openFor("reset", w) },
                          { label: "Delete", icon: <TrashIcon />, onSelect: () => openFor("delete", w), danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AddWorkerSheet open={kind === "add"} onClose={close} departments={departments} />
      <ImportSheet open={kind === "import"} onClose={close} />
      <WorkerDetailSheet
        open={kind === "detail" && !!live}
        onClose={close}
        worker={target}
        onEdit={() => setKind("edit")}
        onReset={() => setKind("reset")}
        onDelete={() => setKind("delete")}
      />
      <EditWorkerSheet open={kind === "edit" && !!live} onClose={close} worker={target} departments={departments} />
      <ResetDeviceSheet
        open={kind === "reset" && !!live}
        onClose={close}
        worker={target}
        onReset={() => setKind("detail")}
      />
      <DeleteWorkerSheet open={kind === "delete" && !!live} onClose={close} worker={target} />

      <ResponsiveSheet open={kind === "actions"} onClose={close} title="Workers"
        description="Import, export, or print."
      >
        <div className="sheet-footer py-1">
          <button
            type="button"
            className="flex h-12 w-full items-center gap-3 px-4 text-left text-[15px] active:bg-zinc-50"
            onClick={() => setKind("import")}
          >
            <UploadIcon className="h-5 w-5 text-muted" />
            Import from CSV
          </button>
          <a
            href={exportHref}
            onClick={close}
            className="flex h-12 items-center gap-3 px-4 text-[15px] active:bg-zinc-50"
          >
            <DownloadIcon className="h-5 w-5 text-muted" />
            Export CSV
          </a>
          <Link href={printHref} className="flex h-12 items-center gap-3 px-4 text-[15px] active:bg-zinc-50">
            <PrinterIcon className="h-5 w-5 text-muted" />
            Print setup codes
          </Link>
        </div>
      </ResponsiveSheet>
    </>
  );
}
