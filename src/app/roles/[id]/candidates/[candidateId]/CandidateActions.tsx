"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCandidate, scoreCandidate, setShortlisted } from "@/app/actions";

export function CandidateActions({
  candidateId,
  roleId,
  shortlisted,
}: {
  candidateId: string;
  roleId: string;
  shortlisted: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card space-y-3">
      <button
        className={shortlisted ? "btn-secondary w-full" : "btn-primary w-full"}
        disabled={pending}
        onClick={() => start(() => setShortlisted(candidateId, roleId, !shortlisted))}
      >
        {shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      </button>
      <button
        className="btn-secondary w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await scoreCandidate(candidateId);
            setError(res.error);
            router.refresh();
          })
        }
      >
        {pending ? "Working…" : "Re-score CV"}
      </button>
      {confirmDelete ? (
        <div className="space-y-2 text-sm">
          <p>Delete this CV and its scores permanently?</p>
          <div className="flex gap-2">
            <button className="btn-primary flex-1 bg-rose-700 hover:bg-rose-800" disabled={pending} onClick={() => start(() => deleteCandidate(candidateId, roleId))}>
              Delete
            </button>
            <button className="btn-secondary flex-1" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="w-full text-sm text-rose-700 hover:underline" onClick={() => setConfirmDelete(true)}>
          Delete candidate
        </button>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
