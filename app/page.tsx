import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";

const steps = [
  {
    title: "Add your resume",
    text: "Upload a text-based PDF. It's read on your device, and you review the text before anything is sent.",
  },
  {
    title: "Add a job description, if you have one",
    text: "Optional. Without it, practice comes from your resume alone. With it, skills only the job asks for are marked as gaps.",
  },
  {
    title: "Answer, in writing",
    text: "HR/behavioral and technical questions, one at a time, each pointing at the line of your resume it came from.",
  },
  {
    title: "Read the feedback, then go deeper",
    text: "Four rubric scores, specific strengths and gaps, an example answer built only from your facts, and follow-up probes.",
  },
];

const faqs = [
  {
    q: "Do I need a job description?",
    a: "No. A job description is optional. Without one, questions come from your resume alone. With one, some questions focus on that role, and skills only the job asks for are marked as gaps rather than treated as your experience.",
  },
  {
    q: "What about scanned PDFs?",
    a: "Scanned or image-only PDFs have no readable text, and OCR is not supported. Upload a text-based PDF or paste your resume text instead.",
  },
  {
    q: "Is my PDF uploaded?",
    a: "No. Your PDF is read on this device with PDF.js. The file itself is never uploaded or stored. You review and can edit the extracted text before anything is sent.",
  },
  {
    q: "What is stored in my browser?",
    a: "Your reviewed resume text, optional job description, preferences, questions, answers, feedback and reports are saved only in this browser. Clearing site data, switching browsers or private mode loses them. There is no account and no cross-device recovery. You can delete one session or all data at any time.",
  },
  {
    q: "What text is sent to AI providers?",
    a: "When you generate questions or check an answer, the reviewed resume text, optional job description and your answer are sent through this app's server route to OpenRouter and the selected model provider. Our server does not store them, but the provider's retention is outside our control. Obvious contact details are removed by default (best effort).",
  },
  {
    q: "How reliable is the feedback?",
    a: "Scores are AI practice estimates, not hiring decisions or validated aptitude measurements. The AI cannot verify your achievements, and we don't predict any employer's exact questions. Use feedback as a guide for practice.",
  },
];

