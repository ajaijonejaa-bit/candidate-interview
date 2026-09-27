// Pure scoring maths, kept separate from the AI calls so it is predictable and testable.

export type CriterionKind = "must_have" | "nice_to_have";

export interface Criterion {
  id: string;
  name: string;
  description: string;
  kind: CriterionKind;
  /** 1 (minor) to 5 (critical). */
  weight: number;
}

export interface Rubric {
  experience_level: string;
  summary: string;
  criteria: Criterion[];
}

export interface CriterionScore {
  criterion_id: string;
  /** 0 = no evidence, 5 = clearly exceeds. */
  score: number;
  evidence: string;
  reasoning: string;
}

export type Recommendation = "strong_fit" | "possible_fit" | "not_a_fit";

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  strong_fit: "Strong fit",
  possible_fit: "Possible fit",
  not_a_fit: "Not a fit",
};

/** A must-have scoring at or below this counts as missing. */
export const MUST_HAVE_MIN = 2;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function computeFit(rubric: Rubric, scores: CriterionScore[]) {
  const byId = new Map(scores.map((s) => [s.criterion_id, s]));
  let earned = 0;
  let possible = 0;
  const missingMustHaves: string[] = [];

  for (const c of rubric.criteria) {
    const weight = clamp(Math.round(c.weight), 1, 5);
    const score = clamp(Math.round(byId.get(c.id)?.score ?? 0), 0, 5);
    earned += score * weight;
    possible += 5 * weight;
    if (c.kind === "must_have" && score < MUST_HAVE_MIN) missingMustHaves.push(c.name);
  }

  const fitScore = possible === 0 ? 0 : Math.round((earned / possible) * 1000) / 10;

  let recommendation: Recommendation;
  if (missingMustHaves.length > 0 || fitScore < 50) recommendation = "not_a_fit";
  else if (fitScore >= 75) recommendation = "strong_fit";
  else recommendation = "possible_fit";

  return { fitScore, missingMustHaves, recommendation };
}
