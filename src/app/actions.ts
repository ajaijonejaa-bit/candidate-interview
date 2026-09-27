"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireRecruiter } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { generateRubric } from "@/lib/ai/rubric";
import { extractCv, scoreProfile } from "@/lib/ai/cv";
import { computeFit, type Rubric } from "@/lib/scoring";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function audit(
  supabase: SupabaseClient,
  action: string,
  ids: { role_id?: string; candidate_id?: string },
  details?: Record<string, unknown>,
) {
  await supabase.from("audit_log").insert({ action, ...ids, details: details ?? null });
}

// Auth ------------------------------------------------------------------------

export async function signIn(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!env.isAllowedRecruiter(email)) return "This email is not allowed to use the app.";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return "Email or password is wrong.";
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Roles and rubric -------------------------------------------------------------

export async function createRole(_prev: string | null, form: FormData): Promise<string | null> {
  const { supabase } = await requireRecruiter();
  const title = String(form.get("title") ?? "").trim();
  const jd = String(form.get("jd") ?? "").trim();
  if (!title || jd.length < 50) return "Add a job title and a job description of at least a few lines.";

  let rubric: Rubric;
  try {
    rubric = await generateRubric(title, jd);
  } catch (e) {
    return e instanceof Error ? e.message : "Could not draft the rubric.";
  }

  const { data, error } = await supabase
    .from("roles")
    .insert({ title, jd, rubric })
    .select("id")
    .single();
  if (error) return error.message;

  await audit(supabase, "role_created", { role_id: data.id }, { title });
  redirect(`/roles/${data.id}`);
}

export async function saveRubric(roleId: string, rubric: Rubric, lock: boolean) {
  const { supabase } = await requireRecruiter();
  const criteria = rubric.criteria
    .filter((c) => c.name.trim())
    .map((c, i) => ({
      ...c,
      id: c.id || `c${i + 1}`,
      weight: Math.min(5, Math.max(1, Math.round(Number(c.weight) || 1))),
    }));
  if (criteria.length === 0) return { error: "Add at least one criterion." };

  const { error } = await supabase
    .from("roles")
    .update({ rubric: { ...rubric, criteria }, rubric_locked: lock })
    .eq("id", roleId)
    .eq("rubric_locked", false);
  if (error) return { error: error.message };

  await audit(supabase, lock ? "rubric_locked" : "rubric_saved", { role_id: roleId }, { criteria });
  revalidatePath(`/roles/${roleId}`);
  return { error: null };
}

export async function closeRole(roleId: string) {
  const { supabase } = await requireRecruiter();
  await supabase
    .from("roles")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", roleId);
  await audit(supabase, "role_closed", { role_id: roleId });
  revalidatePath(`/roles/${roleId}`);
  revalidatePath("/");
}

// Candidates -------------------------------------------------------------------

/** Records a CV the browser has already uploaded to storage. */
export async function registerCandidate(roleId: string, cvPath: string, cvFilename: string) {
  const { supabase, user } = await requireRecruiter();
  if (!cvPath.startsWith(`${user.id}/${roleId}/`)) return { id: null, error: "Invalid file path." };

  const { data, error } = await supabase
    .from("candidates")
    .insert({ role_id: roleId, cv_path: cvPath, cv_filename: cvFilename })
    .select("id")
    .single();
  if (error) return { id: null, error: error.message };

  await audit(supabase, "cv_uploaded", { role_id: roleId, candidate_id: data.id }, { cvFilename });
  return { id: data.id as string, error: null };
}

/** Reads, anonymises and scores one CV. Safe to call again to re-score. */
export async function scoreCandidate(candidateId: string) {
  const { supabase } = await requireRecruiter();

  const { data: candidate } = await supabase
    .from("candidates")
    .select("id, role_id, cv_path, cv_filename, roles(rubric, rubric_locked)")
    .eq("id", candidateId)
    .single();
  if (!candidate) return { error: "Candidate not found." };

  const role = candidate.roles as unknown as { rubric: Rubric; rubric_locked: boolean } | null;
  if (!role?.rubric_locked) return { error: "Lock the rubric before scoring CVs." };

  await supabase.from("candidates").update({ status: "scoring", error: null }).eq("id", candidateId);

  try {
    const { data: file, error: dlError } = await supabase.storage.from("cvs").download(candidate.cv_path);
    if (dlError || !file) throw new Error("Could not open the uploaded CV.");

    const { contact, profile } = await extractCv(file, candidate.cv_filename);
    const { scores, summary } = await scoreProfile(role.rubric, profile);
    const { fitScore, missingMustHaves, recommendation } = computeFit(role.rubric, scores);

    await supabase
      .from("candidates")
      .update({
        status: "scored",
        contact,
        profile,
        scores,
        summary,
        fit_score: fitScore,
        missing_must_haves: missingMustHaves,
        recommendation,
        scored_at: new Date().toISOString(),
      })
      .eq("id", candidateId);

    await audit(
      supabase,
      "cv_scored",
      { role_id: candidate.role_id, candidate_id: candidateId },
      { fitScore, recommendation, missingMustHaves },
    );
    return { error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Scoring failed.";
    await supabase.from("candidates").update({ status: "failed", error: message }).eq("id", candidateId);
    return { error: message };
  }
}

export async function setShortlisted(candidateId: string, roleId: string, shortlisted: boolean) {
  const { supabase } = await requireRecruiter();
  await supabase.from("candidates").update({ shortlisted }).eq("id", candidateId);
  await audit(
    supabase,
    shortlisted ? "shortlisted" : "removed_from_shortlist",
    { role_id: roleId, candidate_id: candidateId },
  );
  revalidatePath(`/roles/${roleId}`);
  revalidatePath(`/roles/${roleId}/candidates/${candidateId}`);
}

export async function deleteCandidate(candidateId: string, roleId: string) {
  const { supabase } = await requireRecruiter();
  const { data } = await supabase.from("candidates").select("cv_path").eq("id", candidateId).single();
  if (data) await supabase.storage.from("cvs").remove([data.cv_path]);
  await supabase.from("candidates").delete().eq("id", candidateId);
  await audit(supabase, "candidate_deleted", { role_id: roleId }, { candidateId });
  redirect(`/roles/${roleId}`);
}
