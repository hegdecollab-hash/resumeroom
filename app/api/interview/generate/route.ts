import { generateQuestions } from "@/lib/ai/interview";
import { dedupe } from "@/lib/ai/dedupe";
import { AppError } from "@/lib/ai/errors";
import { LIMITS } from "@/lib/config";
import { validateGenerateRequest } from "@/lib/interview/validation";
import { generateLimiter } from "@/lib/security/limiter";
import { errorResponse, fallbackRequestId, guardedBody, json, peekRequestId } from "@/lib/security/http";

export const maxDuration = 60;

const MAX_BYTES = (LIMITS.resumeChars + LIMITS.jdChars) * 4 + 4096;

export async function POST(req: Request) {
  let requestId = fallbackRequestId();
  try {
    const body = await guardedBody(req, { maxBytes: MAX_BYTES, limiter: generateLimiter });
    requestId = peekRequestId(body) ?? requestId;
    const parsed = validateGenerateRequest(body);
    if (!parsed.ok) throw new AppError("INVALID_REQUEST", parsed.errors[0], 400);
    const result = await dedupe(`gen:${parsed.value.requestId}`, () => generateQuestions(parsed.value));
    return json(result);
  } catch (err) {
    return errorResponse(err, requestId);
  }
}
