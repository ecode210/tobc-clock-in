"use client";

import { useRef } from "react";
import { FiltersSheet } from "@/components/FiltersSheet";

function shift(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function AttendanceFilters({
  params,
  today,
  departments,
  activeCount,
}: {
  params: { from: string; to: string; department: string; cutoff: string; status: string };
  today: string;
  departments: string[];
  activeCount: number;
}) {
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  const presets: [string, string, string][] = [
    ["Today", today, today],
    ["Yesterday", shift(today, -1), shift(today, -1)],
    ["Last 7 days", shift(today, -6), today],
    ["Last 30 days", shift(today, -29), today],
  ];

  return (
    <FiltersSheet
      params={params}
      keys={["from", "to", "department", "cutoff", "status"]}
      activeCount={activeCount}
      description="Narrow down attendance records."
    >
      <fieldset>
        <legend className="label">Date range</legend>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {presets.map(([label, from, to]) => (
            <button
              key={label}
              type="button"
              className="btn btn-default btn-sm max-md:h-9"
              onClick={() => {
                if (fromRef.current) fromRef.current.value = from;
                if (toRef.current) toRef.current.value = to;
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="f-from" className="mb-1 block text-xs text-muted">
              From
            </label>
            <input ref={fromRef} id="f-from" name="from" type="date" defaultValue={params.from} className="input" />
          </div>
          <div>
            <label htmlFor="f-to" className="mb-1 block text-xs text-muted">
              To
            </label>
            <input ref={toRef} id="f-to" name="to" type="date" defaultValue={params.to} className="input" />
          </div>
        </div>
      </fieldset>
      <div>
        <label htmlFor="f-department" className="label">
          Department
        </label>
        <select id="f-department" name="department" defaultValue={params.department} className="input">
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="f-status" className="label">
            Show
          </label>
          <select id="f-status" name="status" defaultValue={params.status} className="input">
            <option value="all">Everyone</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-cutoff" className="label">
            On-time cutoff
          </label>
          <input id="f-cutoff" name="cutoff" type="time" defaultValue={params.cutoff} className="input" />
        </div>
      </div>
      <p className="hint !mt-2">
        Clock-ins at or before the cutoff count as on time. Change the default cutoff on the Dashboard.
      </p>
    </FiltersSheet>
  );
}
