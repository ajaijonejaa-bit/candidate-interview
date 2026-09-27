import "server-only";
import mammoth from "mammoth";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { claude, SCREENING_MODEL } from "./claude";
import type { CriterionScore, Rubric } from "@/lib/scoring";

// ---------------------------------------------------------------------------
// Step 1: read the CV and split it into contact details and an anonymised profile.
// The scorer in step 2 never sees the original CV, only the anonymised profile.
// ---------------------------------------------------------------------------

const ExtractSchema = z.object({
  contact: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
  }),
  profile: z.object({
    headline: z.string().describe("One line, e.g. 'Backend engineer, 5 years, Java and AWS'."),
    total_experience_years: z.number(),
    skills: z.array(z.string()),
    experience: z.array(
      z.object({
        role_title: z.string(),
        employer_type: z.string().describe("Industry and size only, never the employer's name."),
        duration_months: z.number(),
        responsibilities: z.array(z.string()),
        achievements: z.array(z.string()),
      }),
    ),
    education: z.array(
      z.object({
        qualification: z.string().describe("Degree or diploma and field, never the institution."),
        year_completed: z.string(),
      }),
    ),
    certifications: z.array(z.string()),
    languages_for_work: z.array(z.string()),
    other_relevant: z.array(z.string()),
  }),
});

export type CvExtract = z.infer<typeof ExtractSchema>;

const EXTRACT_SYSTEM = `You read CVs from job applicants in India for a recruiter.

Return two separate parts:
1. "contact": name, email, phone and city exactly as written. Use an empty string when missing.
2. "profile": an anonymised, job-relevant summary of the CV.

The profile must not contain, or hint at, the candidate's name, gender or pronouns, age or date of birth, marital status, number of children, religion, caste or community, father's or spouse's name, photo, home address, state or region of origin, nationality, health or disability, or the names of colleges, schools or employers. Write "they" if you need a pronoun.
Record only what the CV states. Do not guess or fill gaps.`;

export async function extractCv(file: Blob, filename: string): Promise<CvExtract> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const isPdf = filename.toLowerCase().endsWith(".pdf");

  let cvBlock: Anthropic.ContentBlockParam;
  if (isPdf) {
    cvBlock = {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") },
    };
  } else {
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    if (!value.trim()) throw new Error("The Word file has no readable text.");
    cvBlock = { type: "text", text: `<cv>\n${value}\n</cv>` };
  }

  const response = await claude.messages.parse({
    model: SCREENING_MODEL,
    max_tokens: 16000,
    system: EXTRACT_SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(ExtractSchema) },
    messages: [{ role: "user", content: [cvBlock, { type: "text", text: "Extract this CV." }] }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Claude could not read this CV.");
  }
  return response.parsed_output;
}

// ---------------------------------------------------------------------------
// Step 2: score the anonymised profile against the locked rubric.
// ---------------------------------------------------------------------------

const ScoreSchema = z.object({
  scores: z.array(
    z.object({
      criterion_id: z.string(),
      score: z.number().describe("Integer 0-5."),
      evidence: z.string().describe("Short quote or paraphrase from the profile. Empty if none."),
      reasoning: z.string().describe("One sentence explaining the score."),
    }),
  ),
  summary: z.string().describe("Three sentences: main strengths, main gaps, overall fit."),
});

const SCORE_SYSTEM = `You score an anonymised candidate profile against a job rubric for a recruiter.

Score every criterion from 0 to 5:
0 = no evidence, 1 = weak or indirect evidence, 2 = some evidence but below what the role needs, 3 = meets the need, 4 = clearly strong, 5 = exceptional.

Base every score only on evidence in the profile, and quote or paraphrase that evidence. Missing information scores low; do not assume skills the profile does not show.
Judge only job-related evidence. Employment gaps, career breaks and non-linear careers are not negatives on their own.
The recruiter makes the decision. Your job is a clear, evidence-backed assessment.`;

export async function scoreProfile(
  rubric: Rubric,
  profile: CvExtract["profile"],
): Promise<{ scores: CriterionScore[]; summary: string }> {
  const rubricText = rubric.criteria
    .map((c) => `- ${c.id} [${c.kind}, weight ${c.weight}] ${c.name}: ${c.description}`)
    .join("\n");

  const response = await claude.messages.parse({
    model: SCREENING_MODEL,
    max_tokens: 16000,
    system: SCORE_SYSTEM,
    output_config: { effort: "medium", format: zodOutputFormat(ScoreSchema) },
    messages: [
      {
        role: "user",
        content: `<rubric experience_level="${rubric.experience_level}">\n${rubricText}\n</rubric>\n\n<candidate_profile>\n${JSON.stringify(profile, null, 2)}\n</candidate_profile>\n\nScore every criterion id in the rubric.`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Claude could not score this CV.");
  }
  return response.parsed_output;
}
