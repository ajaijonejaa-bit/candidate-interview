"use client";

import { useActionState } from "react";
import { createRole } from "@/app/actions";

export function NewRoleForm() {
  const [error, action, pending] = useActionState(createRole, null);
  return (
    <form action={action} className="card max-w-3xl space-y-4">
      <div>
        <label htmlFor="title" className="label">Job title</label>
        <input id="title" name="title" required className="input" placeholder="e.g. Senior Backend Engineer" />
      </div>
      <div>
        <label htmlFor="jd" className="label">Job description</label>
        <textarea id="jd" name="jd" required rows={16} className="input font-mono text-xs" />
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Drafting rubric…" : "Create role and draft rubric"}
      </button>
    </form>
  );
}
