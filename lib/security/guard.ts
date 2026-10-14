import "server-only";
import { AppError } from "@/lib/ai/errors";

/** Same-origin check using Origin (or Referer) against Host and the configured app URL. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) throw new AppError("FORBIDDEN_ORIGIN", "Requests must come from this site.", 403);
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN_ORIGIN", "Requests must come from this site.", 403);
  }
  const allowed = new Set<string>();
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) allowed.add(host);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).host);
    } catch {
      /* ignore malformed config */
    }
  }
  if (!allowed.has(originHost)) throw new AppError("FORBIDDEN_ORIGIN", "Requests must come from this site.", 403);
}

/** Reads a JSON body with a hard byte cap. */
export async function readJsonBody(req: Request, maxBytes: number): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json"))
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Send the request as JSON.", 415);
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes)
    throw new AppError("PAYLOAD_TOO_LARGE", "This request is too large. Shorten your text and try again.", 413);
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes)
    throw new AppError("PAYLOAD_TOO_LARGE", "This request is too large. Shorten your text and try again.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("INVALID_JSON", "The request body is not valid JSON.", 400);
  }
}
