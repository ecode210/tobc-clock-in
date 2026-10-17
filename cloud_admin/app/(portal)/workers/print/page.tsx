import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { PrintButton } from "@/components/PrintButton";
import { requireAdmin } from "@/lib/auth";
import { one, type Params } from "@/lib/url";
import { listWorkers } from "@/lib/workers";

export const metadata: Metadata = { title: "Setup codes" };

export default async function PrintSetupCodesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = one(sp.q);
  const department = one(sp.department);
  const unregistered = one(sp.unregistered) === "1";
  const all = await listWorkers({ q, department });
  const workers = unregistered ? all.filter((w) => !w.device_token) : all;

  const toggle = new URLSearchParams();
  if (q) toggle.set("q", q);
  if (department) toggle.set("department", department);
  if (!unregistered) toggle.set("unregistered", "1");

  return (
    <>
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
        title="Setup code sheet"
        meta={workers.length}
        description={`${department ? `${department}. ` : ""}Cut along the dashed lines and hand each worker their card.`}
      />
      <div className="mb-4 flex gap-2 print:hidden">
        <Link href={`/workers/print?${toggle}`} className="btn btn-default">
          {unregistered ? "Show all workers" : "Only pending setup"}
        </Link>
        <PrintButton
          fileName={[
            "TOBC Clock-In Setup Codes",
            department,
            unregistered ? "Pending setup" : null,
            new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
          ]
            .filter(Boolean)
            .join(", ")}
        >
          Print sheet
        </PrintButton>
      </div>

      {workers.length === 0 ? (
        <p className="panel p-10 text-center text-muted">No workers to print.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 print:gap-0">
          {workers.map((w) => (
            <div
              key={w.id}
              className="break-inside-avoid rounded-lg border border-dashed border-line-strong bg-surface p-4 print:rounded-none print:border-gray-400"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Church clock-in setup</p>
              <p className="mt-1 text-base font-semibold">{w.name}</p>
              <p className="text-sm text-muted">{w.department || "\u00a0"}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted">Username</p>
                  <p className="font-mono font-medium">{w.username}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Setup code</p>
                  <p className="font-mono text-lg font-semibold tracking-[0.2em]">{w.setup_code}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">
                Join the church Wi-Fi, open the clock-in page, and enter these once on your phone.
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
