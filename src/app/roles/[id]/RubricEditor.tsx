"use client";

import { useState, useTransition } from "react";
import { saveRubric } from "@/app/actions";
import type { Criterion, Rubric } from "@/lib/scoring";

export function RubricEditor({ roleId, initial }: { roleId: string; initial: Rubric }) {
  const [rubric, setRubric] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<Criterion>) => {
    setSaved(false);
    setRubric((r) => ({ ...r, criteria: r.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  };
  const remove = (i: number) => setRubric((r) => ({ ...r, criteria: r.criteria.filter((_, j) => j !== i) }));
  const add = () =>
    setRubric((r) => ({
      ...r,
      criteria: [
        ...r.criteria,
        { id: `c${Date.now()}`, name: "", description: "", kind: "nice_to_have", weight: 3 },
      ],
    }));

  const submit = (lock: boolean) =>
    start(async () => {
      const res = await saveRubric(roleId, rubric, lock);
      setError(res.error);
      setSaved(!res.error && !lock);
    });

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Review the scoring rubric</h2>
        <p className="text-sm text-slate-600">
          Claude drafted these from the job description. Edit, add or remove criteria, then lock the rubric.
          Every CV for this role is scored against the locked version, so all candidates are judged the same way.
        </p>
      </div>

      <div>
        <label htmlFor="experience_level" className="label">Experience level</label>
        <input
          id="experience_level"
          className="input"
          value={rubric.experience_level}
          onChange={(e) => setRubric({ ...rubric, experience_level: e.target.value })}
        />
      </div>

      <div className="space-y-3">
        {rubric.criteria.map((c, i) => (
          <div key={c.id} className="rounded-md border border-slate-200 p-3">
            <div className="flex flex-wrap gap-2">
              <input
                aria-label="Criterion name"
                className="input min-w-0 flex-1 font-medium"
                value={c.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <select
                aria-label="Type"
                className="input w-auto"
                value={c.kind}
                onChange={(e) => update(i, { kind: e.target.value as Criterion["kind"] })}
              >
                <option value="must_have">Must-have</option>
                <option value="nice_to_have">Nice-to-have</option>
              </select>
              <select
                aria-label="Weight"
                className="input w-auto"
                value={c.weight}
                onChange={(e) => update(i, { weight: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w} value={w}>Weight {w}</option>
                ))}
              </select>
              <button type="button" className="btn-secondary px-3" onClick={() => remove(i)} aria-label="Remove criterion">
                Remove
              </button>
            </div>
            <textarea
              aria-label="What evidence satisfies this"
              className="input mt-2"
              rows={2}
              value={c.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />
          </div>
        ))}
      </div>

      <button type="button" className="btn-secondary" onClick={add}>Add criterion</button>

      {error && <p className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <button className="btn-secondary" disabled={pending} onClick={() => submit(false)}>Save draft</button>
        <button className="btn-primary" disabled={pending} onClick={() => submit(true)}>
          Lock rubric and start screening
        </button>
        {saved && <span className="text-sm text-slate-500">Saved</span>}
      </div>
    </section>
  );
}
