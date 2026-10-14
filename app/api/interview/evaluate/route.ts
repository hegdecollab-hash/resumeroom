import { evaluateAnswer } from "@/lib/ai/interview";
import { dedupe } from "@/lib/ai/dedupe";
import { AppError } from "@/lib/ai/errors";
import { LIMITS } from "@/lib/config";
import type { EvaluateResponse } from "@/lib/interview/types";
import { validateEvaluateRequest } from "@/lib/interview/validation";
import { evaluateLimiter } from "@/lib/security/limiter";
import { errorResponse, fallbackRequestId, guardedBody, json, peekRequestId } from "@/lib/security/http";

export const maxDuration = 60;

const MAX_BYTES = (LIMITS.resumeChars + LIMITS.jdChars + LIMITS.answerChars) * 4 + 16_384;

export async function POST(req: Request) {
  let requestId = fallbackRequestId();
  try {
    const body = await guardedBody(req, { maxBytes: MAX_BYTES, limiter: evaluateLimiter });
    requestId = peekRequestId(body) ?? requestId;
    const parsed = validateEvaluateRequest(body);
    if (!parsed.ok) throw new AppError("INVALID_REQUEST", parsed.errors[0], 400);
    const evaluation = await dedupe(`eval:${parsed.value.requestId}`, () => evaluateAnswer(parsed.value));
    const response: EvaluateResponse = { requestId: parsed.value.requestId, evaluation };
    return json(response);
  } catch (err) {
    return errorResponse(err, requestId);
  }
}
