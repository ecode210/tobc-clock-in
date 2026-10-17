import { AlertIcon } from "./icons";

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
      {error}
    </p>
  );
}
