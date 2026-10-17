"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size,
  className = "",
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "default" | "secondary" | "ghost" | "danger";
  size?: "sm";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`}
    >
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}
