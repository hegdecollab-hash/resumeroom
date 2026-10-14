"use client";

import type { Session } from "@/lib/interview/types";
import { CATEGORIES, DIFFICULTIES } from "@/lib/interview/types";

/**
 * The single typed browser-storage wrapper. Everything lives in localStorage under a
 * versioned prefix. When storage is unavailable, full, or the user opts out, sessions are
 * kept in memory for this tab only.
 */
export const SCHEMA_VERSION = 1;
const PREFIX = "resumeroom";
const VERSION_KEY = `${PREFIX}:schemaVersion`;
const INDEX_KEY = `${PREFIX}:v${SCHEMA_VERSION}:index`;
const SETTINGS_KEY = `${PREFIX}:v${SCHEMA_VERSION}:settings`;
const sessionKey = (id: string) => `${PREFIX}:v${SCHEMA_VERSION}:session:${id}`;

export type StorageProblem = "unavailable" | "quota" | "corrupt";
export type SaveResult = { ok: true; persisted: boolean } | { ok: false; problem: StorageProblem };

export interface SessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: Session["status"];
  questionCount: number;
  answeredCount: number;
  source: Session["source"];
}

export interface Settings {
  saveSessions: boolean;
}

const memory = new Map<string, Session>();

function ls(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    const probe = `${PREFIX}:probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function storageAvailable(): boolean {
  return ls() !== null;
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED" || err.code === 22)
  );
}

function readJson(key: string): unknown {
  const s = ls();
  if (!s) return null;
  const raw = s.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined; // corrupt
  }
}

function ensureVersion(s: Storage) {
  const v = s.getItem(VERSION_KEY);
  if (v !== String(SCHEMA_VERSION)) s.setItem(VERSION_KEY, String(SCHEMA_VERSION));
}

export function getSettings(): Settings {
  const v = readJson(SETTINGS_KEY);
  if (v && typeof v === "object" && typeof (v as Settings).saveSessions === "boolean") return v as Settings;
  return { saveSessions: true };
}

export function setSettings(settings: Settings): boolean {
  const s = ls();
  if (!s) return false;
  try {
    ensureVersion(s);
    s.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** Defensive structural check so corrupt or old data fails gracefully. */
export function isSession(v: unknown): v is Session {
  if (!v || typeof v !== "object") return false;
  const s = v as Session;
  return (
    typeof s.id === "string" &&
    typeof s.createdAt === "string" &&
    typeof s.resumeText === "string" &&
    (s.jdText === null || typeof s.jdText === "string") &&
    !!s.preferences &&
    DIFFICULTIES.includes(s.preferences.difficulty) &&
    !!s.profile &&
    Array.isArray(s.profile.skills) &&
    Array.isArray(s.questions) &&
    s.questions.every(
      (q) =>
        q &&
        typeof q.id === "string" &&
        typeof q.question === "string" &&
        CATEGORIES.includes(q.category) &&
        DIFFICULTIES.includes(q.difficulty) &&
        Array.isArray(q.expectedConcepts),
    ) &&
    Array.isArray(s.attempts) &&
    typeof s.drafts === "object" &&
    s.drafts !== null &&
    typeof s.revealed === "object" &&
    s.revealed !== null &&
    Array.isArray(s.adaptations)
  );
}

function summarize(s: Session): SessionSummary {
  const answered = new Set(s.attempts.filter((a) => a.evaluation).map((a) => a.questionId));
  return {
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    status: s.status,
    source: s.source,
    questionCount: s.questions.filter((q) => q.parentQuestionId === null).length,
    answeredCount: s.questions.filter((q) => q.parentQuestionId === null && answered.has(q.id)).length,
  };
}

function readIndex(): SessionSummary[] {
  const v = readJson(INDEX_KEY);
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is SessionSummary => !!x && typeof x.id === "string" && typeof x.title === "string");
}

export type LoadResult =
  { status: "found"; session: Session; persisted: boolean } | { status: "missing" } | { status: "corrupt" };

export function loadSession(id: string): LoadResult {
  const mem = memory.get(id);
  if (mem) return { status: "found", session: mem, persisted: false };
  const v = readJson(sessionKey(id));
  if (v === null) return { status: "missing" };
  if (v === undefined || !isSession(v)) return { status: "corrupt" };
  return { status: "found", session: v, persisted: true };
}

export function listSessions(): SessionSummary[] {
  const persisted = readIndex();
  const mem = [...memory.values()].map(summarize);
  return [...mem, ...persisted.filter((p) => !memory.has(p.id))].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Saves a session. With persist=false (opt-out or after a storage failure) it is kept in
 * memory for this tab only.
 */
export function saveSession(session: Session, persist: boolean): SaveResult {
  if (!persist) {
    memory.set(session.id, session);
    return { ok: true, persisted: false };
  }
  const s = ls();
  if (!s) {
    memory.set(session.id, session);
    return { ok: false, problem: "unavailable" };
  }
  try {
    ensureVersion(s);
    s.setItem(sessionKey(session.id), JSON.stringify(session));
    const index = readIndex().filter((x) => x.id !== session.id);
    index.unshift(summarize(session));
    s.setItem(INDEX_KEY, JSON.stringify(index));
    memory.delete(session.id);
    return { ok: true, persisted: true };
  } catch (err) {
    memory.set(session.id, session);
    return { ok: false, problem: isQuotaError(err) ? "quota" : "unavailable" };
  }
}

/** Deletes a session and verifies removal. */
export function deleteSession(id: string): boolean {
  memory.delete(id);
  const s = ls();
  if (!s) return true;
  try {
    s.removeItem(sessionKey(id));
    s.setItem(INDEX_KEY, JSON.stringify(readIndex().filter((x) => x.id !== id)));
  } catch {
    return false;
  }
  return s.getItem(sessionKey(id)) === null && !readIndex().some((x) => x.id === id);
}

/** Removes every key this app created (all versions) and verifies removal. */
export function deleteAllData(): boolean {
  memory.clear();
  const s = ls();
  if (!s) return true;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(`${PREFIX}:`)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
    for (let i = 0; i < s.length; i++) if (s.key(i)?.startsWith(`${PREFIX}:`)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Draft of the practice form (reviewed resume text, JD, preferences) before a session exists. */
const DRAFT_KEY = `${PREFIX}:v${SCHEMA_VERSION}:practiceDraft`;
export interface PracticeDraft {
  resumeText: string;
  jdText: string;
  fileName: string | null;
}

export function loadPracticeDraft(): PracticeDraft | null {
  const v = readJson(DRAFT_KEY);
  if (!v || typeof v !== "object") return null;
  const d = v as PracticeDraft;
  return typeof d.resumeText === "string" && typeof d.jdText === "string" ? d : null;
}

export function savePracticeDraft(draft: PracticeDraft | null): void {
  const s = ls();
  if (!s || !getSettings().saveSessions) return;
  try {
    if (draft === null) s.removeItem(DRAFT_KEY);
    else s.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* draft autosave is best effort */
  }
}
