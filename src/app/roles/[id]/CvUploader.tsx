"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerCandidate, scoreCandidate } from "@/app/actions";

type Row = { name: string; state: "uploading" | "scoring" | "done" | "failed"; error?: string };

const ACCEPTED = [".pdf", ".docx"];
const MAX_BYTES = 10 * 1024 * 1024;
const PARALLEL = 3;

export function CvUploader({ roleId, ownerId }: { roleId: string; ownerId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  async function handle(files: File[]) {
    if (!files.length) return;
    const supabase = createClient();
    const offset = rows.length;
    setRows((r) => [...r, ...files.map((f) => ({ name: f.name, state: "uploading" as const }))]);
    setBusy(true);

    async function processOne(file: File, i: number) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPTED.includes(ext)) return setRow(i, { state: "failed", error: "Only PDF or Word (.docx) files" });
      if (file.size > MAX_BYTES) return setRow(i, { state: "failed", error: "File is over 10 MB" });

      const path = `${ownerId}/${roleId}/${crypto.randomUUID()}${ext}`;
      const { error: upErr } = await supabase.storage.from("cvs").upload(path, file, { contentType: file.type });
      if (upErr) return setRow(i, { state: "failed", error: upErr.message });

      const reg = await registerCandidate(roleId, path, file.name);
      if (!reg.id) return setRow(i, { state: "failed", error: reg.error ?? "Could not save" });

      setRow(i, { state: "scoring" });
      const res = await scoreCandidate(reg.id);
      setRow(i, res.error ? { state: "failed", error: res.error } : { state: "done" });
      router.refresh();
    }

    const queue = files.map((f, k) => [f, offset + k] as const);
    await Promise.all(
      Array.from({ length: PARALLEL }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) await processOne(...next);
      }),
    );
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="card">
      <h2 className="mb-1 font-semibold">Upload CVs</h2>
      <p className="mb-3 text-sm text-slate-600">PDF or Word, up to 10 MB each. You can select many at once.</p>
      <div
        className="rounded-md border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-600"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handle(Array.from(e.dataTransfer.files));
        }}
      >
        Drop CVs here or{" "}
        <button type="button" className="font-medium text-brand hover:underline" onClick={() => input.current?.click()}>
          choose files
        </button>
        <input
          ref={input}
          id="cv-files"
          type="file"
          multiple
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => {
            handle(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {rows.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">{r.name}</span>
              <span
                className={
                  r.state === "failed" ? "text-rose-700" : r.state === "done" ? "text-emerald-700" : "text-slate-500"
                }
                title={r.error}
              >
                {r.state === "uploading" && "Uploading…"}
                {r.state === "scoring" && "Scoring…"}
                {r.state === "done" && "Scored"}
                {r.state === "failed" && (r.error ?? "Failed")}
              </span>
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="mt-2 text-xs text-slate-500">Keep this page open until every CV is scored.</p>}
    </section>
  );
}
