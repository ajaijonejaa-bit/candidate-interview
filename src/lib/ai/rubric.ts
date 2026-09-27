import "server-only";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { claude, SCREENING_MODEL } from "./claude";
import type { Rubric } from "@/lib/scoring";

const RubricSchema = z.object({
  experience_level: z.string().describe("e.g. 'Mid-level, 3-6 years'"),
  summary: z.string().describe("Two sentences on what this role needs most."),
  criteria: z.array(
    z.object({
      name: z.string(),
      description: z.string().describe("What evidence in a CV satisfies this criterion."),
      kind: z.enum(["must_have", "nice_to_have"]),
      weight: z.number().describe("Integer 1-5; 5 = critical to the role."),
    }),
  ),
});

const SYSTEM = `You help a recruiter in India turn a job description into a fair, job-related scoring rubric for CV screening.

Write 6 to 10 criteria. Each must be something a CV can show evidence for: skills, tools, domain knowledge, kind and length of experience, relevant qualifications or certifications.
Mark a criterion "must_have" only if the job description makes it essential; everything else is "nice_to_have". Keep must-haves to at most four.

Never include criteria about age, gender, marital status, religion, caste, region or state of origin, native language, photos, appearance, health, or the prestige of a college or employer. Where the job description asks for any of these, leave it out.`;

export async function generateRubric(title: string, jd: string): Promise<Rubric> {
  const response = await claude.messages.parse({
    model: SCREENING_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "medium", format: zodOutputFormat(RubricSchema) },
    messages: [
      {
        role: "user",
        content: `Job title: ${title}\n\n<job_description>\n${jd}\n</job_description>`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Claude could not produce a rubric for this job description.");
  }

  return {
    ...response.parsed_output,
    criteria: response.parsed_output.criteria.map((c, i) => ({
      ...c,
      id: `c${i + 1}`,
      weight: Math.min(5, Math.max(1, Math.round(c.weight))),
    })),
  };
}
