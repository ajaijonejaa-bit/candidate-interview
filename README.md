# Candidate Interview

AI-assisted hiring tool. A recruiter posts a job description, uploads CVs, and gets a ranked, evidence-backed shortlist. Later phases add a written assessment, recorded video interviews and a final report.

**Phase 1 (this version):** recruiter login, roles from a job description, an AI-drafted scoring rubric the recruiter edits and locks, bulk CV upload (PDF/Word), anonymised AI scoring, a ranked shortlist, and automatic deletion of CVs 180 days after a role closes.

## How screening works

1. **Rubric.** Claude (`claude-sonnet-5`) turns the job description into 6–10 job-related criteria, each marked must-have or nice-to-have with a weight from 1 to 5. It is told never to include age, gender, marital status, religion, caste, region, appearance or college/employer prestige. You edit the rubric and lock it, so every CV for the role is judged the same way.
2. **Read and anonymise.** Claude reads each CV and splits it into contact details and an anonymised profile with no name, gender, age, religion, caste, family details, photo, address, or college and employer names.
3. **Score.** A separate Claude call scores only the anonymised profile against the rubric, 0–5 per criterion, quoting its evidence.
4. **Rank.** The app (not the AI) computes a weighted 0–100 fit score. A must-have scoring below 2 marks the candidate "Not a fit". Otherwise 75+ is "Strong fit" and 50–74 is "Possible fit". The maths is in `src/lib/scoring.ts`.
5. **Decide.** You shortlist. The AI only recommends. Every upload, score, shortlist change and deletion goes into `audit_log`.

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com) in the **Mumbai (ap-south-1)** region, so candidate data stays in India.
2. Open **SQL Editor**, paste in `supabase/migrations/0001_phase1.sql` and run it. This creates the tables, the recruiter-only access rules and the private `cvs` storage bucket.
3. Go to **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**.
4. Go to **Authentication → Users → Add user**, and create your recruiter account with an email and password.
5. Copy the project URL, the anon key and the service role key from **Project Settings → API**.

### 2. Anthropic
Create an API key at [console.anthropic.com](https://console.anthropic.com).

### 3. Run locally
```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev                  # http://localhost:3000
```

### 4. Deploy to Vercel
1. Import this GitHub repository at [vercel.com/new](https://vercel.com/new).
2. Add every variable from `.env.example` under **Settings → Environment Variables**. For `CRON_SECRET`, use a long random string.
3. Deploy. `vercel.json` schedules the data-deletion job daily at 02:00 IST.

## Environment variables

| Name | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. Server only, used by the deletion job. |
| `ANTHROPIC_API_KEY` | Anthropic Console |
| `RECRUITER_EMAILS` | Your login email. Only these emails can use the app. |
| `CRON_SECRET` | Any long random string |
| `RETENTION_DAYS` | Defaults to 180 |

## Privacy and fairness notes (India)
- The Digital Personal Data Protection Act, 2023 applies. Tell applicants their CV will be screened with AI assistance, for example in the job advert, and delete their data on request. The **Delete candidate** button removes the CV file and all scores.
- Data is stored in the Mumbai region. CVs are sent to the Anthropic API for scoring.
- Check the rubric for criteria that could indirectly exclude groups before you lock it.

## Scripts
- `npm run dev`: local development
- `npm run build`: production build
- `npm test`: scoring unit tests
- `npm run lint`: ESLint

## Roadmap
- **Phase 2:** candidate invite links and consent, written assessment (aptitude bank, role understanding, JD-specific technical questions you approve).
- **Phase 3:** recorded video answers, transcription, evidence-based answer scoring.
- **Phase 4:** combined candidate report and decision log.
