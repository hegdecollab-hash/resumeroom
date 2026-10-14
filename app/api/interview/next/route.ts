import { nextQuestion } from "@/lib/ai/interview";
import { dedupe } from "@/lib/ai/dedupe";
import { AppError } from "@/lib/ai/errors";
import { LIMITS } from "@/lib/config";
import type { NextResponse } from "@/lib/interview/types";
import { validateNextRequest } from "@/lib/interview/validation";
import { evaluateLimiter } from "@/lib/security/limiter";
import { errorResponse, fallbackRequestId, guardedBody, json, peekRequestId } from "@/lib/security/http";

export const maxDuration = 60;

const MAX_BYTES = (LIMITS.resumeChars + LIMITS.jdChars + LIMITS.answerChars) * 4 + 65_536;

export async function POST(req: Request) {
  let requestId = fallbackRequestId();
  try {
    // Probes and adaptations share the evaluation budget.
    const body = await guardedBody(req, { maxBytes: MAX_BYTES, limiter: evaluateLimiter });
    requestId = peekRequestId(body) ?? requestId;
    const parsed = validateNextRequest(body);
    if (!parsed.ok) throw new AppError("INVALID_REQUEST", parsed.errors[0], 400);
    const question = await dedupe(`next:${parsed.value.requestId}`, () => nextQuestion(parsed.value));
    const response: NextResponse = { requestId: parsed.value.requestId, question };
    return json(response);
  } catch (err) {
    return errorResponse(err, requestId);
  }
}
