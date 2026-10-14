import "server-only";
import { AppError } from "./errors";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 50_000;

export interface JsonSchemaFormat {
  name: string;
  strict: boolean;
  schema: unknown;
}

export interface CallOptions {
  operation: "generate" | "evaluate" | "next" | "repair";
  requestId: string;
  system: string;
  user: string;
  schema: JsonSchemaFormat;
  maxTokens: number;
  /** Optional extra turns, e.g. for a bounded repair call. */
  extra?: { role: "assistant" | "user"; content: string }[];
}

export function getConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim();
  if (!apiKey || !model)
    throw new AppError("NOT_CONFIGURED", "Question generation isn't available yet. Check back soon.", 503);
  return { apiKey, model };
}

/** Logs only metadata. Never user text, credentials, or payloads. */
function log(entry: Record<string, string | number | null>) {
  console.info(JSON.stringify({ scope: "openrouter", ...entry }));
}

function mapStatus(status: number, providerMessage: string): AppError {
  if (status === 400) return new AppError("PROVIDER_BAD_REQUEST", "The AI provider rejected the request.", 502);
  if (status === 401 || status === 403)
    return new AppError(
      "PROVIDER_AUTH",
      "The AI service credentials were rejected. The site owner needs to check the key.",
      502,
    );
  if (status === 402)
    return new AppError(
      "INSUFFICIENT_CREDITS",
      "Practice is paused while we top up AI capacity. Try again later.",
      402,
    );
  if (status === 404 || /no endpoints? found/i.test(providerMessage))
    return new AppError("MODEL_UNAVAILABLE", "The AI model is unavailable right now. Try again shortly.", 502);
  if (status === 408) return new AppError("PROVIDER_TIMEOUT", "The AI took too long to respond. Try again.", 504, true);
  if (status === 429)
    return new AppError(
      "PROVIDER_RATE_LIMITED",
      "The AI is handling a lot of requests. Wait a moment and try again.",
      429,
      true,
    );
  return new AppError("PROVIDER_ERROR", "The AI couldn't complete this request. Try again.", 502, true);
}

async function once(opts: CallOptions, apiKey: string, model: string): Promise<unknown> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(appUrl ? { "HTTP-Referer": appUrl } : {}),
        "X-Title": process.env.NEXT_PUBLIC_APP_NAME?.trim() || "ResumeRoom",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
          ...(opts.extra ?? []),
        ],
        response_format: { type: "json_schema", json_schema: opts.schema },
        provider: { require_parameters: true },
        max_tokens: opts.maxTokens,
        temperature: opts.operation === "evaluate" ? 0.2 : 0.6,
        stream: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError")
      throw new AppError("PROVIDER_TIMEOUT", "The AI took too long to respond. Try again.", 504, true);
    throw new AppError("PROVIDER_UNREACHABLE", "We couldn't reach the AI. Try again.", 502, true);
  }

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = (json?.error as { message?: string } | undefined)?.message ?? "";
    throw mapStatus(res.status, err);
  }
  // OpenRouter can return 200 with an error object (e.g. mid-generation provider failure).
  if (json?.error) {
    const e = json.error as { code?: number; message?: string };
    throw mapStatus(typeof e.code === "number" ? e.code : 502, e.message ?? "");
  }

  const choice = (json?.choices as { message?: { content?: unknown }; finish_reason?: string }[] | undefined)?.[0];
  const usage = json?.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
  log({
    requestId: opts.requestId,
    operation: opts.operation,
    model: typeof json?.model === "string" ? json.model : model,
    promptTokens: usage?.prompt_tokens ?? null,
    completionTokens: usage?.completion_tokens ?? null,
  });

  if (!choice) throw new AppError("EMPTY_RESPONSE", "The AI didn't return a response. Try again.", 502, true);
  if (choice.finish_reason === "length")
    throw new AppError("OUTPUT_TRUNCATED", "The AI response was cut off. Try fewer questions or shorter text.", 502);
  const content = choice.message?.content;
  if (typeof content !== "string" || content.trim() === "")
    throw new AppError("EMPTY_RESPONSE", "The AI returned an empty response. Try again.", 502, true);
  try {
    return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new AppError("MALFORMED_OUTPUT", "The AI returned a response we couldn't read. Try again.", 502, true);
  }
}

/** Calls OpenRouter once, retrying a single time with backoff on transient failures only. */
export async function callStructured(opts: CallOptions): Promise<unknown> {
  const { apiKey, model } = getConfig();
  const started = Date.now();
  try {
    try {
      return await once(opts, apiKey, model);
    } catch (err) {
      if (!(err instanceof AppError) || !err.retryable || err.code === "MALFORMED_OUTPUT") throw err;
      await new Promise((r) => setTimeout(r, 1200));
      return await once(opts, apiKey, model);
    }
  } catch (err) {
    log({
      requestId: opts.requestId,
      operation: opts.operation,
      model,
      status: err instanceof AppError ? err.code : "UNKNOWN",
      durationMs: Date.now() - started,
    });
    throw err;
  } finally {
    log({
      requestId: opts.requestId,
      operation: opts.operation,
      model,
      durationMs: Date.now() - started,
      status: "done",
    });
  }
}
