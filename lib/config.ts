export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "ResumeRoom";

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");

export const LIMITS = {
  pdfBytes: 10 * 1024 * 1024,
  pdfPages: 10,
  resumeChars: 30_000,
  jdChars: 15_000,
  answerChars: 8_000,
  minResumeChars: 200,
  minAnswerChars: 1,
  maxProbesPerQuestion: 2,
} as const;
