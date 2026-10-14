"use client";

import { Download, Loader2, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { computeReport, improvementPlan } from "@/lib/interview/scoring";
import { sessionToText } from "@/lib/interview/session";
import { deleteSession } from "@/lib/storage/storage";
import { cn } from "@/lib/utils";
import { scoreTone } from "./feedback-panel";
import { SessionMissing } from "./session-missing";
import { useSession } from "./use-session";

const CATEGORY_LABEL = { behavioral: "HR & behavioral", technical: "Technical", project: "Project" } as const;

export function ReportView({ id }: { id: string }) {
  const router = useRouter();
  const { state } = useSession(id);

  if (state.status === "loading")
    return (
      <div role="status" className="text-ink-soft mx-auto flex max-w-5xl items-center gap-2 px-4 py-16 sm:px-6">
        <Loader2 aria-hidden className="size-5 animate-spin" /> Loading report…
      </div>
    );
  if (state.status === "missing") return <SessionMissing />;
  if (state.status === "corrupt") return <SessionMissing corrupt />;

  const session = state.session;
  const stats = computeReport(session);
  const plan = improvementPlan(session);
  const byId = new Map(session.questions.map((q) => [q.id, q]));

  function download() {
    const blob = new Blob([sessionToText(session, stats)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumeroom-report-${session.createdAt.slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-ink-faint">Practice report</p>
          <h1 className="text-heading font-semibold break-words">{session.title}</h1>
          <p className="text-ink-faint">{new Date(session.createdAt).toLocaleString()}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="secondary" onClick={download}>
            <Download aria-hidden /> Download my report
          </Button>
          <Button variant="ghost" onClick={() => window.print()}>
            <Printer aria-hidden /> Print
          </Button>
        </div>
      </div>

      {session.source === "sample" ? (
        <Notice tone="warn">This session used prepared sample questions, not live AI-generated questions.</Notice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Answered" value={`${stats.answered} / ${stats.baseTotal}`} />
        <Stat
          label="Skipped"
          value={String(stats.skipped)}
          hint={stats.unanswered ? `${stats.unanswered} not attempted` : undefined}
        />
        <Stat
          label="First-attempt average"
          value={stats.firstAttemptAverage === null ? "No graded answers yet" : `${stats.firstAttemptAverage} / 10`}
          tone={stats.firstAttemptAverage}
        />
        <Stat
          label="Best-attempt average"
          value={stats.bestAttemptAverage === null ? "No graded answers yet" : `${stats.bestAttemptAverage} / 10`}
          tone={stats.bestAttemptAverage}
        />
      </div>
      <p className="text-ink-faint">
        Scores are AI practice estimates, not hiring decisions. Numbers are calculated on this device from your graded
        answers.
        {stats.assistedCount
          ? ` ${stats.assistedCount} answer(s) were assisted (concepts or example viewed first).`
          : ""}
        {stats.retriedCount ? ` ${stats.retriedCount} question(s) were retried.` : ""}
        {stats.probesAnswered ? ` ${stats.probesAnswered} follow-up probe(s) answered.` : ""}
      </p>

      {stats.graded === 0 ? (
        <Card className="space-y-3 text-center">
          <h2 className="font-semibold">No graded answers yet</h2>
          <p className="text-ink-soft">Answer at least one question to see scores and an improvement plan.</p>
          <div>
            <Button asChild>
              <Link href={`/session/${session.id}`}>Continue practicing</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="font-semibold">By category</h2>
            <ul className="mt-4 space-y-3">
              {stats.byCategory.map((c) => (
                <li key={c.category}>
                  <div className="flex justify-between gap-2">
                    <span>{CATEGORY_LABEL[c.category]}</span>
                    <span className="text-ink-soft">
                      {c.average === null ? "not graded" : `${c.average}/10`} · {c.graded}/{c.total} graded
                    </span>
                  </div>
                  <div className="bg-muted mt-1 h-1.5 rounded-full" aria-hidden>
                    <div
                      className="bg-accent h-full rounded-full"
                      style={{ width: `${((c.average ?? 0) / 10) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="font-semibold">Next practice plan</h2>
            {stats.graded < 3 ? (
              <p className="text-ink-faint mt-1">
                Based on limited evidence ({stats.graded} graded answer{stats.graded === 1 ? "" : "s"}).
              </p>
            ) : null}
            {plan.length ? (
              <ol className="text-ink-soft mt-3 list-decimal space-y-2 pl-5">
                {plan.map((p) => (
                  <li key={p.text}>
                    {p.text}
                    {p.occurrences > 1 ? <span className="text-ink-faint"> (came up {p.occurrences}×)</span> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-ink-soft mt-3">Your feedback didn&apos;t flag specific improvements.</p>
            )}
          </Card>
        </div>
      )}

      {stats.retryQuestionIds.length ? (
        <Card>
          <h2 className="font-semibold">Questions to retry</h2>
          <ul className="divide-line mt-3 divide-y">
            {stats.retryQuestionIds.map((qid) => {
              const q = byId.get(qid)!;
              return (
                <li key={qid} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-ink-soft min-w-0">{q.question}</span>
                  <Button asChild variant="secondary" className="shrink-0">
                    <Link href={`/session/${session.id}?q=${qid}`}>Retry</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-semibold">All questions</h2>
        <ol className="mt-3 space-y-3">
          {session.questions.map((q) => {
            const atts = session.attempts.filter((a) => a.questionId === q.id);
            const graded = atts.filter((a) => a.evaluation);
            const best = graded.length ? Math.max(...graded.map((a) => a.evaluation!.score)) : null;
            return (
              <li
                key={q.id}
                className={cn(
                  "border-line rounded-[var(--radius-control)] border p-3",
                  q.parentQuestionId && "ml-4 sm:ml-8",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{q.parentQuestionId ? "Follow-up" : CATEGORY_LABEL[q.category]}</Badge>
                  <Badge>{q.difficulty}</Badge>
                  {graded.some((a) => a.wasAssisted) ? <Badge tone="warn">Assisted</Badge> : null}
                  <span className={cn("ml-auto font-semibold", best !== null ? scoreTone(best) : "text-ink-faint")}>
                    {best !== null ? `${best}/10` : atts.some((a) => a.wasSkipped) ? "Skipped" : "Not attempted"}
                  </span>
                </div>
                <p className="mt-2">{q.question}</p>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="no-print flex flex-col gap-3 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/practice">Practice again</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/session/${session.id}`}>Back to session</Link>
          </Button>
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="danger">
              <Trash2 aria-hidden /> Delete session
            </Button>
          }
          title="Delete this session?"
          description="Its questions, answers, feedback and this report will be removed from this browser. Download the report first if you want to keep it."
          confirmLabel="Delete session"
          onConfirm={() => {
            if (deleteSession(session.id)) {
              toast.success("Session deleted.", { id: "del" });
              router.push("/practice");
            } else toast.error("Couldn't delete the session from browser storage.", { id: "del" });
          }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: number | null }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-ink-faint">{label}</p>
      <p className={cn("font-display mt-1 text-2xl", typeof tone === "number" ? scoreTone(tone) : "")}>{value}</p>
      {hint ? <p className="text-ink-faint">{hint}</p> : null}
    </Card>
  );
}
