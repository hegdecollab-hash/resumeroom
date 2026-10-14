import {
  CATEGORIES,
  DIFFICULTIES,
  DIMENSIONS,
  type Attempt,
  type Category,
  type DimensionScores,
  type Difficulty,
  type Question,
  type Session,
} from "./types";

/** Overall score = sum of four 0-5 dimensions / 2, giving 0-10 in 0.5 steps. */
export function computeScore(dimensions: DimensionScores): number {
  const sum = DIMENSIONS.reduce((acc, d) => acc + dimensions[d], 0);
  return Math.round((sum / 2) * 10) / 10;
}

export const isBase = (q: Question) => q.parentQuestionId === null;

export function attemptsFor(session: Pick<Session, "attempts">, questionId: string): Attempt[] {
  return session.attempts
    .filter((a) => a.questionId === questionId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.attemptIndex - b.attemptIndex);
}

export function firstAttempt(session: Pick<Session, "attempts">, questionId: string): Attempt | undefined {
  return attemptsFor(session, questionId)[0];
}

/** A question is settled once it has a graded attempt or was skipped. */
export function isSettled(session: Pick<Session, "attempts">, questionId: string): boolean {
  return attemptsFor(session, questionId).some((a) => a.wasSkipped || a.evaluation !== null);
}

export interface AdaptationDecision {
  from: Difficulty;
  to: Difficulty;
  changed: boolean;
  reason: string;
}

function shift(level: Difficulty, delta: -1 | 1): Difficulty {
  const i = DIFFICULTIES.indexOf(level) + delta;
  return DIFFICULTIES[Math.min(Math.max(i, 0), DIFFICULTIES.length - 1)];
}

/**
 * Deterministic adaptation. Considers the latest two unassisted, non-skipped first attempts
 * on base questions (probes and retries excluded). Both >= 8 moves up one level; both < 5 moves
 * down one level; otherwise unchanged. Clamped to easy..hard.
 */
export function decideDifficulty(
  session: Pick<Session, "attempts" | "questions">,
  current: Difficulty,
): AdaptationDecision {
  const baseIds = new Set(session.questions.filter(isBase).map((q) => q.id));
  const firsts = session.attempts
    .filter((a) => a.attemptIndex === 0 && baseIds.has(a.questionId))
    .filter((a) => !a.wasSkipped && !a.wasAssisted && a.evaluation !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lastTwo = firsts.slice(-2);
  const unchanged = { from: current, to: current, changed: false, reason: "" };
  if (lastTwo.length < 2) return unchanged;
  const scores = lastTwo.map((a) => a.evaluation!.score);
  if (scores.every((s) => s >= 8)) {
    const to = shift(current, 1);
    return to === current
      ? unchanged
      : {
          from: current,
          to,
          changed: true,
          reason: `Your last two answers scored 8 or higher, so the next question moves to ${to}.`,
        };
  }
  if (scores.every((s) => s < 5)) {
    const to = shift(current, -1);
    return to === current
      ? unchanged
      : {
          from: current,
          to,
          changed: true,
          reason: `Your last two answers scored below 5, so the next question moves to ${to}.`,
        };
  }
  return unchanged;
}

/** Questions in practice order: each base question followed by its probes. */
export function orderedQuestions(questions: Question[]): Question[] {
  const out: Question[] = [];
  const byParent = new Map<string, Question[]>();
  for (const q of questions) {
    if (q.parentQuestionId) byParent.set(q.parentQuestionId, [...(byParent.get(q.parentQuestionId) ?? []), q]);
  }
  const visit = (q: Question) => {
    out.push(q);
    for (const child of byParent.get(q.id) ?? []) visit(child);
  };
  questions.filter(isBase).forEach(visit);
  return out;
}

export function rootOf(questions: Question[], q: Question): Question {
  let cur = q;
  const byId = new Map(questions.map((x) => [x.id, x]));
  while (cur.parentQuestionId && byId.has(cur.parentQuestionId)) cur = byId.get(cur.parentQuestionId)!;
  return cur;
}

export function probeCount(questions: Question[], baseId: string): number {
  return questions.filter((q) => q.parentQuestionId !== null && rootOf(questions, q).id === baseId).length;
}

export interface CategoryStat {
  category: Category;
  total: number;
  graded: number;
  average: number | null;
}

export interface ReportStats {
  baseTotal: number;
  answered: number;
  skipped: number;
  unanswered: number;
  graded: number;
  probesAnswered: number;
  firstAttemptAverage: number | null;
  bestAttemptAverage: number | null;
  assistedCount: number;
  retriedCount: number;
  byCategory: CategoryStat[];
  retryQuestionIds: string[];
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/** All report numbers are computed here, never by the model. */
export function computeReport(session: Pick<Session, "attempts" | "questions">): ReportStats {
  const base = session.questions.filter(isBase);
  const probes = session.questions.filter((q) => !isBase(q));
  const firstScores: number[] = [];
  const bestScores: number[] = [];
  let skipped = 0;
  let answered = 0;
  let assistedCount = 0;
  let retriedCount = 0;
  const retry: { id: string; score: number }[] = [];
  const catScores = new Map<Category, number[]>();

  for (const q of base) {
    const attempts = attemptsFor(session, q.id);
    const graded = attempts.filter((a) => a.evaluation !== null);
    if (graded.length === 0) {
      if (attempts.some((a) => a.wasSkipped)) skipped += 1;
      continue;
    }
    answered += 1;
    const first = graded[0].evaluation!.score;
    const best = Math.max(...graded.map((a) => a.evaluation!.score));
    firstScores.push(first);
    bestScores.push(best);
    if (graded.some((a) => a.wasAssisted)) assistedCount += 1;
    if (graded.length > 1) retriedCount += 1;
    if (best < 7) retry.push({ id: q.id, score: best });
    catScores.set(q.category, [...(catScores.get(q.category) ?? []), first]);
  }

  const probesAnswered = probes.filter((p) => attemptsFor(session, p.id).some((a) => a.evaluation)).length;

  return {
    baseTotal: base.length,
    answered,
    skipped,
    unanswered: base.length - answered - skipped,
    graded: firstScores.length,
    probesAnswered,
    firstAttemptAverage: avg(firstScores),
    bestAttemptAverage: avg(bestScores),
    assistedCount,
    retriedCount,
    byCategory: CATEGORIES.map((category) => {
      const scores = catScores.get(category) ?? [];
      return {
        category,
        total: base.filter((q) => q.category === category).length,
        graded: scores.length,
        average: avg(scores),
      };
    }).filter((c) => c.total > 0),
    retryQuestionIds: retry.sort((a, b) => a.score - b.score).map((r) => r.id),
  };
}

export interface PlanItem {
  text: string;
  occurrences: number;
}

/** Builds a short plan from repeated feedback items in actual evaluations. */
export function improvementPlan(session: Pick<Session, "attempts">, limit = 4): PlanItem[] {
  const counts = new Map<string, PlanItem>();
  for (const a of session.attempts) {
    if (!a.evaluation) continue;
    for (const raw of [...a.evaluation.improvements, ...a.evaluation.missingConcepts.map((c) => `Cover: ${c}`)]) {
      const key = raw
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .slice(0, 60);
      const cur = counts.get(key);
      counts.set(key, { text: cur?.text ?? raw, occurrences: (cur?.occurrences ?? 0) + 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.occurrences - a.occurrences).slice(0, limit);
}
