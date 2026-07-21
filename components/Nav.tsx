import Link from "next/link";
import { LogOut, Vote } from "lucide-react";

export function Nav({
  email,
  roleLabel,
  links,
}: {
  email: string;
  roleLabel: string;
  links: { href: string; label: string }[];
}) {
  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
            <Vote size={20} />
            CampusBallot
          </Link>
          <nav className="flex flex-wrap gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <span className="hidden sm:inline">
            {email} · {roleLabel}
          </span>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
