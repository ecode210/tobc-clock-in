import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="text-[13px] font-medium text-muted">404</p>
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="text-sm text-muted">That page does not exist or the record was deleted.</p>
      <Link href="/" className="btn btn-default mt-3">
        Back to dashboard
      </Link>
    </main>
  );
}
