"use client";

import * as React from "react";
import toast from "react-hot-toast";
import type { Session } from "@/lib/interview/types";
import { getSettings, loadSession, saveSession } from "@/lib/storage/storage";

export type SessionState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "corrupt" }
  | { status: "ready"; session: Session; persisted: boolean };

/** Loads a session from browser storage and saves it after every update. */
export function useSession(id: string) {
  const [state, setState] = React.useState<SessionState>({ status: "loading" });
  const persistRef = React.useRef(true);
  const warned = React.useRef(false);

  React.useEffect(() => {
    const res = loadSession(id);
    persistRef.current = res.status === "found" ? res.persisted || getSettings().saveSessions : true;
    if (res.status === "found" && !res.persisted) persistRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from browser storage after mount
    setState(
      res.status === "found"
        ? { status: "ready", session: res.session, persisted: res.persisted }
        : { status: res.status },
    );
  }, [id]);

  const update = React.useCallback((fn: (s: Session) => Session) => {
    setState((prev) => {
      if (prev.status !== "ready") return prev;
      const next = { ...fn(prev.session), updatedAt: new Date().toISOString() };
      const res = saveSession(next, persistRef.current);
      let persisted = res.ok ? res.persisted : false;
      if (!res.ok) {
        persistRef.current = false;
        persisted = false;
        if (!warned.current) {
          warned.current = true;
          // Defer side effects out of the state updater.
          queueMicrotask(() =>
            toast.error(
              res.problem === "quota"
                ? "Browser storage is full. We'll keep this session in this tab only. Delete old sessions on the Practice page to save again."
                : "Browser storage is unavailable. We'll keep this session in this tab only.",
              { id: "storage" },
            ),
          );
        }
      }
      return { status: "ready", session: next, persisted };
    });
  }, []);

  return { state, update };
}
