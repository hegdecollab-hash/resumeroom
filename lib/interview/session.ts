import type {
  DraftQuestion,
  GenerateResponse,
  Preferences,
  ProfileSummary,
  Question,
  Session,
  SessionSource,
} from "./types";

export function toQuestion(d: DraftQuestion, parent: Question | null = null): Question {
  return {
    ...d,
    id: crypto.randomUUID(),
    parentQuestionId: parent ? parent.id : null,
    followUpDepth: parent ? Math.min(parent.followUpDepth + 1, 2) : 0,
  };
}

export function createSession(input: {
  resumeText: string;
  jdText: string | null;
  preferences: Preferences;
  profile: ProfileSummary;
  questions: DraftQuestion[];
  source: SessionSource;
  notice?: GenerateResponse["notice"];
}): Session {
  const now = new Date().toISOString();
  const questions = input.questions.map((q) => toQuestion(q));
  const label = { mixed: "Mixed", behavioral: "HR & behavioral", technical: "Technical" }[input.preferences.focus];
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    title: `${label} · ${input.preferences.difficulty} · ${questions.length} questions${input.jdText ? " · with JD" : ""}`,
    source: input.source,
    resumeText: input.resumeText,
    jdText: input.jdText,
    preferences: input.preferences,
    profile: input.profile,
    questions,
    attempts: [],
    drafts: {},
    revealed: {},
    adaptations: [],
    currentQuestionId: questions[0]?.id ?? null,
    status: "active",
    notice: input.notice ?? null,
  };
}

/** Plain-text export of a session report (user-triggered). */
export function sessionToText(session: Session, stats: import("./scoring").ReportStats): string {
  const lines: string[] = [];
  lines.push(`${session.title}`, `Created: ${new Date(session.createdAt).toLocaleString()}`);
  if (session.source === "sample") lines.push("Note: sample questions (fixture), not live AI-generated questions.");
  lines.push("", "SUMMARY");
  lines.push(
    `Answered: ${stats.answered} of ${stats.baseTotal} · Skipped: ${stats.skipped} · Not attempted: ${stats.unanswered}`,
  );
  lines.push(
    stats.graded
      ? `First-attempt average: ${stats.firstAttemptAverage}/10 · Best-attempt average: ${stats.bestAttemptAverage}/10`
      : "No graded answers yet.",
  );
  lines.push("Scores are AI practice estimates, not hiring decisions.", "");
  for (const q of session.questions) {
    const attempts = session.attempts.filter((a) => a.questionId === q.id);
    lines.push(`${q.parentQuestionId ? "  Follow-up" : "Q"} [${q.category}/${q.difficulty}] ${q.question}`);
    if (!attempts.length) lines.push("  Not attempted");
    for (const a of attempts) {
      if (a.wasSkipped) {
        lines.push("  Skipped");
        continue;
      }
      lines.push(
        `  Attempt ${a.attemptIndex + 1}${a.wasAssisted ? " (assisted)" : ""}: ${a.evaluation ? `${a.evaluation.score}/10` : "not graded"}`,
      );
      lines.push(`  Answer: ${a.answerText}`);
      if (a.evaluation) {
        a.evaluation.strengths.forEach((s) => lines.push(`  + ${s}`));
        a.evaluation.improvements.forEach((s) => lines.push(`  - ${s}`));
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
