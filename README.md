# ResumeRoom

Interview practice built around your resume. Upload a resume PDF (read locally in the browser), review the text,
optionally paste a job description, then practice AI-generated questions grounded in your own resume with scores,
feedback, example answers, follow-up probes, adaptive difficulty and a report.

Simple MVP: **no database, no auth, no accounts.** All user data lives in the browser. The only server code is a
stateless OpenRouter proxy (`app/api/interview/*`).

## Stack

Next.js 16 (App Router, Turbopack, strict TypeScript) · React 19 · Tailwind CSS 4 · self-hosted next/font type (Fraunces display serif, Instrument Sans body, JetBrains Mono labels) · shadcn-style primitives on Radix ·
Formik + Yup · Motion · react-hot-toast · PDF.js (`pdfjs-dist`, self-hosted worker) · Vitest · Playwright (scripts only).
All versions are pinned in `package.json`; the lockfile is committed.

## Setup

Requires **Node.js 22.13+** (Node 24 LTS recommended, see `.nvmrc`; `pdfjs-dist` 6 needs ≥ 22.13).

```bash
npm install              # also copies the PDF.js worker into public/
cp .env.example .env.local
# fill OPENROUTER_API_KEY, OPENROUTER_MODEL, NEXT_PUBLIC_APP_URL
npm run dev              # http://localhost:3000
```

| Command                                                    | Purpose                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `npm run format` / `format:check`                          | Prettier                                                            |
| `npm run lint`                                             | ESLint (flat config)                                                |
| `npm run typecheck`                                        | `next typegen && tsc --noEmit`                                      |
| `npm test`                                                 | Vitest unit + route tests (provider mocked)                         |
| `npm run build` / `start`                                  | Production build / server                                           |
| `node scripts/integration-check.mjs [url] [resume.txt]`    | Live generate + evaluate against a running server (real paid calls) |
| `node scripts/screenshots.mjs [url] [outDir] [resume.pdf]` | Headless walkthrough + screenshots (real paid calls)                |

## Environment

| Variable                                                       | Notes                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `OPENROUTER_API_KEY`                                           | Server-only. Never `NEXT_PUBLIC_`. Never committed, never sent to the browser. |
| `OPENROUTER_MODEL`                                             | Must support `response_format: json_schema` (structured outputs).              |
| `NEXT_PUBLIC_APP_URL`                                          | Absolute URL for metadata/OG/sitemap and the same-origin check.                |
| `NEXT_PUBLIC_APP_NAME`                                         | Optional; defaults to `ResumeRoom`.                                            |
| `RATE_LIMIT_GENERATE_PER_HOUR`, `RATE_LIMIT_EVALUATE_PER_HOUR` | Optional; defaults 5 and 30 per IP.                                            |

### Model compatibility

Verified with `openai/gpt-4o-mini` (listed at `https://openrouter.ai/api/v1/models` with `structured_outputs` and
`response_format` in `supported_parameters`). Requests send separate system/user messages, `response_format`
`json_schema` with `strict: true`, and `provider.require_parameters: true`, so OpenRouter routes only to endpoints that
support those parameters. Every response is still validated server-side (`lib/interview/validation.ts`), evidence
quotes are checked against the submitted text, and invalid generations get one bounded repair call before failing
honestly. The app never switches models automatically. To change model, check the list above for structured-output
support and run `scripts/integration-check.mjs`.

## Deployment (Vercel)

Import the repo, set the env vars above, deploy. Route handlers use the Node.js runtime with `maxDuration = 60`.
**Set a spend/credit limit on the OpenRouter key**: that is the real protection for a public launch.

## Privacy: what is stored and what is sent

- **PDF:** read on the device with PDF.js; never uploaded, never stored. Buffers and the PDF.js document are destroyed after extraction.
- **Stored in this browser (localStorage, `resumeroom:*` keys):** reviewed resume text, optional JD, preferences,
  profile summary, questions, answers/drafts, evaluations, adaptations, reports, and a practice-form draft. Nothing
  else. Clearing site data, switching browsers/devices or private mode loses it; there is no recovery. Users can
  delete a session or all data (removal is verified), download a text report, and turn off saving (memory only).
- **Sent to the server:** only when generating questions, checking an answer, or requesting a follow-up/adapted question:
  the reviewed resume text (contact details removed by default, best effort), optional JD, and answer text, to this
  app's own `/api/interview/*` routes, which forward them to **OpenRouter and the selected model provider**.
- **Server:** stores nothing (no DB, files or cookies). Logs contain only request ID, operation, duration, status,
  model and token counts. No user text, credentials or contact details. API responses are `Cache-Control: no-store`.
- **Provider retention** is outside the app's control. Operators should review OpenRouter's privacy settings
  (Settings → Privacy: disable prompt logging / training, consider zero-data-retention endpoints) and the chosen
  provider's policy.

## Abuse protection and its limits

Same-origin (Origin/Referer vs Host/`NEXT_PUBLIC_APP_URL`) check, JSON body byte caps matching the input limits,
strict schema validation, client-side single-flight requests plus a per-instance request-ID de-duplication, and a
**best-effort in-memory per-IP limiter**. The limiter is not durable: it resets on restart and is per serverless
instance, so it is not a guarantee. Use an OpenRouter credit limit.

## Structure

```
app/                 routes, layout, metadata, API route handlers
components/ui/       primitives (button, card, badge, dialog, switch, segmented…)
components/interview upload, practice form, session workspace, feedback, report, saved sessions
components/site/     header, footer, toaster, motion reveal
lib/ai/              server-only OpenRouter helper, prompts, JSON schemas, orchestration
lib/interview/       shared types, validation, grounding, scoring, adaptation, redaction, sample fixture
lib/pdf/             client-only PDF.js extraction and layout reconstruction
lib/storage/         typed browser storage wrapper
lib/security/        origin check, body caps, limiter, response helpers
__tests__/           Vitest tests
```

## Scoring and adaptation

Overall score = sum of four 0-5 dimensions / 2 (0-10), computed in the evaluate route; model or client totals are
never accepted. Adaptation is deterministic client code: the latest two unassisted first attempts on base questions
(skips, probes and retries excluded): both ≥ 8 → up one level; both < 5 → down one; clamped. Only the next
unanswered base question is regenerated, at most once per transition. Report numbers are computed on the client.

Scores are AI practice estimates, not hiring decisions. The app does not predict any employer's questions.
