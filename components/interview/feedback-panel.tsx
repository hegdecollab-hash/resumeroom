"use client";

import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { Attempt } from "@/lib/interview/types";
import { cn } from "@/lib/utils";

const DIM_LABELS = {
  relevance: "Relevance",
  accuracyOrSoundness: "Accuracy / soundness",
  depth: "Depth",
  clarity: "Clarity",
} as const;

export function scoreTone(score: number) {
  if (score >= 8) return "text-success";
  if (score >= 5) return "text-accent";
  return "text-warn";
}

export function FeedbackPanel({ attempt, onRevealExample }: { attempt: Attempt; onRevealExample: () => void }) {
  const reduce = useReducedMotion();
  const ev = attempt.evaluation;
  if (!ev) return null;
  return (
    <motion.section
      aria-labelledby={`fb-${attempt.id}`}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="border-line bg-surface shadow-soft space-y-5 rounded-[var(--radius-card)] border p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id={`fb-${attempt.id}`} className="font-semibold">
            Feedback · attempt {attempt.attemptIndex + 1}
            {attempt.wasAssisted ? <span className="text-ink-faint font-normal"> (assisted)</span> : null}
          </h3>
          <p className="text-ink-faint">AI practice estimate, not a hiring decision.</p>
        </div>
        <p className={cn("text-heading font-semibold", scoreTone(ev.score))}>
          {ev.score}
          <span className="text-body text-ink-faint"> / 10</span>
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(DIM_LABELS) as (keyof typeof DIM_LABELS)[]).map((k) => (
          <div key={k}>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{DIM_LABELS[k]}</dt>
              <dd className="font-semibold">{ev.dimensions[k]}/5</dd>
            </div>
            <div className="bg-muted mt-1 h-1.5 rounded-full" aria-hidden>
              <div className="bg-accent h-full rounded-full" style={{ width: `${(ev.dimensions[k] / 5) * 100}%` }} />
            </div>
          </div>
        ))}
      </dl>

      <p className="text-ink-soft">{ev.conciseExplanation}</p>

      <div className="grid gap-5 md:grid-cols-2">
        <List title="Strengths" items={ev.strengths} empty="No clear strengths identified yet." />
        <List title="Improve" items={ev.improvements} empty="Nothing major to improve." />
      </div>
      {ev.missingConcepts.length ? <List title="Missing concepts" items={ev.missingConcepts} /> : null}
      {ev.uncertaintyNote ? (
        <p className="bg-warn-soft text-ink-soft rounded-[var(--radius-control)] p-3">{ev.uncertaintyNote}</p>
      ) : null}

      <details
        className="group border-line rounded-[var(--radius-control)] border"
        onToggle={(e) => {
          if ((e.currentTarget as HTMLDetailsElement).open) onRevealExample();
        }}
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
          {ev.exampleAnswerType === "behavioral_structure" ? "Example structure" : "Example answer"}
          <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-line space-y-2 border-t p-4">
          <p className="text-ink-soft whitespace-pre-wrap">{ev.exampleAnswer}</p>
          <p className="text-ink-faint">
            Uses only facts from your resume and answer. Replace any [placeholders] with your real details. Viewing this
            marks later attempts on this question as assisted.
          </p>
        </div>
      </details>
    </motion.section>
  );
}

function List({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  return (
    <div>
      <h4 className="font-semibold">{title}</h4>
      {items.length ? (
        <ul className="text-ink-soft mt-2 list-disc space-y-1.5 pl-5">
          {items.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-faint mt-2">{empty}</p>
      )}
    </div>
  );
}
