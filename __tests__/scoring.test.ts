import { describe, expect, it } from "vitest";
import {
  computeReport,
  computeScore,
  decideDifficulty,
  improvementPlan,
  orderedQuestions,
} from "@/lib/interview/scoring";
import type { Attempt, Evaluation, Question } from "@/lib/interview/types";

const q = (id: string, extra: Partial<Question> = {}): Question => ({
  id,
  category: "technical",
  difficulty: "medium",
  question: `Question ${id}?`,
  resumeReference: { itemLabel: "x", evidenceQuote: "y" },
  jdReference: null,
  groundingType: "resume",
  whyAsked: "because",
  expectedConcepts: ["a", "b"],
  parentQuestionId: null,
  followUpDepth: 0,
  ...extra,
});

const ev = (score: number, improvements: string[] = []): Evaluation => ({
  dimensions: { relevance: 0, accuracyOrSoundness: 0, depth: 0, clarity: 0 },
  score,
  strengths: [],
  improvements,
  missingConcepts: [],
  conciseExplanation: "ok",
  exampleAnswer: "example",
  exampleAnswerType: "technical_example",
  recommendedProbe: null,
  uncertaintyNote: null,
});

let t = 0;
const att = (questionId: string, score: number | null, extra: Partial<Attempt> = {}): Attempt => ({
  id: `a${t}`,
  questionId,
  attemptIndex: 0,
  answerText: "answer",
  evaluation: score === null ? null : ev(score),
  wasAssisted: false,
  wasSkipped: score === null,
  createdAt: new Date(1_700_000_000_000 + t++ * 1000).toISOString(),
  ...extra,
});

describe("computeScore", () => {
  it("is sum of dimensions / 2", () => {
    expect(computeScore({ relevance: 5, accuracyOrSoundness: 5, depth: 5, clarity: 5 })).toBe(10);
    expect(computeScore({ relevance: 3, accuracyOrSoundness: 4, depth: 2, clarity: 4 })).toBe(6.5);
    expect(computeScore({ relevance: 0, accuracyOrSoundness: 0, depth: 0, clarity: 0 })).toBe(0);
  });
});

describe("decideDifficulty", () => {
  const questions = [q("1"), q("2"), q("3"), q("p", { parentQuestionId: "1", followUpDepth: 1 })];
  it("raises after two >= 8", () => {
    const d = decideDifficulty({ questions, attempts: [att("1", 8), att("2", 9)] }, "medium");
    expect(d).toMatchObject({ changed: true, to: "hard" });
    expect(d.reason).toMatch(/hard/);
  });
  it("lowers after two < 5", () => {
    expect(decideDifficulty({ questions, attempts: [att("1", 4), att("2", 2)] }, "medium").to).toBe("easy");
  });
  it("keeps level for mixed results or fewer than two", () => {
    expect(decideDifficulty({ questions, attempts: [att("1", 9), att("2", 4)] }, "medium").changed).toBe(false);
    expect(decideDifficulty({ questions, attempts: [att("1", 9)] }, "medium").changed).toBe(false);
  });
  it("clamps at bounds", () => {
    expect(decideDifficulty({ questions, attempts: [att("1", 9), att("2", 9)] }, "hard").changed).toBe(false);
    expect(decideDifficulty({ questions, attempts: [att("1", 1), att("2", 1)] }, "easy").changed).toBe(false);
  });
  it("excludes skips, probes, retries and assisted attempts", () => {
    const attempts = [
      att("1", 9),
      att("2", null),
      att("p", 9),
      att("2", 9, { attemptIndex: 1 }),
      att("3", 9, { wasAssisted: true }),
    ];
    expect(decideDifficulty({ questions, attempts }, "medium").changed).toBe(false);
  });
  it("is deterministic", () => {
    const input = { questions, attempts: [att("1", 8), att("2", 8)] };
    expect(decideDifficulty(input, "easy")).toEqual(decideDifficulty(input, "easy"));
  });
});

describe("computeReport", () => {
  it("reports zero graded honestly", () => {
    const r = computeReport({ questions: [q("1"), q("2")], attempts: [att("1", null)] });
    expect(r.graded).toBe(0);
    expect(r.firstAttemptAverage).toBeNull();
    expect(r.skipped).toBe(1);
    expect(r.unanswered).toBe(1);
  });
  it("computes first/best averages, retries and assistance", () => {
    const questions = [q("1"), q("2", { category: "behavioral" })];
    const attempts = [att("1", 4), att("1", 8, { attemptIndex: 1, wasAssisted: true }), att("2", 6)];
    const r = computeReport({ questions, attempts });
    expect(r.firstAttemptAverage).toBe(5);
    expect(r.bestAttemptAverage).toBe(7);
    expect(r.retriedCount).toBe(1);
    expect(r.assistedCount).toBe(1);
    expect(r.retryQuestionIds).toEqual(["2"]);
    expect(r.byCategory.find((c) => c.category === "behavioral")?.average).toBe(6);
  });
});

describe("orderedQuestions / plan", () => {
  it("places probes after their parent", () => {
    const list = [q("1"), q("2"), q("p", { parentQuestionId: "1", followUpDepth: 1 })];
    expect(orderedQuestions(list).map((x) => x.id)).toEqual(["1", "p", "2"]);
  });
  it("builds plan from repeated feedback", () => {
    const a1 = att("1", 5);
    a1.evaluation!.improvements = ["Add metrics"];
    const a2 = att("2", 5);
    a2.evaluation!.improvements = ["Add metrics", "Explain tradeoffs"];
    expect(improvementPlan({ attempts: [a1, a2] })[0]).toEqual({ text: "Add metrics", occurrences: 2 });
  });
});
