import { beforeEach, describe, expect, it } from "vitest";
import { createSession } from "@/lib/interview/session";
import { SAMPLE_PROFILE, SAMPLE_QUESTIONS, SAMPLE_RESUME } from "@/lib/interview/sample";

class MemoryStorage {
  map = new Map<string, string>();
  quota = Infinity;
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    const size = [...this.map.values()].reduce((a, b) => a + b.length, 0) + v.length;
    if (size > this.quota) throw new DOMException("full", "QuotaExceededError");
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

let store: MemoryStorage;
const make = () =>
  createSession({
    resumeText: SAMPLE_RESUME,
    jdText: null,
    preferences: { focus: "mixed", difficulty: "medium", count: 5 },
    profile: SAMPLE_PROFILE,
    questions: SAMPLE_QUESTIONS,
    source: "sample",
  });

beforeEach(() => {
  store = new MemoryStorage();
  (globalThis as { window?: unknown }).window = { localStorage: store };
});

describe("storage wrapper", async () => {
  const s = await import("@/lib/storage/storage");

  it("saves, lists, loads and deletes with verification", () => {
    const session = make();
    expect(s.saveSession(session, true)).toEqual({ ok: true, persisted: true });
    expect(s.listSessions()[0].id).toBe(session.id);
    const loaded = s.loadSession(session.id);
    expect(loaded.status).toBe("found");
    expect(s.deleteSession(session.id)).toBe(true);
    expect(s.loadSession(session.id).status).toBe("missing");
  });

  it("detects corrupt data", () => {
    store.setItem("resumeroom:v1:session:bad", "{not json");
    expect(s.loadSession("bad").status).toBe("corrupt");
    store.setItem("resumeroom:v1:session:old", JSON.stringify({ id: "old" }));
    expect(s.loadSession("old").status).toBe("corrupt");
  });

  it("falls back to memory on quota errors", () => {
    store.quota = 100;
    const session = make();
    expect(s.saveSession(session, true)).toEqual({ ok: false, problem: "quota" });
    expect(s.loadSession(session.id)).toMatchObject({ status: "found", persisted: false });
    s.deleteAllData();
  });

  it("keeps opted-out sessions in memory only", () => {
    const session = make();
    s.saveSession(session, false);
    expect(store.getItem(`resumeroom:v1:session:${session.id}`)).toBeNull();
    expect(s.loadSession(session.id).status).toBe("found");
    s.deleteAllData();
  });

  it("delete all removes every app key and leaves others", () => {
    s.saveSession(make(), true);
    store.setItem("other-app", "x");
    expect(s.deleteAllData()).toBe(true);
    expect([...store.map.keys()]).toEqual(["other-app"]);
  });

  it("reports unavailable storage", () => {
    (globalThis as { window?: unknown }).window = {
      get localStorage(): Storage {
        throw new DOMException("denied", "SecurityError");
      },
    };
    expect(s.storageAvailable()).toBe(false);
    expect(s.saveSession(make(), true)).toEqual({ ok: false, problem: "unavailable" });
  });
});
