import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

// Daily job (see vercel.json): deletes CVs and candidate data for roles
// closed more than RETENTION_DAYS ago (180 by default).
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env.required("CRON_SECRET")}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - env.retentionDays() * 86_400_000).toISOString();

  const { data: roles, error } = await supabase
    .from("roles")
    .select("id, owner_id")
    .eq("status", "closed")
    .lt("closed_at", cutoff);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let deleted = 0;
  for (const role of roles ?? []) {
    const { data: candidates } = await supabase
      .from("candidates")
      .select("id, cv_path")
      .eq("role_id", role.id);
    if (!candidates?.length) continue;

    const { error: storageError } = await supabase.storage.from("cvs").remove(candidates.map((c) => c.cv_path));
    if (storageError) continue;

    await supabase.from("candidates").delete().eq("role_id", role.id);
    await supabase.from("audit_log").insert({
      owner_id: role.owner_id,
      role_id: role.id,
      action: "retention_deleted",
      details: { candidates: candidates.length, retention_days: env.retentionDays() },
    });
    deleted += candidates.length;
  }

  return NextResponse.json({ roles: roles?.length ?? 0, candidatesDeleted: deleted });
}
