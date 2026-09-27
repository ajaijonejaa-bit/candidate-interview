import { RECOMMENDATION_LABEL, type Recommendation } from "@/lib/scoring";

const TONE: Record<Recommendation, string> = {
  strong_fit: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  possible_fit: "bg-amber-50 text-amber-800 ring-amber-200",
  not_a_fit: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function RecommendationBadge({ value }: { value: Recommendation | null }) {
  if (!value) return <span className="text-sm text-slate-400">Not scored</span>;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${TONE[value]}`}>
      {RECOMMENDATION_LABEL[value]}
    </span>
  );
}
