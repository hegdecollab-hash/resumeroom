import { LIMITS } from "@/lib/config";
import {
  CATEGORIES,
  DIFFICULTIES,
  DIMENSIONS,
  EXAMPLE_TYPES,
  FOCUSES,
  GROUNDING_TYPES,
  QUESTION_COUNTS,
  type AnsweredSummary,
  type DraftQuestion,
  type EvaluateRequest,
  type GenerateRequest,
  type ModelEvaluation,
  type NextRequest,
  type Preferences,
  type ProfileSummary,
} from "./types";
import { optionalText, quoteAppearsIn } from "./text";

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function str(
  o: Obj,
  key: string,
  errors: string[],
  { min = 1, max = 2000, path = key }: { min?: number; max?: number; path?: string } = {},
): string {
  const v = o[key];
  if (typeof v !== "string") {
    errors.push(`${path} must be a string`);
    return "";
  }
  const len = v.trim().length;
  if (len < min) errors.push(`${path} is too short`);
  if (v.length > max) errors.push(`${path} exceeds ${max} characters`);
  return v.trim();
}

function nullableStr(o: Obj, key: string, errors: string[], max = 2000, path = key): string | null {
  const v = o[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") {
    errors.push(`${path} must be a string or null`);
    return null;
  }
  if (v.length > max) errors.push(`${path} exceeds ${max} characters`);
  return optionalText(v)?.trim() ?? null;
}

function oneOf<T extends string>(o: Obj, key: string, allowed: readonly T[], errors: string[], path = key): T {
  const v = o[key];
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    errors.push(`${path} must be one of ${allowed.join(", ")}`);
    return allowed[0];
  }
  return v as T;
}

