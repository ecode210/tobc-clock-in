import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeviceBadge } from "@/components/Badge";
import { CopyButton } from "@/components/CopyButton";
import { ChevronLeftIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { getWorker, listDepartments } from "@/lib/workers";
import { toWorkerItem } from "../_components/to-item";
import { WorkerActions } from "../_components/WorkerActions";

export const metadata: Metadata = { title: "Manage worker" };

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [row, departments] = await Promise.all([getWorker(id), listDepartments()]);
  if (!row) notFound();
  const worker = toWorkerItem(row);

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={
          <Link
            href="/workers"
            className="-ml-1 inline-flex h-8 items-center gap-0.5 rounded-full px-2 text-[13px] font-medium text-muted hover:text-foreground"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Workers
          </Link>
        }
        title={worker.name}
        description={worker.department || "No department"}
      />

      <div className="mb-4">
        <WorkerActions worker={worker} departments={departments} />
      </div>

      <section className="panel">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Setup</h2>
        <dl className="divide-y divide-line text-sm">
          <Row label="Username">
            <span className="font-mono">{worker.username}</span>
            <CopyButton value={worker.username} label="Copy username" className="-my-2" />
          </Row>
          <Row label="Setup code">
            <span className="font-mono text-base font-semibold tracking-[0.2em]">{worker.setupCode}</span>
            <CopyButton value={worker.setupCode} label="Copy setup code" className="-my-2" />
          </Row>
          <Row label="Device">
            <DeviceBadge locked={worker.locked} />
          </Row>
          {worker.locked ? (
            <>
              <Row label="MAC address">
                <span className="font-mono text-[13px]">{worker.macAddress ?? "Not set"}</span>
              </Row>
              <Row label="Registered">{worker.registeredAt ?? "Never"}</Row>
            </>
          ) : null}
        </dl>
        {worker.locked ? null : (
          <p className="border-t border-line px-4 py-3 text-[13px] text-muted">
            No phone linked yet. The worker enters their username and setup code once while on the church Wi-Fi.
          </p>
        )}
      </section>

      <section className="panel mt-4">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Record</h2>
        <dl className="divide-y divide-line text-sm">
          <Row label="Added">{worker.createdAt}</Row>
          <Row label="Last updated">{worker.updatedAt}</Row>
        </dl>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2 md:grid md:grid-cols-[10rem_1fr] md:justify-start">
      <dt className="text-muted">{label}</dt>
      <dd className="flex items-center gap-1 text-right md:text-left">{children}</dd>
    </div>
  );
}
