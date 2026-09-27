import Link from "next/link";
import { requireRecruiter } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";

export default async function RolesPage() {
  const { supabase, user } = await requireRecruiter();
  const { data: roles } = await supabase
    .from("roles")
    .select("id, title, status, rubric_locked, created_at, candidates(count)")
    .order("created_at", { ascending: false });

  return (
    <AppShell email={user.email!}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Roles</h1>
        <Link href="/roles/new" className="btn-primary">New role</Link>
      </div>

      {!roles?.length ? (
        <div className="card text-slate-600">
          No roles yet. Create one from a job description to start screening CVs.
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 p-0">
          {roles.map((r) => {
            const count = (r.candidates as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <Link key={r.id} href={`/roles/${r.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
                <div>
                  <div className="font-medium">{r.title}</div>
                  <div className="text-sm text-slate-500">
                    {count} CV{count === 1 ? "" : "s"} · created{" "}
                    {new Date(r.created_at).toLocaleDateString("en-IN")}
                  </div>
                </div>
                <span className="text-sm text-slate-500">
                  {r.status === "closed" ? "Closed" : r.rubric_locked ? "Screening" : "Rubric draft"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
