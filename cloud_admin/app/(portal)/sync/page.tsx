import type { Metadata } from "next";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { SyncNowButton } from "@/components/SyncNowButton";
import { requireAdmin } from "@/lib/auth";
import { getSyncStatus, isLaptopOnline } from "@/lib/sync-status";
import { formatDateTime, formatRelative } from "@/lib/time";

export const metadata: Metadata = { title: "Sync" };

export default async function SyncPage() {
  await requireAdmin();
  const status = await getSyncStatus();
  const online = isLaptopOnline(status);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Sync" actions={<SyncNowButton />} />

      <section className="panel">
        <dl className="divide-y divide-line text-sm">
          <Row label="Laptop">
            {online ? (
              <Badge tone="green" dot>
                Online
              </Badge>
            ) : (
              <Badge>{status.last_heartbeat_at ? "Offline" : "Never connected"}</Badge>
            )}
          </Row>
          <Row label="Last heartbeat" detail={status.last_heartbeat_at ? formatDateTime(status.last_heartbeat_at) : undefined}>
            {status.last_heartbeat_at ? formatRelative(status.last_heartbeat_at) : "Never"}
          </Row>
          <Row label="Last successful sync" detail={status.last_success_at ? formatDateTime(status.last_success_at) : undefined}>
            {status.last_success_at ? formatRelative(status.last_success_at) : "None reported yet"}
          </Row>
          <Row label="Pending clock-ins" detail="As reported in the last heartbeat">
            <span className={`tabular-nums ${status.pending_clock_ins > 0 ? "font-semibold text-primary" : ""}`}>
              {status.pending_clock_ins}
            </span>
          </Row>
          <Row label="Sync request">
            {status.sync_requested_at ? (
              <Badge tone="amber" dot>
                Waiting for laptop
              </Badge>
            ) : (
              <span className="text-muted">None pending</span>
            )}
          </Row>
          {status.client_version ? <Row label="Protocol version">{status.client_version}</Row> : null}
        </dl>
      </section>

      <p className="mt-3 text-[13px] leading-5 text-muted">
        The church laptop connects out to this portal every minute and cannot be reached directly. Sync now queues a
        request that it collects on its next check-in, then it pulls the latest workers and admins and uploads queued
        clock-ins.
      </p>
    </div>
  );
}

function Row({ label, detail, children }: { label: string; detail?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5 md:grid md:grid-cols-[12rem_1fr] md:justify-start">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right md:text-left">
        <div className="flex items-center justify-end gap-2 md:justify-start">{children}</div>
        {detail ? <p className="mt-0.5 text-xs text-muted">{detail}</p> : null}
      </dd>
    </div>
  );
}
