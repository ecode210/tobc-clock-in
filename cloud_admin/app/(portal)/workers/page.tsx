import type { Metadata } from "next";
import { FilterChips, type FilterChip } from "@/components/FilterChips";
import { PageHeader } from "@/components/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { hrefWith, one, type Params } from "@/lib/url";
import { listDepartments, listWorkers, parseDeviceFilter } from "@/lib/workers";
import { toWorkerItem } from "./_components/to-item";
import { WorkersView } from "./_components/WorkersView";

export const metadata: Metadata = { title: "Workers" };

export default async function WorkersPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = one(sp.q);
  const department = one(sp.department);
  const device = parseDeviceFilter(one(sp.device));
  const [workers, departments] = await Promise.all([listWorkers({ q, department, device }), listDepartments()]);

  const params: Record<string, string> = {};
  if (q) params.q = q;
  if (department) params.department = department;
  if (device) params.device = device;

  const chips: FilterChip[] = [];
  if (department) chips.push({ label: department, href: hrefWith("/workers", params, { department: null }) });
  if (device) {
    chips.push({
      label: device === "locked" ? "Locked devices" : "Pending setup",
      href: hrefWith("/workers", params, { device: null }),
    });
  }

  const print = { q: q || null, department: department || null, unregistered: device === "pending" ? "1" : null };

  return (
    <>
      <PageHeader title="Workers" meta={workers.length} />
      <WorkersView
        workers={workers.map(toWorkerItem)}
        departments={departments}
        params={params}
        activeFilters={chips.length}
        exportHref={hrefWith("/api/workers/export", params, {})}
        printHref={hrefWith("/workers/print", {}, print)}
        chips={<FilterChips chips={chips} clearHref={hrefWith("/workers", params, { department: null, device: null })} />}
        hasQuery={Object.keys(params).length > 0}
      />
    </>
  );
}
