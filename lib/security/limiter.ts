/**
 * Best-effort in-memory sliding-window limiter. It is per server instance and resets on
 * restart or across serverless instances, so it is NOT a guarantee. The real protection for a
 * public launch is a spend/credit limit on the OpenRouter key.
 */
export interface LimiterOptions {
  limit: number;
  windowMs: number;
}

export function createLimiter({ limit, windowMs }: LimiterOptions) {
  const hits = new Map<string, number[]>();
  return {
    check(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterSec: Math.ceil((windowMs - (now - recent[0])) / 1000) };
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
      }
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

const intFromEnv = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const HOUR = 60 * 60 * 1000;
export const generateLimiter = createLimiter({ limit: intFromEnv("RATE_LIMIT_GENERATE_PER_HOUR", 5), windowMs: HOUR });
export const evaluateLimiter = createLimiter({ limit: intFromEnv("RATE_LIMIT_EVALUATE_PER_HOUR", 30), windowMs: HOUR });

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