function strArray(
  o: Obj,
  key: string,
  errors: string[],
  { min = 0, max = 10, itemMax = 300, unique = true, path = key } = {},
): string[] {
  const v = o[key];
  if (!Array.isArray(v)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  if (v.length < min) errors.push(`${path} needs at least ${min} items`);
  if (v.length > max) errors.push(`${path} allows at most ${max} items`);
  const out: string[] = [];
  v.forEach((item, i) => {
    if (typeof item !== "string" || item.trim().length === 0) errors.push(`${path}[${i}] must be a non-empty string`);
    else if (item.length > itemMax) errors.push(`${path}[${i}] is too long`);
    else out.push(item.trim());
  });
  if (unique && new Set(out.map((s) => s.toLowerCase())).size !== out.length) errors.push(`${path} has duplicates`);
  return out;
}

export function validatePreferences(v: unknown, errors: string[]): Preferences {
  if (!isObj(v)) {
    errors.push("preferences must be an object");
    return { focus: "mixed", difficulty: "medium", count: 10 };
  }
  const count = v.count;
  if (typeof count !== "number" || !(QUESTION_COUNTS as readonly number[]).includes(count))
    errors.push("preferences.count must be 5, 10 or 15");
  return {
    focus: oneOf(v, "focus", FOCUSES, errors, "preferences.focus"),
    difficulty: oneOf(v, "difficulty", DIFFICULTIES, errors, "preferences.difficulty"),
    count: (QUESTION_COUNTS as readonly number[]).includes(count as number) ? (count as 5 | 10 | 15) : 10,
  };
}

function requestId(o: Obj, errors: string[]): string {
  const id = o.requestId;
  if (typeof id !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    errors.push("requestId is invalid");
    return "";
  }
  return id;
}

function boundedText(o: Obj, key: string, max: number, errors: string[], label: string, min = 1): string {
  const v = o[key];
  if (typeof v !== "string") {
    errors.push(`${label} is required`);
    return "";
  }
  if (v.trim().length < min) errors.push(`${label} is too short`);
  if (v.length > max) errors.push(`${label} exceeds the ${max.toLocaleString("en-US")} character limit`);
  return v;
}

function optionalBoundedText(o: Obj, key: string, max: number, errors: string[], label: string): string | null {
  const v = o[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") {
    errors.push(`${label} must be text`);
    return null;
  }
  if (v.length > max) errors.push(`${label} exceeds the ${max.toLocaleString("en-US")} character limit`);
  return optionalText(v);
}

export function validateGenerateRequest(body: unknown): Result<GenerateRequest> {
  const errors: string[] = [];
  if (!isObj(body)) return { ok: false, errors: ["Request body must be a JSON object"] };
  const value: GenerateRequest = {
    requestId: requestId(body, errors),
    resumeText: boundedText(body, "resumeText", LIMITS.resumeChars, errors, "Resume text", LIMITS.minResumeChars),
    jdText: optionalBoundedText(body, "jdText", LIMITS.jdChars, errors, "Job description"),
    preferences: validatePreferences(body.preferences, errors),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/** Structural validation of a question (model output or client echo). Grounding is checked separately. */
export function validateDraftQuestion(v: unknown, path = "question"): Result<DraftQuestion> {
  const errors: string[] = [];
  if (!isObj(v)) return { ok: false, errors: [`${path} must be an object`] };
  let resumeReference: DraftQuestion["resumeReference"] = null;
  if (v.resumeReference !== null && v.resumeReference !== undefined) {
    if (!isObj(v.resumeReference)) errors.push(`${path}.resumeReference must be an object or null`);
    else
      resumeReference = {
        itemLabel: str(v.resumeReference, "itemLabel", errors, { max: 160, path: `${path}.resumeReference.itemLabel` }),
        evidenceQuote: str(v.resumeReference, "evidenceQuote", errors, {
          min: 3,
          max: 400,
          path: `${path}.resumeReference.evidenceQuote`,
        }),
      };
  }
  const value: DraftQuestion = {
    category: oneOf(v, "category", CATEGORIES, errors, `${path}.category`),
    difficulty: oneOf(v, "difficulty", DIFFICULTIES, errors, `${path}.difficulty`),
    question: str(v, "question", errors, { min: 10, max: 600, path: `${path}.question` }),
    resumeReference,
    jdReference: nullableStr(v, "jdReference", errors, 400, `${path}.jdReference`),
    groundingType: oneOf(v, "groundingType", GROUNDING_TYPES, errors, `${path}.groundingType`),
    whyAsked: str(v, "whyAsked", errors, { min: 5, max: 400, path: `${path}.whyAsked` }),
    expectedConcepts: strArray(v, "expectedConcepts", errors, {
      min: 2,
      max: 5,
      itemMax: 200,
      path: `${path}.expectedConcepts`,
    }),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/**
 * Checks evidence against the submitted text. Resume-grounded questions need an exact
 * resume quote; role-gap questions need genuine JD evidence and a JD.
 */
export function groundingErrors(
  q: DraftQuestion,
  resumeText: string,
  jdText: string | null,
  path = "question",
): string[] {
  const errors: string[] = [];
  if (q.groundingType === "resume") {
    if (!q.resumeReference) errors.push(`${path}: resume-grounded question needs a resumeReference`);
    else if (!quoteAppearsIn(q.resumeReference.evidenceQuote, resumeText))
      errors.push(`${path}: evidenceQuote is not an exact quote from the resume`);
  } else {
    if (!jdText) errors.push(`${path}: role_gap questions require a job description`);
    else if (!q.jdReference || !quoteAppearsIn(q.jdReference, jdText))
      errors.push(`${path}: role_gap jdReference must quote the job description`);
    if (q.resumeReference && !quoteAppearsIn(q.resumeReference.evidenceQuote, resumeText))
      errors.push(`${path}: evidenceQuote is not an exact quote from the resume`);
  }
  if (q.jdReference && jdText && !quoteAppearsIn(q.jdReference, jdText))
    errors.push(`${path}: jdReference must quote the job description`);
  if (q.jdReference && !jdText) errors.push(`${path}: jdReference must be null without a job description`);
  return errors;
}

export function validateProfile(v: unknown, resumeText: string, jdText: string | null): Result<ProfileSummary> {
  const errors: string[] = [];
  if (!isObj(v)) return { ok: false, errors: ["profile must be an object"] };
  const projectsRaw = Array.isArray(v.projects) ? v.projects : [];
  if (!Array.isArray(v.projects)) errors.push("profile.projects must be an array");
  if (projectsRaw.length > 8) errors.push("profile.projects allows at most 8 items");
  const projects: ProfileSummary["projects"] = [];
  projectsRaw.forEach((p, i) => {
    if (!isObj(p)) return errors.push(`profile.projects[${i}] must be an object`);
    const name = str(p, "name", errors, { max: 160, path: `profile.projects[${i}].name` });
    const evidenceQuote = str(p, "evidenceQuote", errors, {
      min: 3,
      max: 400,
      path: `profile.projects[${i}].evidenceQuote`,
    });
    // Drop ungrounded project evidence rather than display it as grounded.
    if (evidenceQuote && quoteAppearsIn(evidenceQuote, resumeText)) projects.push({ name, evidenceQuote });
  });
  const value: ProfileSummary = {
    headline: str(v, "headline", errors, { min: 3, max: 300, path: "profile.headline" }),
    projects,
    skills: strArray(v, "skills", errors, { max: 25, itemMax: 80, path: "profile.skills" }),
    inferredFocus: nullableStr(v, "inferredFocus", errors, 300, "profile.inferredFocus"),
    jdProvided: Boolean(jdText),
    roleGaps: jdText ? strArray(v, "roleGaps", errors, { max: 12, itemMax: 160, path: "profile.roleGaps" }) : [],
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function validateModelEvaluation(v: unknown): Result<ModelEvaluation> {
  const errors: string[] = [];
  if (!isObj(v)) return { ok: false, errors: ["evaluation must be an object"] };
  const dims = isObj(v.dimensions) ? v.dimensions : {};
  if (!isObj(v.dimensions)) errors.push("dimensions must be an object");
  const dimensions = {} as ModelEvaluation["dimensions"];
  for (const d of DIMENSIONS) {
    const n = dims[d];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 5) {
      errors.push(`dimensions.${d} must be an integer 0-5`);
      dimensions[d] = 0;
    } else dimensions[d] = n;
  }
  const value: ModelEvaluation = {
    dimensions,
    strengths: strArray(v, "strengths", errors, { max: 5, itemMax: 400, unique: false }),
    improvements: strArray(v, "improvements", errors, { max: 6, itemMax: 400, unique: false }),
    missingConcepts: strArray(v, "missingConcepts", errors, { max: 6, itemMax: 200, unique: false }),
    conciseExplanation: str(v, "conciseExplanation", errors, { min: 5, max: 1200 }),
    exampleAnswer: str(v, "exampleAnswer", errors, { min: 10, max: 4000 }),
    exampleAnswerType: oneOf(v, "exampleAnswerType", EXAMPLE_TYPES, errors),
    recommendedProbe: nullableStr(v, "recommendedProbe", errors, 600),
    uncertaintyNote: nullableStr(v, "uncertaintyNote", errors, 600),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function validateEvaluateRequest(body: unknown): Result<EvaluateRequest> {
  const errors: string[] = [];
  if (!isObj(body)) return { ok: false, errors: ["Request body must be a JSON object"] };
  if ("score" in body) errors.push("score is computed by the server and must not be sent");
  const q = validateDraftQuestion(body.question);
  if (!q.ok) errors.push(...q.errors);
  const resumeExcerpt = boundedText(body, "resumeExcerpt", LIMITS.resumeChars, errors, "Resume text");
  const jdText = optionalBoundedText(body, "jdText", LIMITS.jdChars, errors, "Job description");
  const profile = validateProfile(body.profile, resumeExcerpt, jdText);
  if (!profile.ok) errors.push(...profile.errors);
  const value = {
    requestId: requestId(body, errors),
    question: q.ok ? q.value : (null as never),
    resumeExcerpt,
    profile: profile.ok ? profile.value : (null as never),
    jdText,
    answerText: boundedText(body, "answerText", LIMITS.answerChars, errors, "Answer", LIMITS.minAnswerChars),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function validateNextRequest(body: unknown): Result<NextRequest> {
  const errors: string[] = [];
  if (!isObj(body)) return { ok: false, errors: ["Request body must be a JSON object"] };
  const action = oneOf(body, "action", ["probe", "adapt"] as const, errors);
  const resumeText = boundedText(body, "resumeText", LIMITS.resumeChars, errors, "Resume text", LIMITS.minResumeChars);
  const jdText = optionalBoundedText(body, "jdText", LIMITS.jdChars, errors, "Job description");
  const profile = validateProfile(body.profile, resumeText, jdText);
  if (!profile.ok) errors.push(...profile.errors);

  const answered: AnsweredSummary[] = [];
  if (!Array.isArray(body.answered) || body.answered.length > 40)
    errors.push("answered must be an array of up to 40 items");
  else
    body.answered.forEach((a, i) => {
      if (!isObj(a)) return errors.push(`answered[${i}] must be an object`);
      const score = a.score;
      if (score !== null && (typeof score !== "number" || score < 0 || score > 10))
        errors.push(`answered[${i}].score is invalid`);
      answered.push({
        question: str(a, "question", errors, { max: 600, path: `answered[${i}].question` }),
        category: oneOf(a, "category", CATEGORIES, errors, `answered[${i}].category`),
        answerExcerpt: str(a, "answerExcerpt", errors, { min: 0, max: 600, path: `answered[${i}].answerExcerpt` }),
        score: typeof score === "number" ? score : null,
      });
    });

  let parent: NextRequest["parent"] = null;
  if (action === "probe") {
    if (!isObj(body.parent)) errors.push("parent is required for probes");
    else
      parent = {
        question: str(body.parent, "question", errors, { min: 10, max: 600, path: "parent.question" }),
        answerText: boundedText(body.parent, "answerText", LIMITS.answerChars, errors, "Answer"),
        recommendedProbe: nullableStr(body.parent, "recommendedProbe", errors, 600, "parent.recommendedProbe"),
        resumeReference: isObj(body.parent.resumeReference)
          ? {
              itemLabel: str(body.parent.resumeReference, "itemLabel", errors, {
                max: 160,
                path: "parent.resumeReference.itemLabel",
              }),
              evidenceQuote: str(body.parent.resumeReference, "evidenceQuote", errors, {
                min: 3,
                max: 400,
                path: "parent.resumeReference.evidenceQuote",
              }),
            }
          : null,
      };
  }
  const avoid = isObj(body) ? strArray(body, "avoidQuestions", errors, { max: 40, itemMax: 600, unique: false }) : [];

  const value: NextRequest = {
    requestId: requestId(body, errors),
    action,
    targetDifficulty: oneOf(body, "targetDifficulty", DIFFICULTIES, errors),
    targetCategory: oneOf(body, "targetCategory", CATEGORIES, errors),
    profile: profile.ok ? profile.value : (null as never),
    resumeText,
    jdText,
    answered,
    parent,
    avoidQuestions: avoid,
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
