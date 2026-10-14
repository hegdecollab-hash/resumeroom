import "server-only";
import { computeScore } from "@/lib/interview/scoring";
import type {
  DraftQuestion,
  EvaluateRequest,
  Evaluation,
  GenerateRequest,
  GenerateResponse,
  NextRequest,
} from "@/lib/interview/types";
import { normalizeForMatch } from "@/lib/interview/text";
import {
  groundingErrors,
  validateDraftQuestion,
  validateModelEvaluation,
  validateProfile,
} from "@/lib/interview/validation";
import { AppError } from "./errors";
import { callStructured } from "./openrouter";
import {
  EVALUATE_SYSTEM,
  GENERATE_SYSTEM,
  NEXT_SYSTEM,
  evaluateUserMessage,
  generateUserMessage,
  nextUserMessage,
} from "./prompts";
import { evaluateSchema, generateSchema, nextSchema } from "./schemas";

const INVALID = () =>
  new AppError(
    "INVALID_OUTPUT",
    "The AI returned questions that were not properly grounded in your resume. Please try again.",
    502,
    true,
  );

interface Checked {
  valid: DraftQuestion[];
  errors: string[];
}

function checkQuestions(raw: unknown, req: GenerateRequest): Checked {
  const errors: string[] = [];
  const valid: DraftQuestion[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(raw)) return { valid, errors: ["questions must be an array"] };
  raw.forEach((item, i) => {
    const path = `questions[${i}]`;
    const r = validateDraftQuestion(item, path);
    if (!r.ok) return errors.push(...r.errors);
    const q = r.value;
    const g = groundingErrors(q, req.resumeText, req.jdText, path);
    if (q.difficulty !== req.preferences.difficulty) q.difficulty = req.preferences.difficulty;
    if (req.preferences.focus === "behavioral" && q.category !== "behavioral")
      g.push(`${path}: category must be behavioral`);
    if (req.preferences.focus === "technical" && q.category === "behavioral")
      g.push(`${path}: category must be technical or project`);
    const key = normalizeForMatch(q.question);
    if (seen.has(key)) g.push(`${path}: duplicate question`);
    if (g.length) return errors.push(...g);
    seen.add(key);
    valid.push(q);
  });
  if (valid.length < req.preferences.count)
    errors.push(`need exactly ${req.preferences.count} valid questions, got ${valid.length}`);
  return { valid: valid.slice(0, req.preferences.count), errors };
}

export async function generateQuestions(req: GenerateRequest): Promise<GenerateResponse> {
  const user = generateUserMessage(req);
  const maxTokens = 900 + req.preferences.count * 380;
  const first = (await callStructured({
    operation: "generate",
    requestId: req.requestId,
    system: GENERATE_SYSTEM,
    user,
    schema: generateSchema,
    maxTokens,
  })) as { profile?: unknown; questions?: unknown };

  let profile = validateProfile(first?.profile, req.resumeText, req.jdText);
  let checked = checkQuestions(first?.questions, req);

  if (!profile.ok || checked.errors.length) {
    // One bounded repair attempt with the specific validation errors.
    const issues = [...(profile.ok ? [] : profile.errors), ...checked.errors].slice(0, 30);
    const repaired = (await callStructured({
      operation: "repair",
      requestId: req.requestId,
      system: GENERATE_SYSTEM,
      user,
      schema: generateSchema,
      maxTokens,
      extra: [
        { role: "assistant", content: JSON.stringify(first) },
        {
          role: "user",
          content: `Your output failed validation:\n- ${issues.join("\n- ")}\nReturn the full corrected JSON. Copy evidence quotes character-for-character from the resume/JD.`,
        },
      ],
    })) as { profile?: unknown; questions?: unknown };
    const p2 = validateProfile(repaired?.profile, req.resumeText, req.jdText);
    const c2 = checkQuestions(repaired?.questions, req);
    if (p2.ok) profile = p2;
    if (c2.valid.length >= checked.valid.length) checked = c2;
  }

  if (!profile.ok) throw INVALID();
  const minimum = Math.ceil(req.preferences.count * 0.6);
  if (checked.valid.length < minimum) throw INVALID();
  const notice =
    checked.valid.length < req.preferences.count
      ? `Only ${checked.valid.length} of ${req.preferences.count} questions passed the evidence check, so we kept just those.`
      : null;
  return { requestId: req.requestId, profile: profile.value, questions: checked.valid, notice };
}

export async function evaluateAnswer(req: EvaluateRequest): Promise<Evaluation> {
  const call = () =>
    callStructured({
      operation: "evaluate",
      requestId: req.requestId,
      system: EVALUATE_SYSTEM,
      user: evaluateUserMessage(req),
      schema: evaluateSchema,
      maxTokens: 1800,
    });
  let result = validateModelEvaluation(await call());
  if (!result.ok) result = validateModelEvaluation(await call());
  if (!result.ok)
    throw new AppError(
      "INVALID_OUTPUT",
      "The AI returned feedback we could not validate. Your answer is saved; please try again.",
      502,
      true,
    );
  const evaluation = result.value;
  // Score is always computed here from dimension ratings; never accepted from the model or client.
  return { ...evaluation, score: computeScore(evaluation.dimensions) };
}

export async function nextQuestion(req: NextRequest): Promise<DraftQuestion> {
  const user = nextUserMessage(req);
  const run = async (extra?: { role: "assistant" | "user"; content: string }[]) =>
    (await callStructured({
      operation: extra ? "repair" : "next",
      requestId: req.requestId,
      system: NEXT_SYSTEM,
      user,
      schema: nextSchema,
      maxTokens: 900,
      extra,
    })) as { question?: unknown };

  const check = (raw: { question?: unknown }) => {
    const r = validateDraftQuestion(raw?.question);
    if (!r.ok) return { q: null, errors: r.errors };
    let q = { ...r.value, difficulty: req.targetDifficulty, category: req.targetCategory };
    let errors = groundingErrors(q, req.resumeText, req.jdText);
    // A probe builds on its parent's evidence; reuse it if the model's own quote is not exact.
    const parentRef = req.parent?.resumeReference;
    if (errors.length && req.action === "probe" && parentRef && errors.every((e) => e.includes("evidenceQuote"))) {
      q = { ...q, groundingType: "resume", resumeReference: parentRef };
      errors = groundingErrors(q, req.resumeText, req.jdText);
    }
    const avoid = new Set(req.avoidQuestions.map(normalizeForMatch));
    if (avoid.has(normalizeForMatch(q.question))) errors.push("question duplicates an existing question");
    return { q: errors.length ? null : q, errors };
  };

  const first = await run();
  let result = check(first);
  if (!result.q) {
    const second = await run([
      { role: "assistant", content: JSON.stringify(first) },
      {
        role: "user",
        content: `Your output failed validation:\n- ${result.errors.join("\n- ")}\nReturn corrected JSON.`,
      },
    ]);
    result = check(second);
  }
  if (!result.q) throw INVALID();
  return result.q;
}
