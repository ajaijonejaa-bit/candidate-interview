import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { RecommendationBadge } from "@/components/RecommendationBadge";
import type { CriterionScore, Recommendation, Rubric } from "@/lib/scoring";
import type { CvExtract } from "@/lib/ai/cv";
import { CandidateActions } from "./CandidateActions";

export const maxDuration = 300;

export default async function CandidatePage({ params }: PageProps<"/roles/[id]/candidates/[candidateId]">) {
  const { id, candidateId } = await params;
  const { supabase, user } = await requireRecruiter();

  const { data: c } = await supabase
    .from("candidates")
    .select("*, roles(title, rubric)")
    .eq("id", candidateId)
    .eq("role_id", id)
    .single();
  if (!c) notFound();

  const role = c.roles as unknown as { title: string; rubric: Rubric };
  const contact = c.contact as CvExtract["contact"] | null;
  const profile = c.profile as CvExtract["profile"] | null;
  const scores = new Map(((c.scores as CriterionScore[] | null) ?? []).map((s) => [s.criterion_id, s]));

  const { data: signed } = await supabase.storage.from("cvs").createSignedUrl(c.cv_path, 300);

  return (
    <AppShell email={user.email!}>
      <Link href={`/roles/${id}`} className="text-sm text-slate-500 hover:text-slate-800">← {role.title}</Link>

      <div className="mt-1 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{contact?.name || c.cv_filename}</h1>
          <p className="text-sm text-slate-500">
            {[contact?.email, contact?.phone, contact?.location].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {c.fit_score != null && (
            <span className="font-mono text-2xl font-semibold tabular-nums">{Number(c.fit_score).toFixed(0)}<span className="text-sm text-slate-400">/100</span></span>
          )}
          <RecommendationBadge value={c.recommendation as Recommendation | null} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {c.status === "failed" && <div className="card border-rose-200 text-rose-800">Scoring failed: {c.error}</div>}

          {c.summary && (
            <section className="card">
              <h2 className="mb-2 font-semibold">AI summary</h2>
              <p className="text-slate-700">{c.summary}</p>
              {(c.missing_must_haves as string[]).length > 0 && (
                <p className="mt-3 text-sm text-rose-700">
                  Missing must-haves: {(c.missing_must_haves as string[]).join(", ")}
                </p>
              )}
            </section>
          )}

          <section className="card p-0">
            <h2 className="px-5 pt-5 pb-3 font-semibold">Score by criterion</h2>
            <ul className="divide-y divide-slate-100">
              {role.rubric.criteria.map((cr) => {
                const s = scores.get(cr.id);
                return (
                  <li key={cr.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-3">
                    <div className="font-medium">
                      {cr.name}
                      {cr.kind === "must_have" && <span className="ml-2 text-xs font-medium text-rose-700">must-have</span>}
                      <span className="ml-2 font-mono text-xs text-slate-400">×{cr.weight}</span>
                    </div>
                    <ScoreDots score={s?.score ?? 0} />
                    {s && (
                      <div className="col-span-2 text-sm text-slate-600">
                        {s.evidence && <p className="italic">“{s.evidence}”</p>}
                        <p>{s.reasoning}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {profile && (
            <section className="card space-y-3 text-sm">
              <h2 className="font-semibold">Anonymised profile the AI scored</h2>
              <p className="text-slate-500">
                The scoring step saw only this, never the name, photo or personal details on the CV.
              </p>
              <p><span className="font-medium">{profile.headline}</span> · {profile.total_experience_years} years</p>
              <p><span className="font-medium">Skills:</span> {profile.skills.join(", ")}</p>
              {profile.experience.map((e, i) => (
                <div key={i}>
                  <p className="font-medium">{e.role_title} <span className="font-normal text-slate-500">· {e.employer_type} · {e.duration_months} months</span></p>
                  <ul className="list-disc pl-5 text-slate-700">
                    {[...e.responsibilities, ...e.achievements].map((x, j) => <li key={j}>{x}</li>)}
                  </ul>
                </div>
              ))}
              {profile.education.length > 0 && (
                <p><span className="font-medium">Education:</span> {profile.education.map((e) => `${e.qualification} (${e.year_completed})`).join("; ")}</p>
              )}
              {profile.certifications.length > 0 && (
                <p><span className="font-medium">Certifications:</span> {profile.certifications.join(", ")}</p>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <CandidateActions candidateId={candidateId} roleId={id} shortlisted={c.shortlisted} />
          {signed?.signedUrl && (
            <a href={signed.signedUrl} target="_blank" rel="noreferrer" className="btn-secondary w-full">
              Open original CV
            </a>
          )}
          <p className="text-xs text-slate-500">
            The AI score is a recommendation. You make the shortlisting decision, and every decision is recorded.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`h-2.5 w-2.5 rounded-full ${n <= score ? "bg-brand" : "bg-slate-200"}`} />
      ))}
      <span className="ml-1 font-mono text-xs tabular-nums text-slate-500">{score}/5</span>
    </div>
  );
}
