import { requirePageUser } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("ADMIN");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Nav
        email={user.email}
        roleLabel="Admin"
        links={[
          { href: "/admin", label: "Elections" },
          { href: "/admin/candidates", label: "Candidate Queue" },
          { href: "/admin/sessions", label: "Sessions" },
          { href: "/admin/audit-log", label: "Audit Log" },
        ]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
