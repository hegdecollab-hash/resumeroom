import "server-only";
import { CATEGORIES, DIFFICULTIES, EXAMPLE_TYPES, GROUNDING_TYPES } from "@/lib/interview/types";

/**
 * Strict JSON Schemas for OpenRouter structured outputs. Every property is required and
 * optional values are nullable, as strict mode demands. Responses are still validated
 * server-side with lib/interview/validation.ts.
 */
const nullableString = { type: ["string", "null"] } as const;

const questionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "category",
    "difficulty",
    "question",
    "resumeReference",
    "jdReference",
    "groundingType",
    "whyAsked",
    "expectedConcepts",
  ],
  properties: {
    category: { type: "string", enum: [...CATEGORIES] },
    difficulty: { type: "string", enum: [...DIFFICULTIES] },
    question: { type: "string", description: "The interview question, max 600 characters." },
    resumeReference: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["itemLabel", "evidenceQuote"],
          properties: {
            itemLabel: { type: "string", description: "Resume item, e.g. a project or role name." },
            evidenceQuote: { type: "string", description: "Short EXACT quote copied from the resume." },
          },
        },
        { type: "null" },
      ],
    },
    jdReference: {
      ...nullableString,
      description: "Short EXACT quote from the job description, or null when no JD is used.",
    },
    groundingType: { type: "string", enum: [...GROUNDING_TYPES] },
    whyAsked: { type: "string", description: "One short visible sentence." },
    expectedConcepts: { type: "array", items: { type: "string" }, description: "2 to 5 rubric points." },
  },
} as const;

export const generateSchema = {
  name: "interview_questions",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["profile", "questions"],
    properties: {
      profile: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "projects", "skills", "inferredFocus", "roleGaps"],
        properties: {
          headline: { type: "string" },
          projects: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "evidenceQuote"],
              properties: { name: { type: "string" }, evidenceQuote: { type: "string" } },
            },
          },
          skills: { type: "array", items: { type: "string" } },
          inferredFocus: nullableString,
          roleGaps: { type: "array", items: { type: "string" } },
        },
      },
      questions: { type: "array", items: questionSchema },
    },
  },
} as const;

export const nextSchema = {
  name: "interview_next_question",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["question"],
    properties: { question: questionSchema },
  },
} as const;

const dim = { type: "integer", description: "0-5 per rubric" } as const;

export const evaluateSchema = {
  name: "answer_evaluation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "dimensions",
      "strengths",
      "improvements",
      "missingConcepts",
      "conciseExplanation",
      "exampleAnswer",
      "exampleAnswerType",
      "recommendedProbe",
      "uncertaintyNote",
    ],
    properties: {
      dimensions: {
        type: "object",
        additionalProperties: false,
        required: ["relevance", "accuracyOrSoundness", "depth", "clarity"],
        properties: { relevance: dim, accuracyOrSoundness: dim, depth: dim, clarity: dim },
      },
      strengths: { type: "array", items: { type: "string" } },
      improvements: { type: "array", items: { type: "string" } },
      missingConcepts: { type: "array", items: { type: "string" } },
      conciseExplanation: { type: "string" },
      exampleAnswer: { type: "string" },
      exampleAnswerType: { type: "string", enum: [...EXAMPLE_TYPES] },
      recommendedProbe: nullableString,
      uncertaintyNote: nullableString,
    },
  },
} as const;
