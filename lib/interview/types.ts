export const CATEGORIES = ["behavioral", "technical", "project"] as const;
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const FOCUSES = ["mixed", "behavioral", "technical"] as const;
export const QUESTION_COUNTS = [5, 10, 15] as const;
export const GROUNDING_TYPES = ["resume", "role_gap"] as const;
export const EXAMPLE_TYPES = ["technical_example", "behavioral_structure"] as const;
export const DIMENSIONS = ["relevance", "accuracyOrSoundness", "depth", "clarity"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type Focus = (typeof FOCUSES)[number];
export type QuestionCount = (typeof QUESTION_COUNTS)[number];
export type GroundingType = (typeof GROUNDING_TYPES)[number];
export type ExampleAnswerType = (typeof EXAMPLE_TYPES)[number];
export type Dimension = (typeof DIMENSIONS)[number];

export interface Preferences {
  focus: Focus;
  difficulty: Difficulty;
  count: QuestionCount;
}

export const DEFAULT_PREFERENCES: Preferences = { focus: "mixed", difficulty: "medium", count: 10 };

export interface ProfileProject {
  name: string;
  evidenceQuote: string;
}

export interface ProfileSummary {
  headline: string;
  projects: ProfileProject[];
  skills: string[];
  /** Labeled inference of a broad practice focus. Null when not inferable. */
  inferredFocus: string | null;
  /** Set by the server, never by the model. */
  jdProvided: boolean;
  /** JD-only requirements not supported by the resume. Always empty without a JD. */
  roleGaps: string[];
}

export interface ResumeReference {
  itemLabel: string;
  evidenceQuote: string;
}

export interface Question {
  id: string;
  category: Category;
  difficulty: Difficulty;
  question: string;
  resumeReference: ResumeReference | null;
  jdReference: string | null;
  groundingType: GroundingType;
  whyAsked: string;
  expectedConcepts: string[];
  parentQuestionId: string | null;
  followUpDepth: number;
}

/** A question as produced by the model, before the app assigns ids and links. */
export type DraftQuestion = Omit<Question, "id" | "parentQuestionId" | "followUpDepth">;

export type DimensionScores = Record<Dimension, number>;

export interface Evaluation {
  dimensions: DimensionScores;
  /** Computed by the server: sum(dimensions) / 2, range 0-10. */
  score: number;
  strengths: string[];
  improvements: string[];
  missingConcepts: string[];
  conciseExplanation: string;
  exampleAnswer: string;
  exampleAnswerType: ExampleAnswerType;
  recommendedProbe: string | null;
  uncertaintyNote: string | null;
}

/** Evaluation as produced by the model; the score is never accepted from it. */
export type ModelEvaluation = Omit<Evaluation, "score">;

export interface Attempt {
  id: string;
  questionId: string;
  attemptIndex: number;
  answerText: string;
  evaluation: Evaluation | null;
  wasAssisted: boolean;
  wasSkipped: boolean;
  createdAt: string;
}

export interface AdaptationRecord {
  /** Base question whose answer triggered the decision. */
  triggerQuestionId: string;
  targetQuestionId: string;
  from: Difficulty;
  to: Difficulty;
  reason: string;
  applied: boolean;
}

export type SessionStatus = "active" | "finished";
export type SessionSource = "ai" | "sample";

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  source: SessionSource;
  resumeText: string;
  jdText: string | null;
  preferences: Preferences;
  profile: ProfileSummary;
  questions: Question[];
  attempts: Attempt[];
  drafts: Record<string, string>;
  /** Question ids whose expected concepts or example answer were revealed. */
  revealed: Record<string, boolean>;
  adaptations: AdaptationRecord[];
  currentQuestionId: string | null;
  status: SessionStatus;
  notice: string | null;
}

export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
}

export interface GenerateRequest {
  requestId: string;
  resumeText: string;
  jdText: string | null;
  preferences: Preferences;
}

export interface GenerateResponse {
  requestId: string;
  profile: ProfileSummary;
  questions: DraftQuestion[];
  notice: string | null;
}

export interface EvaluateRequest {
  requestId: string;
  question: DraftQuestion;
  resumeExcerpt: string;
  profile: ProfileSummary;
  jdText: string | null;
  answerText: string;
}

export interface EvaluateResponse {
  requestId: string;
  evaluation: Evaluation;
}

export type NextAction = "probe" | "adapt";

export interface AnsweredSummary {
  question: string;
  category: Category;
  answerExcerpt: string;
  score: number | null;
}

export interface NextRequest {
  requestId: string;
  action: NextAction;
  targetDifficulty: Difficulty;
  targetCategory: Category;
  profile: ProfileSummary;
  resumeText: string;
  jdText: string | null;
  answered: AnsweredSummary[];
  /** For probes: the base/parent question and the answer being probed. */
  parent: {
    question: string;
    answerText: string;
    recommendedProbe: string | null;
    /** Parent question evidence, reused if a probe's own quote fails validation. */
    resumeReference: ResumeReference | null;
  } | null;
  avoidQuestions: string[];
}

export interface NextResponse {
  requestId: string;
  question: DraftQuestion;
}
