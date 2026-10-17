import type { AttendanceStatus } from "@/lib/attendance";
import { Badge, type BadgeTone } from "./Badge";

const TONE: Record<AttendanceStatus, BadgeTone> = {
  "ON TIME": "green",
  LATE: "amber",
  ABSENT: "gray",
};

const LABEL: Record<AttendanceStatus, string> = {
  "ON TIME": "On time",
  LATE: "Late",
  ABSENT: "Absent",
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <Badge tone={TONE[status]} dot={status !== "ABSENT"}>
      {LABEL[status]}
    </Badge>
  );
}
