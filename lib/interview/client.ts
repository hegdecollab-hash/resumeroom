"use client";

import type { ApiError } from "./types";

export class ClientApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}

export const newRequestId = () => crypto.randomUUID();

/** POSTs to this app's own /api/interview/* routes. Never to third parties. */
export async function postJson<T>(path: `/api/interview/${string}`, body: unknown, signal?: AbortSignal): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    throw new ClientApiError("OFFLINE", "You're offline. Reconnect and try again; your text is saved here.", true);
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ClientApiError(
      "NETWORK",
      "Network problem. Check your connection and try again; your text is kept.",
      true,
    );
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const e = data as Partial<ApiError> | null;
    throw new ClientApiError(
      e?.code ?? `HTTP_${res.status}`,
      e?.message ?? `The request failed (${res.status}). Please try again.`,
      e?.retryable ?? res.status >= 500,
    );
  }
  return data as T;
}
