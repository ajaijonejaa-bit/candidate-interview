import Link from "next/link";
import { signOut } from "@/app/actions";

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold text-brand">
            Candidate Interview
          </Link>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span className="hidden sm:inline">{email}</span>
            <form action={signOut}>
              <button className="hover:text-slate-900">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
