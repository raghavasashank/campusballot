import { requirePageUser } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("VOTER");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Nav
        email={user.email}
        roleLabel="Student"
        links={[
          { href: "/vote", label: "Elections" },
          { href: "/candidate/apply", label: "Apply as Candidate" },
          { href: "/candidate/status", label: "My Applications" },
        ]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
