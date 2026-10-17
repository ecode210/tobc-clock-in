"use client";

import { useState } from "react";
import { PencilIcon, RefreshIcon, TrashIcon } from "@/components/icons";
import type { WorkerItem } from "./types";
import { DeleteWorkerSheet, EditWorkerSheet, ResetDeviceSheet } from "./WorkerSheets";

export function WorkerActions({ worker, departments }: { worker: WorkerItem; departments: string[] }) {
  const [kind, setKind] = useState<"edit" | "reset" | "delete" | null>(null);
  const close = () => setKind(null);
  return (
    <>
      <div className="grid grid-cols-3 gap-2 md:flex">
        <button type="button" className="btn btn-default max-md:px-2" onClick={() => setKind("edit")}>
          <PencilIcon />
          Edit
        </button>
        <button type="button" className="btn btn-default max-md:px-2" onClick={() => setKind("reset")}>
          <RefreshIcon />
          <span className="md:hidden">Reset</span>
          <span className="max-md:hidden">Reset device</span>
        </button>
        <button type="button" className="btn btn-default text-red-600 max-md:px-2" onClick={() => setKind("delete")}>
          <TrashIcon />
          Delete
        </button>
      </div>
      <EditWorkerSheet open={kind === "edit"} onClose={close} worker={worker} departments={departments} />
      <ResetDeviceSheet open={kind === "reset"} onClose={close} worker={worker} onReset={close} />
      <DeleteWorkerSheet open={kind === "delete"} onClose={close} worker={worker} />
    </>
  );
}
