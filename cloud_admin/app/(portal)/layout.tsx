import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "@/components/Toaster";
import { requireAdmin } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <Toaster>
      <Sidebar username={admin.username} isSuper={admin.isSuper} />
      <main
        className="lg:pl-56 print:p-0"
        style={{ minHeight: "calc(100dvh - var(--topbar-h))", paddingBottom: "calc(var(--tabbar-h) + 1.5rem)" }}
      >
        <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 print:max-w-none print:p-0">{children}</div>
      </main>
    </Toaster>
  );
}
