import "server-only";

/**
 * Best-effort, per-instance de-duplication of in-flight requests by client request ID, so a
 * double-submitted request shares one paid call. Entries expire shortly after settling.
 */
const inflight = new Map<string, Promise<unknown>>();

export function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = run().finally(() => setTimeout(() => inflight.delete(key), 30_000));
  inflight.set(key, p);
  return p;
}
