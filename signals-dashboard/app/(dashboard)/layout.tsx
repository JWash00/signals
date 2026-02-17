import { requireUser } from "@/lib/auth/requireUser";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--color-bg)" }}>
      <Sidebar userEmail={user.email ?? ""} />
      <main
        className="flex-1 overflow-y-auto"
        style={{ marginLeft: "var(--sidebar-width)" }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
