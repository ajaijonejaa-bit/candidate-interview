"use client";

import { useState, useTransition } from "react";
import { closeRole } from "@/app/actions";

export function CloseRoleButton({ roleId }: { roleId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return <button className="btn-secondary" onClick={() => setConfirming(true)}>Close role</button>;
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-600">Close this role? CVs are deleted 180 days later.</span>
      <button className="btn-primary" disabled={pending} onClick={() => start(() => closeRole(roleId))}>
        Close
      </button>
      <button className="btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
    </div>
  );
}
