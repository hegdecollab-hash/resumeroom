import { ArrowRight, FileText, ListChecks, MessageSquareText, ShieldCheck, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/site/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const steps = [
  {
    icon: FileText,
    title: "Add your resume",
    text: "Upload a text-based PDF. We read it on your device, and you review the text.",
  },
  {
    icon: Target,
    title: "Add a job description (optional)",
    text: "Paste one to focus on a specific role, or skip it and practice from your resume alone.",
  },
  {
    icon: MessageSquareText,
    title: "Answer questions",
    text: "Type your answers to HR/behavioral and technical questions grounded in your own work.",
  },
  {
    icon: TrendingUp,
    title: "Review feedback",
    text: "Get scores, specific feedback, example answers and follow-up probes, then a short report.",
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

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <Reveal>
          <Badge tone="accent">Practice questions based on your resume</Badge>
          <h1 className="text-hero mt-5 font-semibold tracking-tight text-balance">
            Interview practice built around your resume.
          </h1>
          <p className="text-ink-soft mt-5 max-w-xl">
            Turn your projects and experience into focused interview questions. Add a job description to prepare for a
            specific role.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/practice">
                Start practicing <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/practice?sample=1">Try a sample resume</Link>
            </Button>
          </div>
          <p className="text-ink-faint mt-4 flex items-center gap-2">
            <ShieldCheck aria-hidden className="text-success size-4" /> No account. Saved only in your browser.
          </p>
        </Reveal>

        {/* Product evidence: labeled synthetic preview */}
        <Reveal delay={0.1}>
          <ProductPreview />
        </Reveal>
      </section>

      {/* Problem */}
      <section aria-labelledby="problem" className="border-line border-t py-14 sm:py-20">
        <Reveal className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <h2 id="problem" className="text-heading font-semibold">
            Generic question lists don&apos;t know your work.
          </h2>
          <div className="text-ink-soft space-y-4">
            <p>
              Most interview prep is the same fifty questions for everyone. Real interviews dig into what&apos;s on your
              resume: the project you shipped, the tradeoff you made, the bug you chased.
            </p>
            <p>
              If you haven&apos;t practiced explaining your own experience out loud, that&apos;s where answers get
              vague.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Solution */}
      <section aria-labelledby="solution" className="border-line border-t py-14 sm:py-20">
        <Reveal>
          <h2 id="solution" className="text-heading font-semibold">
            Questions that quote your resume back to you.
          </h2>
          <p className="text-ink-soft mt-3 max-w-2xl">
            Every personalized question points to the line on your resume it came from, so you know why it&apos;s being
            asked.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ListChecks,
              title: "Grounded questions",
              text: "Each question cites an exact quote from your resume. Ungrounded output is rejected.",
            },
            {
              icon: MessageSquareText,
              title: "Honest feedback",
              text: "Four rubric dimensions, specific strengths and gaps, and an example answer that only uses facts you provided.",
            },
            {
              icon: TrendingUp,
              title: "Adapts as you go",
              text: "Two strong answers in a row raise the difficulty; two weak ones lower it. Follow-up probes go deeper.",
            },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <Card className="h-full">
                <f.icon aria-hidden className="text-accent size-5" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="text-ink-soft mt-2">{f.text}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="border-line border-t py-14 sm:py-20">
        <Reveal>
          <h2 id="how" className="text-heading font-semibold">
            How it works
          </h2>
        </Reveal>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.05}>
              <li className="border-line bg-surface h-full rounded-[var(--radius-card)] border p-5">
                <div className="flex items-center gap-3">
                  <span className="bg-accent-soft text-accent grid size-8 place-items-center rounded-full font-semibold">
                    {i + 1}
                  </span>
                  <s.icon aria-hidden className="text-ink-faint size-5" />
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="text-ink-soft mt-2">{s.text}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* FAQs */}
      <section aria-labelledby="faq" className="border-line border-t py-14 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
          <h2 id="faq" className="text-heading font-semibold">
            Questions, answered
          </h2>
          <div className="divide-line border-line bg-surface divide-y rounded-[var(--radius-card)] border">
            {faqs.map((f) => (
              <details key={f.q} className="group px-5">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="text-ink-faint transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="text-ink-soft pb-5">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 sm:py-20">
        <Card className="flex flex-col items-start gap-6 p-8 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-heading font-semibold">Ready when you are.</h2>
            <p className="text-ink-soft mt-2">Five questions take about fifteen minutes. No sign-up.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg">
              <Link href="/practice">Start practicing</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/practice?sample=1">Try a sample resume</Link>
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}

function ProductPreview() {
  return (
    <figure aria-label="Synthetic product preview" className="relative">
      <Card className="shadow-lift space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge>Synthetic preview · sample data</Badge>
          <span className="text-ink-faint">Question 2 of 10</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">Technical</Badge>
          <Badge>Medium</Badge>
        </div>
        <p className="font-semibold">
          You reduced API response time with PostgreSQL indexes and pagination. How did you decide which indexes to add?
        </p>
        <blockquote className="border-accent/40 text-ink-soft border-l-2 pl-3">
          “Reduced API response time for the reports endpoint by adding PostgreSQL indexes and query pagination.”
        </blockquote>
        <div className="border-line bg-muted rounded-[var(--radius-control)] border p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Practice score</span>
            <span className="text-accent font-semibold">7.5 / 10</span>
          </div>
          <dl className="text-ink-soft mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {[
              ["Relevance", 4],
              ["Soundness", 4],
              ["Depth", 3],
              ["Clarity", 4],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt>{k}</dt>
                <dd className="text-ink font-semibold">{v}/5</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>
      <figcaption className="text-ink-faint mt-3 text-center">Illustrative example with a fictional resume.</figcaption>
    </figure>
  );
}
