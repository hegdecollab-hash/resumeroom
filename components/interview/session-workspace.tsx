"use client";

import { Check, ChevronDown, CornerDownRight, Loader2, SkipForward } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/lib/config";
import { ClientApiError, newRequestId, postJson } from "@/lib/interview/client";
import {
  attemptsFor,
  decideDifficulty,
  isBase,
  isSettled,
  orderedQuestions,
  probeCount,
  rootOf,
} from "@/lib/interview/scoring";
import { toQuestion } from "@/lib/interview/session";
import { excerpt } from "@/lib/interview/text";
import type {
  Attempt,
  Category,
  Difficulty,
  EvaluateRequest,
  EvaluateResponse,
  NextRequest,
  NextResponse,
  Question,
  Session,
} from "@/lib/interview/types";
import { cn } from "@/lib/utils";
import { FeedbackPanel } from "./feedback-panel";
import { SessionMissing } from "./session-missing";
import { useSession } from "./use-session";

const CATEGORY_LABEL: Record<Category, string> = {
  behavioral: "HR & behavioral",
  technical: "Technical",
  project: "Project",
};

type Busy = null | "evaluate" | "probe" | "adapt";

function draftOf(q: Question) {
  const { category, difficulty, question, resumeReference, jdReference, groundingType, whyAsked, expectedConcepts } = q;
  return { category, difficulty, question, resumeReference, jdReference, groundingType, whyAsked, expectedConcepts };
}

function currentLevel(s: Session): Difficulty {
  return s.adaptations.at(-1)?.to ?? s.preferences.difficulty;
}

