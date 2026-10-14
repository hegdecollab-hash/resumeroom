import "server-only";
import { AppError } from "@/lib/ai/errors";
import type { ApiError } from "@/lib/interview/types";
import { clientIp } from "./limiter";
import { assertSameOrigin, readJsonBody } from "./guard";

const NO_STORE = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

export function errorResponse(err: unknown, requestId: string) {
  if (err instanceof AppError) {
    const body: ApiError = { code: err.code, message: err.message, retryable: err.retryable, requestId };
    return json(body, err.status);
  }
  console.error(JSON.stringify({ scope: "api", requestId, status: "UNEXPECTED" }));
  const body: ApiError = {
    code: "INTERNAL_ERROR",
    message: "We hit a problem on our end. Your text is still here. Try again in a moment.",
    retryable: true,
    requestId,
  };
  return json(body, 500);
}

export const fallbackRequestId = () => `srv-${crypto.randomUUID()}`;

export function peekRequestId(body: unknown): string | null {
  if (body && typeof body === "object" && "requestId" in body) {
    const id = (body as { requestId: unknown }).requestId;
    if (typeof id === "string" && /^[A-Za-z0-9-]{8,64}$/.test(id)) return id;
  }
  return null;
}

/** Shared preamble: same-origin, rate limit, body cap, JSON parse. */
export async function guardedBody(
  req: Request,
  opts: { maxBytes: number; limiter: { check(key: string): { allowed: boolean; retryAfterSec: number } } },
): Promise<unknown> {
  assertSameOrigin(req);
  const body = await readJsonBody(req, opts.maxBytes);
  const verdict = opts.limiter.check(clientIp(req));
  if (!verdict.allowed)
    throw new AppError(
      "RATE_LIMITED",
      `You've reached the practice limit for now. Try again in about ${Math.max(1, Math.ceil(verdict.retryAfterSec / 60))} minutes.`,
      429,
    );
  return body;
}
