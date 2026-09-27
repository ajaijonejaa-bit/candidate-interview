import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFit, type Rubric } from "./scoring.ts";

const rubric: Rubric = {
  experience_level: "Mid-level",
  summary: "",
  criteria: [
    { id: "c1", name: "Java", description: "", kind: "must_have", weight: 5 },
    { id: "c2", name: "AWS", description: "", kind: "nice_to_have", weight: 3 },
  ],
};
const s = (criterion_id: string, score: number) => ({ criterion_id, score, evidence: "", reasoning: "" });

test("weights scores out of 100", () => {
  const r = computeFit(rubric, [s("c1", 5), s("c2", 5)]);
  assert.equal(r.fitScore, 100);
  assert.equal(r.recommendation, "strong_fit");
});

test("missing must-have means not a fit, whatever the total", () => {
  const r = computeFit(rubric, [s("c1", 1), s("c2", 5)]);
  assert.deepEqual(r.missingMustHaves, ["Java"]);
  assert.equal(r.recommendation, "not_a_fit");
});

test("unscored criteria count as zero and out-of-range scores are clamped", () => {
  const r = computeFit(rubric, [s("c1", 9)]);
  assert.equal(r.fitScore, 62.5);
  assert.equal(r.recommendation, "possible_fit");
});
