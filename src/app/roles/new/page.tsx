import { requireRecruiter } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { NewRoleForm } from "./NewRoleForm";

export const maxDuration = 120;

export default async function NewRolePage() {
  const { user } = await requireRecruiter();
  return (
    <AppShell email={user.email!}>
      <h1 className="mb-2 text-2xl font-semibold">New role</h1>
      <p className="mb-6 max-w-2xl text-slate-600">
        Paste the job description. Claude drafts a scoring rubric from it, which you can edit before any CV is scored.
      </p>
      <NewRoleForm />
    </AppShell>
  );
}
