"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteAllData, deleteSession, type SessionSummary } from "@/lib/storage/storage";

export function SavedSessions({ sessions, onChange }: { sessions: SessionSummary[]; onChange: () => void }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Saved on this device</h2>
        {sessions.length ? (
          <ConfirmDialog
            trigger={<Button variant="ghost">Delete all data</Button>}
            title="Delete all your data?"
            description="Every session, draft and setting saved in this browser will be removed. This can't be undone."
            confirmLabel="Delete everything"
            onConfirm={() => {
              const ok = deleteAllData();
              onChange();
              if (ok) toast.success("All ResumeRoom data deleted from this browser.", { id: "delete-all" });
              else
                toast.error("Some data couldn't be deleted. Clear site data in your browser settings to finish.", {
                  id: "delete-all",
                });
            }}
          />
        ) : null}
      </div>
      <p className="text-ink-faint mt-1">
        Stored only in this browser. Clearing site data or switching browsers removes them.
      </p>
      {sessions.length === 0 ? (
        <p className="bg-muted text-ink-soft mt-4 rounded-[var(--radius-control)] p-4">
          No sessions yet. Generate your first set of questions and it will appear here.
        </p>
      ) : (
        <ul className="divide-line mt-4 divide-y">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link href={`/session/${s.id}`} className="text-ink hover:text-accent font-semibold break-words">
                  {s.title}
                </Link>
                <p className="text-ink-faint">
                  {new Date(s.updatedAt).toLocaleString()} · {s.answeredCount}/{s.questionCount} answered
                  {s.status === "finished" ? " · finished" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.source === "sample" ? <Badge tone="warn">Sample</Badge> : null}
                <Button asChild variant="secondary">
                  <Link href={s.status === "finished" ? `/session/${s.id}/report` : `/session/${s.id}`}>
                    {s.status === "finished" ? "View report" : "Resume"}
                  </Link>
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={`Delete session ${s.title}`}>
                      <Trash2 aria-hidden />
                    </Button>
                  }
                  title="Delete this session?"
                  description="Its questions, answers and feedback will be permanently removed from this browser."
                  confirmLabel="Delete session"
                  onConfirm={() => {
                    const ok = deleteSession(s.id);
                    onChange();
                    if (ok) toast.success("Session deleted.", { id: `del-${s.id}` });
                    else
                      toast.error(
                        "This session couldn't be deleted. Check your browser storage settings and try again.",
                        { id: `del-${s.id}` },
                      );
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
