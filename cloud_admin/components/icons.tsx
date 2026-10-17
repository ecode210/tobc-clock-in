type IconProps = { className?: string };

function make(paths: string[], strokeWidth = 1.75) {
  return function Icon({ className = "h-4 w-4" }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  };
}

export const XIcon = make(["M6 6l12 12", "M18 6L6 18"]);
export const PlusIcon = make(["M12 5v14", "M5 12h14"], 2);
export const SearchIcon = make(["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M20 20l-3.5-3.5"]);
export const FilterIcon = make(["M4 6h16", "M7 12h10", "M10 18h4"]);
export const UploadIcon = make(["M12 15V4", "M8 8l4-4 4 4", "M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"]);
export const DownloadIcon = make(["M12 4v11", "M8 11l4 4 4-4", "M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"]);
export const PrinterIcon = make(["M7 9V4h10v5", "M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2", "M7 14h10v6H7z"]);
export const DotsIcon = make(["M5 12h.01", "M12 12h.01", "M19 12h.01"], 3);
export const ChevronLeftIcon = make(["M15 18l-6-6 6-6"]);
export const ChevronRightIcon = make(["M9 18l6-6-6-6"]);
export const CopyIcon = make(["M9 9h10v10H9z", "M5 15V5h10"]);
export const CheckIcon = make(["M5 12.5l4.5 4.5L19 7"], 2);
export const PencilIcon = make(["M4 20h4L19 9l-4-4L4 16v4z", "M13.5 6.5l4 4"]);
export const RefreshIcon = make(["M4 4v5h5", "M20 20v-5h-5", "M5.6 15a7 7 0 0 0 12.3 2", "M18.4 9A7 7 0 0 0 6.1 7"]);
export const TrashIcon = make(["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12", "M9 7V4h6v3"]);
export const KeyIcon = make(["M15 7a4 4 0 1 1-3.5 6L5 19.5V21H3v-3l6.5-6.5A4 4 0 0 1 15 7z", "M16 8h.01"]);
export const ExternalIcon = make(["M14 4h6v6", "M20 4l-9 9", "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"]);
export const HomeIcon = make(["M4 10.5L12 4l8 6.5", "M6 9v11h12V9"]);
export const UsersIcon = make(["M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1", "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M22 19v-1a4 4 0 0 0-3-3.87", "M16 5.13a3 3 0 0 1 0 5.74"]);
export const CalendarIcon = make(["M7 3v3", "M17 3v3", "M4 9h16", "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"]);
export const SyncIcon = make(["M4 4v5h5", "M20 20v-5h-5", "M5.6 15a7 7 0 0 0 12.3 2", "M18.4 9A7 7 0 0 0 6.1 7"]);
export const ShieldIcon = make(["M12 3l8 3.5V12c0 4.4-3.4 8.2-8 9-4.6-.8-8-4.6-8-9V6.5L12 3z"]);
export const UserIcon = make(["M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z", "M5 20a7 7 0 0 1 14 0"]);
export const MenuIcon = make(["M4 7h16", "M4 12h16", "M4 17h16"]);
export const LogoutIcon = make(["M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3", "M10 16l-4-4 4-4", "M6 12h10"]);
export const ClockIcon = make(["M12 7v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"]);
export const AlertIcon = make(["M12 9v4", "M12 17h.01", "M10.3 4.2L2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"]);
