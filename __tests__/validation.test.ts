import { describe, expect, it } from "vitest";
import { redactContacts } from "@/lib/interview/redact";
import { SAMPLE_QUESTIONS, SAMPLE_RESUME } from "@/lib/interview/sample";
import { quoteAppearsIn } from "@/lib/interview/text";
import {
  groundingErrors,
  validateDraftQuestion,
  validateEvaluateRequest,
  validateGenerateRequest,
  validateModelEvaluation,
  validateProfile,
} from "@/lib/interview/validation";
import { createLimiter } from "@/lib/security/limiter";

const base = {
  requestId: "req-12345678",
  resumeText: SAMPLE_RESUME,
  preferences: { focus: "mixed", difficulty: "medium", count: 10 },
};

describe("generate request validation", () => {
  it("accepts resume-only and treats whitespace JD as absent", () => {
    const a = validateGenerateRequest({ ...base, jdText: null });
    const b = validateGenerateRequest({ ...base, jdText: "   \n " });
    const c = validateGenerateRequest({ ...base });
    expect(a.ok && a.value.jdText).toBe(null);
    expect(b.ok && b.value.jdText).toBe(null);
    expect(c.ok).toBe(true);
  });
  it("rejects oversize input instead of truncating", () => {
    const r = validateGenerateRequest({ ...base, resumeText: "x".repeat(30_001) });
    expect(r.ok).toBe(false);
    const j = validateGenerateRequest({ ...base, jdText: "x".repeat(15_001) });
    expect(j.ok).toBe(false);
  });
  it("rejects bad enums and counts", () => {
    expect(validateGenerateRequest({ ...base, preferences: { focus: "x", difficulty: "medium", count: 10 } }).ok).toBe(
      false,
    );
    expect(
      validateGenerateRequest({ ...base, preferences: { focus: "mixed", difficulty: "medium", count: 7 } }).ok,
    ).toBe(false);
    expect(validateGenerateRequest({ ...base, requestId: "bad id!" }).ok).toBe(false);
  });
});

describe("grounding", () => {
  it("sample fixtures quote the sample resume exactly", () => {
    for (const q of SAMPLE_QUESTIONS) {
      expect(validateDraftQuestion(q).ok).toBe(true);
      expect(groundingErrors(q, SAMPLE_RESUME, null)).toEqual([]);
    }
  });
  it("tolerates whitespace and smart quotes but rejects invented evidence", () => {
    expect(quoteAppearsIn("Mentored  two interns\nthrough code reviews", SAMPLE_RESUME)).toBe(true);
    expect(quoteAppearsIn("Led a team of 12 engineers", SAMPLE_RESUME)).toBe(false);
  });
  it("requires a JD and genuine JD evidence for role-gap questions", () => {
    const q = {
      ...SAMPLE_QUESTIONS[0],
      groundingType: "role_gap" as const,
      resumeReference: null,
      jdReference: "Kubernetes experience",
    };
    expect(groundingErrors(q, SAMPLE_RESUME, null).length).toBeGreaterThan(0);
    expect(groundingErrors(q, SAMPLE_RESUME, "Requirements: Kubernetes experience required")).toEqual([]);
    expect(groundingErrors(q, SAMPLE_RESUME, "Requirements: Go").length).toBeGreaterThan(0);
  });
  it("forces jdProvided from the server and empties roleGaps without a JD", () => {
    const p = validateProfile(
      {
        headline: "Dev",
        projects: [{ name: "Fake", evidenceQuote: "invented quote not here" }],
        skills: ["TS"],
        inferredFocus: null,
        roleGaps: ["Go"],
        jdProvided: true,
      },
      SAMPLE_RESUME,
      null,
    );
    expect(p.ok && p.value).toMatchObject({ jdProvided: false, roleGaps: [], projects: [] });
  });
  it("validates expectedConcepts count and uniqueness", () => {
    expect(validateDraftQuestion({ ...SAMPLE_QUESTIONS[0], expectedConcepts: ["one"] }).ok).toBe(false);
    expect(validateDraftQuestion({ ...SAMPLE_QUESTIONS[0], expectedConcepts: ["a", "A"] }).ok).toBe(false);
    expect(validateDraftQuestion({ ...SAMPLE_QUESTIONS[0], category: "trivia" }).ok).toBe(false);
  });
});

describe("evaluation validation", () => {
  const good = {
    dimensions: { relevance: 4, accuracyOrSoundness: 3, depth: 2, clarity: 5 },
    strengths: ["s"],
    improvements: ["i"],
    missingConcepts: [],
    conciseExplanation: "Fine answer.",
    exampleAnswer: "An example answer.",
    exampleAnswerType: "technical_example",
    recommendedProbe: null,
    uncertaintyNote: null,
  };
  it("accepts valid output and rejects out-of-range dimensions", () => {
    expect(validateModelEvaluation(good).ok).toBe(true);
    expect(validateModelEvaluation({ ...good, dimensions: { ...good.dimensions, depth: 6 } }).ok).toBe(false);
    expect(validateModelEvaluation({ ...good, dimensions: { ...good.dimensions, depth: 2.5 } }).ok).toBe(false);
  });
  it("rejects client-supplied scores and empty answers", () => {
    const req = {
      requestId: "req-12345678",
      question: SAMPLE_QUESTIONS[0],
      resumeExcerpt: SAMPLE_RESUME,
      profile: { headline: "Dev", projects: [], skills: [], inferredFocus: null, jdProvided: false, roleGaps: [] },
      jdText: null,
      answerText: "My answer",
    };
    expect(validateEvaluateRequest(req).ok).toBe(true);
    expect(validateEvaluateRequest({ ...req, score: 10 }).ok).toBe(false);
    expect(validateEvaluateRequest({ ...req, answerText: "   " }).ok).toBe(false);
    expect(validateEvaluateRequest({ ...req, answerText: "x".repeat(8001) }).ok).toBe(false);
  });
});

describe("redaction", () => {
  it("removes obvious contacts but keeps year ranges", () => {
    const r = redactContacts(SAMPLE_RESUME);
    expect(r.text).not.toMatch(/alex\.rivera@example\.com/);
    expect(r.text).not.toMatch(/555 010 0199/);
    expect(r.text).not.toMatch(/github\.com\/alex/);
    expect(r.text).toMatch(/2022 - Present/);
    expect(r.text).toMatch(/2021 - 2022/);
    expect(r.count).toBe(3);
  });
});

describe("limiter", () => {
  it("allows up to the limit per window", () => {
    const l = createLimiter({ limit: 2, windowMs: 1000 });
    expect(l.check("ip", 0).allowed).toBe(true);
    expect(l.check("ip", 1).allowed).toBe(true);
    expect(l.check("ip", 2).allowed).toBe(false);
    expect(l.check("other", 2).allowed).toBe(true);
    expect(l.check("ip", 1001).allowed).toBe(true);
  });
});
