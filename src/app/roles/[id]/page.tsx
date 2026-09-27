import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { RecommendationBadge } from "@/components/RecommendationBadge";
import type { Recommendation, Rubric } from "@/lib/scoring";
import { env } from "@/lib/env";
import { RubricEditor } from "./RubricEditor";
import { CvUploader } from "./CvUploader";
import { CloseRoleButton } from "./CloseRoleButton";

// Scoring a CV runs inside a server action on this page and can take a minute.
export const maxDuration = 300;

export default async function RolePage({ params }: PageProps<"/roles/[id]">) {
  const { id } = await params;
  const { supabase, user } = await requireRecruiter();

  const { data: role } = await supabase.from("roles").select("*").eq("id", id).single();
  if (!role) notFound();

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, cv_filename, status, fit_score, recommendation, missing_must_haves, shortlisted, error, contact")
    .eq("role_id", id)
    .order("fit_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });

  const rubric = role.rubric as Rubric;
  const shortlisted = candidates?.filter((c) => c.shortlisted).length ?? 0;
  const deleteBy = role.closed_at
    ? new Date(new Date(role.closed_at).getTime() + env.retentionDays() * 86_400_000)
    : null;

  return (
    <AppShell email={user.email!}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← Roles</Link>
          <h1 className="mt-1 text-2xl font-semibold">{role.title}</h1>
          <p className="text-sm text-slate-500">
            {rubric.experience_level}
            {role.status === "closed" && deleteBy && (
              <> · Closed. CVs will be deleted on {deleteBy.toLocaleDateString("en-IN")}</>
            )}
          </p>
        </div>
        {role.status === "open" && <CloseRoleButton roleId={id} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {role.rubric_locked ? (
            <section className="card">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">Ranked candidates</h2>
                <span className="text-sm text-slate-500">
                  {candidates?.length ?? 0} CVs · {shortlisted} shortlisted
                </span>
              </div>
              {!candidates?.length ? (
                <p className="text-slate-600">Upload CVs to see them ranked here.</p>
              ) : (
                <div className="-mx-5 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-2">#</th>
                        <th className="px-2 py-2">Candidate</th>
                        <th className="px-2 py-2 text-right">Fit</th>
                        <th className="px-2 py-2">Recommendation</th>
                        <th className="px-5 py-2">Missing must-haves</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {candidates.map((c, i) => {
                        const name = (c.contact as { name?: string } | null)?.name || c.cv_filename;
                        return (
                          <tr key={c.id} className={c.shortlisted ? "bg-brand-soft/60" : undefined}>
                            <td className="px-5 py-3 text-slate-400 tabular-nums">{i + 1}</td>
                            <td className="px-2 py-3">
                              <Link href={`/roles/${id}/candidates/${c.id}`} className="font-medium text-brand hover:underline">
                                {name}
                              </Link>
                              {c.shortlisted && <span className="ml-2 text-xs font-medium text-brand">Shortlisted</span>}
                              {c.status === "failed" && <div className="text-xs text-rose-700">{c.error}</div>}
                              {c.status !== "scored" && c.status !== "failed" && (
                                <div className="text-xs text-slate-500">{c.status === "scoring" ? "Scoring…" : "Waiting to score"}</div>
                              )}
                            </td>
                            <td className="px-2 py-3 text-right font-mono tabular-nums">
                              {c.fit_score != null ? Number(c.fit_score).toFixed(0) : "–"}
                            </td>
                            <td className="px-2 py-3">
                              <RecommendationBadge value={c.recommendation as Recommendation | null} />
                            </td>
                            <td className="px-5 py-3 text-xs text-rose-700">
                              {(c.missing_must_haves as string[]).join(", ")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : (
            <RubricEditor roleId={id} initial={rubric} />
          )}

          <details className="card">
            <summary className="cursor-pointer font-medium">Job description</summary>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-slate-700">{role.jd}</pre>
          </details>
        </div>

        <aside className="space-y-6">
          {role.rubric_locked && role.status === "open" && <CvUploader roleId={id} ownerId={user.id} />}
          {role.rubric_locked && (
            <section className="card">
              <h2 className="mb-3 font-semibold">Rubric</h2>
              <ul className="space-y-2 text-sm">
                {rubric.criteria.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3">
                    <span>
                      {c.name}
                      {c.kind === "must_have" && <span className="ml-1 text-xs font-medium text-rose-700">must-have</span>}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-500">×{c.weight}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