export function SessionWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const { state, update } = useSession(id);
  const [busy, setBusy] = React.useState<Busy>(null);
  const [slow, setSlow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<{ category: Category | "all"; difficulty: Difficulty | "all" }>({
    category: "all",
    difficulty: "all",
  });
  const [editing, setEditing] = React.useState(false);
  const [adaptNote, setAdaptNote] = React.useState<string | null>(null);
  const [offline, setOffline] = React.useState(false);
  const inflight = React.useRef(false);
  const questionHeading = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with browser connectivity
    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const ready = state.status === "ready";
  React.useEffect(() => {
    if (!ready) return;
    // Deep link from the report's "Retry" list.
    const qid = new URLSearchParams(window.location.search).get("q");
    if (qid) {
      update((s) => (s.questions.some((q) => q.id === qid) ? { ...s, currentQuestionId: qid, status: "active" } : s));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [ready, update]);

  if (state.status === "loading")
    return (
      <div role="status" className="text-ink-soft mx-auto flex max-w-6xl items-center gap-2 px-4 py-16 sm:px-6">
        <Loader2 aria-hidden className="size-5 animate-spin" /> Loading session…
      </div>
    );
  if (state.status === "missing") return <SessionMissing />;
  if (state.status === "corrupt") return <SessionMissing corrupt />;

  const session = state.session;
  const ordered = orderedQuestions(session.questions);
  const current = ordered.find((q) => q.id === session.currentQuestionId) ?? ordered[0];
  const attempts = current ? attemptsFor(session, current.id) : [];
  const latest = attempts.at(-1);
  const settled = current ? isSettled(session, current.id) : false;
  const showEditor = current && (!settled || editing);
  const draft = current ? (session.drafts[current.id] ?? "") : "";
  const baseQuestions = session.questions.filter(isBase);
  const settledBase = baseQuestions.filter((q) => isSettled(session, q.id)).length;
  const root = current ? rootOf(session.questions, current) : null;
  const probesUsed = root ? probeCount(session.questions, root.id) : 0;
  const latestGraded = [...attempts].reverse().find((a) => a.evaluation);
  const canProbe =
    !!current &&
    !!latestGraded &&
    current.followUpDepth < LIMITS.maxProbesPerQuestion &&
    probesUsed < LIMITS.maxProbesPerQuestion &&
    !session.questions.some((q) => q.parentQuestionId === current.id);
  const visible = ordered.filter(
    (q) =>
      (filter.category === "all" || q.category === filter.category) &&
      (filter.difficulty === "all" || q.difficulty === filter.difficulty),
  );
  const currentIdx = current ? ordered.findIndex((q) => q.id === current.id) : -1;

  function go(qid: string) {
    update((s) => ({ ...s, currentQuestionId: qid }));
    setEditing(false);
    setError(null);
    requestAnimationFrame(() => questionHeading.current?.focus());
  }

  function nextUnsettled(after: string): Question | undefined {
    const idx = ordered.findIndex((q) => q.id === after);
    return [...ordered.slice(idx + 1), ...ordered.slice(0, idx)].find((q) => !isSettled(session, q.id));
  }

  async function withRequest<T>(kind: Exclude<Busy, null>, fn: () => Promise<T>): Promise<T | undefined> {
    if (inflight.current) return undefined;
    inflight.current = true;
    setBusy(kind);
    setError(null);
    const timer = setTimeout(() => setSlow(true), 12_000);
    try {
      return await fn();
    } catch (err) {
      setError(
        err instanceof ClientApiError ? err.message : "Something went wrong. Your answer is saved; please try again.",
      );
      return undefined;
    } finally {
      clearTimeout(timer);
      setSlow(false);
      setBusy(null);
      inflight.current = false;
    }
  }

  function answered(s: Session) {
    return s.attempts
      .filter((a) => a.evaluation && a.attemptIndex === 0)
      .slice(-8)
      .map((a) => {
        const q = s.questions.find((x) => x.id === a.questionId)!;
        return {
          question: q.question,
          category: q.category,
          answerExcerpt: excerpt(a.answerText, 400),
          score: a.evaluation!.score,
        };
      });
  }

  async function maybeAdapt(s: Session, trigger: Question, attempt: Attempt) {
    if (!isBase(trigger) || attempt.attemptIndex !== 0 || attempt.wasAssisted) return;
    if (s.adaptations.some((a) => a.triggerQuestionId === trigger.id)) return;
    const decision = decideDifficulty(s, currentLevel(s));
    if (!decision.changed) return;
    const order = orderedQuestions(s.questions).filter(isBase);
    const idx = order.findIndex((q) => q.id === trigger.id);
    const target = [...order.slice(idx + 1), ...order.slice(0, idx)].find((q) => attemptsFor(s, q.id).length === 0);
    const record = { triggerQuestionId: trigger.id, from: decision.from, to: decision.to, reason: decision.reason };
    if (!target || target.difficulty === decision.to) {
      update((x) => ({
        ...x,
        adaptations: [...x.adaptations, { ...record, targetQuestionId: target?.id ?? "", applied: !!target }],
      }));
      if (target) setAdaptNote(decision.reason);
      return;
    }
    const body: NextRequest = {
      requestId: newRequestId(),
      action: "adapt",
      targetDifficulty: decision.to,
      targetCategory: target.category,
      profile: s.profile,
      resumeText: s.resumeText,
      jdText: s.jdText,
      answered: answered(s),
      parent: null,
      avoidQuestions: s.questions.map((q) => q.question),
    };
    // Record the decision first so a failure never triggers a second call for this transition.
    update((x) => ({
      ...x,
      adaptations: [...x.adaptations, { ...record, targetQuestionId: target.id, applied: false }],
    }));
    const res = await withRequest("adapt", () => postJson<NextResponse>("/api/interview/next", body));
    if (!res) {
      setAdaptNote("We couldn't adjust the next question's difficulty, so it stays as it was.");
      return;
    }
    const replacement = { ...toQuestion(res.question), id: target.id };
    update((x) => ({
      ...x,
      questions: x.questions.map((q) => (q.id === target.id && attemptsFor(x, q.id).length === 0 ? replacement : q)),
      adaptations: x.adaptations.map((a) => (a.triggerQuestionId === trigger.id ? { ...a, applied: true } : a)),
    }));
    setAdaptNote(decision.reason);
  }

  async function checkAnswer() {
    if (!current) return;
    const text = draft.trim();
    if (!text) {
      setError("Write an answer before checking it. Empty answers aren't graded.");
      return;
    }
    if (draft.length > LIMITS.answerChars) {
      setError(
        `Your answer is over the ${LIMITS.answerChars.toLocaleString("en-US")} character limit. Shorten it to continue.`,
      );
      return;
    }
    const q = current;
    const body: EvaluateRequest = {
      requestId: newRequestId(),
      question: draftOf(q),
      resumeExcerpt: session.resumeText,
      profile: session.profile,
      jdText: session.jdText,
      answerText: draft,
    };
    const res = await withRequest("evaluate", () => postJson<EvaluateResponse>("/api/interview/evaluate", body));
    if (!res) return;
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      questionId: q.id,
      attemptIndex: attempts.filter((a) => !a.wasSkipped).length,
      answerText: draft,
      evaluation: res.evaluation,
      wasAssisted: Boolean(session.revealed[q.id]),
      wasSkipped: false,
      createdAt: new Date().toISOString(),
    };
    const withAttempt = (s: Session): Session => {
      const drafts = { ...s.drafts };
      delete drafts[q.id];
      return { ...s, attempts: [...s.attempts, attempt], drafts };
    };
    update(withAttempt);
    setEditing(false);
    setAdaptNote(null);
    toast.success(`Scored ${res.evaluation.score}/10`, { id: "scored" });
    await maybeAdapt(withAttempt(session), q, attempt);
  }

  function skip() {
    if (!current || busy) return;
    const q = current;
    update((s) => ({
      ...s,
      attempts: [
        ...s.attempts,
        {
          id: crypto.randomUUID(),
          questionId: q.id,
          attemptIndex: attemptsFor(s, q.id).filter((a) => !a.wasSkipped).length,
          answerText: "",
          evaluation: null,
          wasAssisted: false,
          wasSkipped: true,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    const next = nextUnsettled(q.id);
    if (next) go(next.id);
  }

  async function askProbe() {
    if (!current || !latestGraded) return;
    const parent = current;
    const body: NextRequest = {
      requestId: newRequestId(),
      action: "probe",
      targetDifficulty: parent.difficulty,
      targetCategory: parent.category,
      profile: session.profile,
      resumeText: session.resumeText,
      jdText: session.jdText,
      answered: answered(session),
      parent: {
        question: parent.question,
        answerText: latestGraded.answerText,
        recommendedProbe: latestGraded.evaluation?.recommendedProbe ?? null,
        resumeReference: parent.resumeReference ?? rootOf(session.questions, parent).resumeReference,
      },
      avoidQuestions: session.questions.map((q) => q.question),
    };
    const res = await withRequest("probe", () => postJson<NextResponse>("/api/interview/next", body));
    if (!res) return;
    const probe = toQuestion(res.question, parent);
    update((s) => ({ ...s, questions: [...s.questions, probe], currentQuestionId: probe.id }));
    setEditing(false);
    requestAnimationFrame(() => questionHeading.current?.focus());
  }

  function finish() {
    update((s) => ({ ...s, status: "finished" }));
    router.push(`/session/${session.id}/report`);
  }

  const next = current ? nextUnsettled(current.id) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-ink-faint">
            <Link href="/practice" className="hover:text-accent">
              Practice
            </Link>{" "}
            / Session
          </p>
          <h1 className="font-semibold break-words">{session.title}</h1>
        </div>
        <Button variant="secondary" onClick={finish} disabled={busy !== null}>
          Finish practice
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {session.source === "sample" ? (
          <Notice tone="warn" title="Sample questions, not live AI results">
            {session.notice}
          </Notice>
        ) : session.notice ? (
          <Notice tone="info">{session.notice}</Notice>
        ) : null}
        {!state.persisted ? (
          <Notice tone="warn">
            This session is kept in this tab only. Refreshing or closing the tab will lose it.
          </Notice>
        ) : null}
        {offline ? (
          <Notice tone="warn">You&apos;re offline. You can keep writing; checking answers needs a connection.</Notice>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Progress sidebar / library */}
        <aside aria-label="Questions" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Progress</h2>
              <span className="text-ink-faint">
                {settledBase}/{baseQuestions.length}
              </span>
            </div>
            <div className="bg-muted mt-2 h-1.5 rounded-full" aria-hidden>
              <div
                className="bg-accent h-full rounded-full transition-all"
                style={{ width: `${baseQuestions.length ? (settledBase / baseQuestions.length) * 100 : 0}%` }}
              />
            </div>
            <details className="group mt-3 lg:open:block" open>
              <summary className="text-ink-soft flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold lg:hidden [&::-webkit-details-marker]:hidden">
                Question list
                <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="sr-only" htmlFor="f-cat">
                  Filter by category
                </label>
                <select
                  id="f-cat"
                  className="border-line-strong bg-surface min-h-11 rounded-[var(--radius-control)] border px-2"
                  value={filter.category}
                  onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value as Category | "all" }))}
                >
                  <option value="all">All types</option>
                  <option value="behavioral">HR & behavioral</option>
                  <option value="technical">Technical</option>
                  <option value="project">Project</option>
                </select>
                <label className="sr-only" htmlFor="f-diff">
                  Filter by difficulty
                </label>
                <select
                  id="f-diff"
                  className="border-line-strong bg-surface min-h-11 rounded-[var(--radius-control)] border px-2"
                  value={filter.difficulty}
                  onChange={(e) => setFilter((f) => ({ ...f, difficulty: e.target.value as Difficulty | "all" }))}
                >
                  <option value="all">All levels</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              {visible.length === 0 ? (
                <p className="bg-muted text-ink-soft mt-3 rounded-[var(--radius-control)] p-3">
                  No questions match these filters.{" "}
                  <button
                    className="text-accent font-semibold underline"
                    onClick={() => setFilter({ category: "all", difficulty: "all" })}
                  >
                    Clear filters
                  </button>
                </p>
              ) : (
                <ol className="mt-3 max-h-[50vh] space-y-1 overflow-y-auto lg:max-h-[60vh]">
                  {visible.map((q) => {
                    const done = isSettled(session, q.id);
                    const skippedOnly = attemptsFor(session, q.id).every((a) => a.wasSkipped) && done;
                    const n = baseQuestions.findIndex((b) => b.id === q.id) + 1;
                    return (
                      <li key={q.id}>
                        <button
                          onClick={() => go(q.id)}
                          aria-current={q.id === current?.id ? "step" : undefined}
                          className={cn(
                            "hover:bg-muted flex min-h-11 w-full items-start gap-2 rounded-lg px-2 py-2 text-left",
                            q.id === current?.id && "bg-accent-soft",
                            !isBase(q) && "pl-6",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                              done && !skippedOnly
                                ? "border-success bg-success text-white"
                                : "border-line-strong text-ink-faint",
                            )}
                          >
                            {done && !skippedOnly ? <Check className="size-3" /> : isBase(q) ? n : "↳"}
                          </span>
                          <span className="min-w-0">
                            <span className="text-ink line-clamp-2">{q.question}</span>
                            <span className="text-ink-faint">
                              {isBase(q) ? CATEGORY_LABEL[q.category] : "Follow-up"} · {q.difficulty}
                              {skippedOnly ? " · skipped" : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </details>
          </Card>
        </aside>

        {/* Question / answer */}
        {current ? (
          <section aria-labelledby="q-heading" className="min-w-0 space-y-5">
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ink-faint">
                  {isBase(current)
                    ? `Question ${baseQuestions.findIndex((b) => b.id === current.id) + 1} of ${baseQuestions.length}`
                    : `Follow-up ${current.followUpDepth} of ${LIMITS.maxProbesPerQuestion}`}
                </span>
                <Badge tone="accent">{CATEGORY_LABEL[current.category]}</Badge>
                <Badge>{current.difficulty}</Badge>
                {current.groundingType === "role_gap" ? <Badge tone="warn">Role gap · hypothetical</Badge> : null}
              </div>
              {!isBase(current) && root ? (
                <p className="text-ink-faint flex gap-2">
                  <CornerDownRight aria-hidden className="mt-1 size-4 shrink-0" />
                  <span>Probing: {excerpt(root.question, 140)}</span>
                </p>
              ) : null}
              <h2
                id="q-heading"
                ref={questionHeading}
                tabIndex={-1}
                className="text-heading font-semibold outline-none"
              >
                {current.question}
              </h2>
              <div className="flex flex-wrap gap-2">
                {current.resumeReference ? (
                  <blockquote className="border-line bg-muted text-ink-soft max-w-full rounded-[var(--radius-control)] border px-3 py-2">
                    <span className="text-ink font-semibold">{current.resumeReference.itemLabel}:</span> “
                    {current.resumeReference.evidenceQuote}”
                  </blockquote>
                ) : null}
                {current.jdReference ? (
                  <blockquote className="border-warn/25 bg-warn-soft text-ink-soft max-w-full rounded-[var(--radius-control)] border px-3 py-2">
                    <span className="text-ink font-semibold">Job description:</span> “{current.jdReference}”
                  </blockquote>
                ) : null}
              </div>
              <details className="group">
                <summary className="text-accent inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-semibold [&::-webkit-details-marker]:hidden">
                  Why this question?
                  <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <p className="text-ink-soft">{current.whyAsked}</p>
              </details>
              <details
                className="group"
                open={Boolean(session.revealed[current.id]) || settled}
                onToggle={(e) => {
                  if ((e.currentTarget as HTMLDetailsElement).open && !session.revealed[current.id] && !settled)
                    update((s) => ({ ...s, revealed: { ...s.revealed, [current.id]: true } }));
                }}
              >
                <summary className="text-ink-soft inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-semibold [&::-webkit-details-marker]:hidden">
                  {settled ? "Expected concepts" : "Reveal expected concepts (marks this answer as assisted)"}
                  <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="text-ink-soft list-disc space-y-1 pl-5">
                  {current.expectedConcepts.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </details>
            </Card>

            {adaptNote ? (
              <Notice tone="info" live>
                {adaptNote}
              </Notice>
            ) : null}

            {showEditor ? (
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="answer">
                    {attempts.some((a) => a.evaluation) ? "Your revised answer" : "Your answer"}
                  </Label>
                  <span className={draft.length > LIMITS.answerChars ? "text-danger font-semibold" : "text-ink-faint"}>
                    {draft.length.toLocaleString("en-US")} / {LIMITS.answerChars.toLocaleString("en-US")}
                  </span>
                </div>
                <Textarea
                  id="answer"
                  rows={9}
                  value={draft}
                  disabled={busy === "evaluate"}
                  onChange={(e) => {
                    const v = e.target.value;
                    const qid = current.id;
                    update((s) => ({ ...s, drafts: { ...s.drafts, [qid]: v } }));
                  }}
                  placeholder={
                    current.category === "behavioral"
                      ? "Describe a real situation, what you did, and the result. Saved as you type."
                      : "Explain your approach, decisions and tradeoffs. Saved as you type."
                  }
                  aria-describedby="answer-help"
                  aria-invalid={draft.length > LIMITS.answerChars}
                />
                <p id="answer-help" className="text-ink-faint">
                  Drafts save automatically on this device.
                  {session.revealed[current.id] ? " This attempt will be marked as assisted." : ""}
                </p>
                {error ? <Notice tone="error">{error}</Notice> : null}
                {busy === "evaluate" && slow ? (
                  <Notice tone="info" live>
                    The AI provider is slower than usual. Your answer is saved.
                  </Notice>
                ) : null}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  {!settled ? (
                    <Button variant="ghost" onClick={skip} disabled={busy !== null}>
                      <SkipForward aria-hidden /> Skip question
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy !== null}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    onClick={() => void checkAnswer()}
                    disabled={busy !== null || offline}
                    aria-busy={busy === "evaluate"}
                  >
                    {busy === "evaluate" ? (
                      <>
                        <Loader2 aria-hidden className="animate-spin" /> Checking…
                      </>
                    ) : (
                      "Check my answer"
                    )}
                  </Button>
                </div>
              </Card>
            ) : null}

            {latest?.wasSkipped && !editing ? (
              <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-ink-soft">You skipped this question.</p>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Answer it now
                </Button>
              </Card>
            ) : null}

            {latestGraded && !editing ? (
              <>
                <FeedbackPanel
                  attempt={latestGraded}
                  onRevealExample={() => {
                    if (!session.revealed[current.id])
                      update((s) => ({ ...s, revealed: { ...s.revealed, [current.id]: true } }));
                  }}
                />
                {error ? <Notice tone="error">{error}</Notice> : null}
                {busy === "probe" && slow ? (
                  <Notice tone="info" live>
                    The AI provider is slower than usual.
                  </Notice>
                ) : null}
                <div className="no-print flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => {
                      update((s) => ({ ...s, drafts: { ...s.drafts, [current.id]: latestGraded.answerText } }));
                      setEditing(true);
                    }}
                  >
                    Try again
                  </Button>
                  {canProbe ? (
                    <Button variant="secondary" disabled={busy !== null || offline} onClick={() => void askProbe()}>
                      {busy === "probe" ? (
                        <>
                          <Loader2 aria-hidden className="animate-spin" /> Preparing follow-up…
                        </>
                      ) : (
                        "Answer a follow-up"
                      )}
                    </Button>
                  ) : null}
                  {next ? (
                    <Button disabled={busy !== null} onClick={() => go(next.id)}>
                      {busy === "adapt" ? (
                        <>
                          <Loader2 aria-hidden className="animate-spin" /> Adjusting next question…
                        </>
                      ) : (
                        "Next question"
                      )}
                    </Button>
                  ) : (
                    <Button disabled={busy !== null} onClick={finish}>
                      See my report
                    </Button>
                  )}
                </div>
              </>
            ) : null}

            {attempts.filter((a) => a.evaluation).length > 1 ? (
              <details className="border-line bg-surface rounded-[var(--radius-card)] border p-4">
                <summary className="min-h-11 cursor-pointer font-semibold">Previous attempts</summary>
                <ul className="mt-2 space-y-3">
                  {attempts
                    .filter((a) => a.evaluation && a.id !== latestGraded?.id)
                    .map((a) => (
                      <li key={a.id} className="bg-muted rounded-[var(--radius-control)] p-3">
                        <p className="font-semibold">
                          Attempt {a.attemptIndex + 1}: {a.evaluation!.score}/10{a.wasAssisted ? " (assisted)" : ""}
                        </p>
                        <p className="text-ink-soft mt-1 whitespace-pre-wrap">{a.answerText}</p>
                      </li>
                    ))}
                </ul>
              </details>
            ) : null}

            <nav aria-label="Question navigation" className="no-print flex justify-between gap-2">
              <Button
                variant="ghost"
                disabled={currentIdx <= 0 || busy !== null}
                onClick={() => go(ordered[currentIdx - 1].id)}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                disabled={currentIdx >= ordered.length - 1 || busy !== null}
                onClick={() => go(ordered[currentIdx + 1].id)}
              >
                Next
              </Button>
            </nav>
          </section>
        ) : (
          <Card>
            <p className="text-ink-soft">This session has no questions.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