const Eyebrow = ({ n, children }: { n: string; children: React.ReactNode }) => (
  <p className="text-label text-ink-faint flex items-center gap-3 font-mono tracking-[0.14em] uppercase">
    <span className="text-accent">{n}</span>
    <span aria-hidden className="bg-line-strong h-px w-8" />
    {children}
  </p>
);

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero: asymmetric, left-set display type */}
      <section className="grid gap-12 pt-12 pb-16 sm:pt-20 lg:grid-cols-12 lg:gap-8 lg:pb-24">
        <Reveal className="lg:col-span-7">
          <Eyebrow n="§">Practice questions based on your resume</Eyebrow>
          <h1 className="text-hero mt-6 font-normal text-balance">
            Interview practice built around <em className="text-accent">your</em> resume.
          </h1>
          <div className="mt-8 grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end lg:max-w-xl lg:grid-cols-1">
            <p className="text-ink-soft max-w-md">
              Turn your projects and experience into focused interview questions. Add a job description to prepare for a
              specific role.
            </p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href="/practice">
                Start practicing <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Link
              href="/practice?sample=1"
              className="text-ink decoration-accent hover:text-accent inline-flex min-h-12 items-center gap-1.5 px-1 font-semibold underline decoration-2 underline-offset-[6px]"
            >
              Try a sample resume <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </div>
          <p className="border-line text-ink-faint mt-8 border-t pt-4">
            No account. Your resume text and sessions stay in this browser.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-5 lg:pt-10">
          <ProductPreview />
        </Reveal>
      </section>

      {/* Problem: big statement with marginal note */}
      <section aria-labelledby="problem" className="border-ink border-t py-16 sm:py-24">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <Eyebrow n="01">The problem</Eyebrow>
          </div>
          <Reveal className="lg:col-span-9">
            <h2 id="problem" className="text-heading font-normal text-balance">
              Generic question lists don&apos;t know your work. Interviewers do.
            </h2>
            <div className="text-ink-soft mt-6 grid gap-6 md:grid-cols-2">
              <p>
                Most prep is the same fifty questions for everyone. Real interviews dig into what&apos;s on your resume:
                the project you shipped, the tradeoff you made, the bug you chased for a week.
              </p>
              <p>
                If you haven&apos;t practiced explaining your own experience, that&apos;s exactly where answers go
                vague. So we start there.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Solution: editorial list with rules, not a card grid */}
      <section aria-labelledby="solution" className="border-ink border-t py-16 sm:py-24">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <Eyebrow n="02">The approach</Eyebrow>
          </div>
          <div className="lg:col-span-9">
            <h2 id="solution" className="text-heading font-normal text-balance">
              Questions that quote your resume <em>back to you.</em>
            </h2>
            <dl className="divide-line border-line mt-10 divide-y border-y">
              {[
                [
                  "Grounded, or not shown",
                  "Every personalized question cites an exact line from your resume. Output that invents evidence is rejected, not dressed up.",
                ],
                [
                  "Feedback you can act on",
                  "Four rubric dimensions, specific strengths and gaps quoting your answer, and an example answer that uses only facts you gave.",
                ],
                [
                  "Difficulty that follows you",
                  "Two strong answers in a row and the next question gets harder; two weak ones and it eases off. Probes go one level deeper.",
                ],
              ].map(([t, d]) => (
                <div key={t} className="grid gap-2 py-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8">
                  <dt className="font-display text-2xl leading-tight">{t}</dt>
                  <dd className="text-ink-soft">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* How it works: numbered steps on a rule */}
      <section aria-labelledby="how" className="border-ink border-t py-16 sm:py-24">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <Eyebrow n="03">How it works</Eyebrow>
            <h2 id="how" className="text-heading mt-4 font-normal">
              Four steps, about fifteen minutes.
            </h2>
          </div>
          <ol className="grid gap-x-8 sm:grid-cols-2 lg:col-span-9">
            {steps.map((s, i) => (
              <li key={s.title} className="border-line border-t py-6">
                <span className="font-display text-accent text-5xl leading-none italic">{i + 1}</span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="text-ink-soft mt-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQs */}
      <section aria-labelledby="faq" className="border-ink border-t py-16 sm:py-24">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <Eyebrow n="04">Questions</Eyebrow>
            <h2 id="faq" className="text-heading mt-4 font-normal">
              Before you start.
            </h2>
          </div>
          <div className="divide-line border-line divide-y border-y lg:col-span-9">
            {faqs.map((f) => (
              <details key={f.q} className="group">
                <summary className="font-display flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-xl [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span
                    aria-hidden
                    className="text-accent font-mono text-base transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="text-ink-soft max-w-2xl pb-6">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-ink border-t py-16 sm:py-24">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <h2 className="text-heading font-normal lg:col-span-7">
            Your next interview will ask about your work. <em className="text-accent">Rehearse it.</em>
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end">
            <Button asChild size="lg">
              <Link href="/practice">Start practicing</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/practice?sample=1">Try a sample resume</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProductPreview() {
  return (
    <figure aria-label="Synthetic product preview" className="relative">
      <div className="border-ink/15 bg-surface shadow-lift rotate-[0.6deg] rounded-[var(--radius-card)] border p-6 sm:p-7">
        <div className="text-label text-ink-faint flex items-center justify-between font-mono tracking-wide uppercase">
          <span>Q 02 / 10 · Technical · Medium</span>
          <span className="text-accent">Sample</span>
        </div>
        <p className="font-display mt-5 text-2xl leading-snug">
          “How did you decide which PostgreSQL indexes to add, and how did you verify the improvement?”
        </p>
        <blockquote className="border-accent text-ink-soft mt-5 border-l-2 pl-4 italic">
          From the resume: Reduced API response time for the reports endpoint by adding PostgreSQL indexes and query
          pagination.
        </blockquote>
        <div className="border-line-strong mt-6 flex items-end justify-between border-t border-dashed pt-5">
          <dl className="text-label text-ink-soft grid grid-cols-2 gap-x-6 gap-y-1 font-mono uppercase">
            {[
              ["Relevance", 4],
              ["Soundness", 4],
              ["Depth", 3],
              ["Clarity", 4],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt>{k}</dt>
                <dd className="text-ink">{v}/5</dd>
              </div>
            ))}
          </dl>
          <p className="text-right">
            <span className="font-display text-pine block text-5xl leading-none">7.5</span>
            <span className="text-label text-ink-faint font-mono uppercase">of 10</span>
          </p>
        </div>
      </div>
      <figcaption className="text-label text-ink-faint mt-4 font-mono tracking-wide uppercase">
        Illustration · fictional resume, sample data
      </figcaption>
    </figure>
  );
}
