"use client";

import { Form, Formik, type FormikHelpers } from "formik";
import { ChevronDown, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import toast from "react-hot-toast";
import * as Yup from "yup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/lib/config";
import { ClientApiError, newRequestId, postJson } from "@/lib/interview/client";
import { redactContacts } from "@/lib/interview/redact";
import { SAMPLE_PROFILE, SAMPLE_QUESTIONS, SAMPLE_RESUME } from "@/lib/interview/sample";
import { createSession } from "@/lib/interview/session";
import { optionalText } from "@/lib/interview/text";
import {
  DEFAULT_PREFERENCES,
  type GenerateRequest,
  type GenerateResponse,
  type Preferences,
} from "@/lib/interview/types";
import {
  getSettings,
  listSessions,
  loadPracticeDraft,
  saveSession,
  savePracticeDraft,
  setSettings,
  storageAvailable,
  type SessionSummary,
} from "@/lib/storage/storage";
import { ResumeUpload } from "./resume-upload";
import { SavedSessions } from "./saved-sessions";

export const PRIVACY_NOTICE =
  "Your PDF is read on this device. Your resume text, sessions, and reports are saved only in this browser. When you generate questions or check an answer, the reviewed resume text, optional job description, and your answer are sent through this app's server route to OpenRouter and the selected model provider. We do not store them on our server.";

interface Values {
  resumeText: string;
  jdText: string;
  focus: Preferences["focus"];
  difficulty: Preferences["difficulty"];
  count: string;
  redact: boolean;
}

const schema = Yup.object({
  resumeText: Yup.string()
    .trim()
    .required("Add your resume text to continue.")
    .min(LIMITS.minResumeChars, `Resume text looks too short (minimum ${LIMITS.minResumeChars} characters).`)
    .max(
      LIMITS.resumeChars,
      `Resume text is over the ${LIMITS.resumeChars.toLocaleString("en-US")} character limit. Shorten it to continue.`,
    ),
  jdText: Yup.string().max(
    LIMITS.jdChars,
    `Job description is over the ${LIMITS.jdChars.toLocaleString("en-US")} character limit. Shorten it to continue.`,
  ),
  focus: Yup.string().oneOf(["mixed", "behavioral", "technical"]).required(),
  difficulty: Yup.string().oneOf(["easy", "medium", "hard"]).required(),
  count: Yup.string().oneOf(["5", "10", "15"]).required(),
  redact: Yup.boolean().required(),
});

function outgoing(values: Values) {
  const resume = values.redact ? redactContacts(values.resumeText) : { text: values.resumeText, count: 0 };
  const jdRaw = optionalText(values.jdText);
  const jd = jdRaw && values.redact ? redactContacts(jdRaw) : { text: jdRaw, count: 0 };
  return { resumeText: resume.text.trim(), jdText: jd.text?.trim() ?? null, removed: resume.count + jd.count };
}

const counter = (n: number, max: number) => (
  <span className={n > max ? "text-danger font-semibold" : "text-ink-faint"}>
    {n.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
  </span>
);

export function PracticeClient() {
  const router = useRouter();
  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
  const [saveEnabled, setSaveEnabled] = React.useState(true);
  const [storageOk, setStorageOk] = React.useState(true);
  const [initial, setInitial] = React.useState<Values | null>(null);
  const [fileInfo, setFileInfo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<ClientApiError | null>(null);
  const [slow, setSlow] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  const [showOutgoing, setShowOutgoing] = React.useState(false);
  const [confirm, setConfirm] = React.useState<null | ((ok: boolean) => void)>(null);
  const inflight = React.useRef(false);

  const refresh = React.useCallback(() => setSessions(listSessions()), []);

  React.useEffect(() => {
    // Hydrate browser-only state after mount.
    const ok = storageAvailable();
    const sample = new URLSearchParams(window.location.search).get("sample") === "1";
    const draft = ok ? loadPracticeDraft() : null;
    const save = ok && getSettings().saveSessions;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from browser storage */
    setStorageOk(ok);
    setSaveEnabled(save);
    setInitial({
      resumeText: sample ? SAMPLE_RESUME : (draft?.resumeText ?? ""),
      jdText: sample ? "" : (draft?.jdText ?? ""),
      focus: DEFAULT_PREFERENCES.focus,
      difficulty: DEFAULT_PREFERENCES.difficulty,
      count: String(DEFAULT_PREFERENCES.count),
      redact: true,
    });
    setFileInfo(sample ? "Synthetic sample resume" : (draft?.fileName ?? null));
    setOffline(!navigator.onLine);
    refresh();
    /* eslint-enable react-hooks/set-state-in-effect */
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh]);

  function persistSessionAndGo(session: ReturnType<typeof createSession>) {
    const res = saveSession(session, saveEnabled);
    if (!res.ok) {
      toast.error(
        res.problem === "quota"
          ? "Browser storage is full. This session is kept in this tab only; delete old sessions to save again."
          : "Browser storage is unavailable. This session is kept in this tab only.",
        { id: "storage" },
      );
    }
    savePracticeDraft(null);
    router.push(`/session/${session.id}`);
  }

  async function onSubmit(values: Values, helpers: FormikHelpers<Values>) {
    if (inflight.current) return;
    inflight.current = true;
    setError(null);
    const out = outgoing(values);
    const body: GenerateRequest = {
      requestId: newRequestId(),
      resumeText: out.resumeText,
      jdText: out.jdText,
      preferences: { focus: values.focus, difficulty: values.difficulty, count: Number(values.count) as 5 | 10 | 15 },
    };
    const slowTimer = setTimeout(() => setSlow(true), 12_000);
    try {
      const res = await postJson<GenerateResponse>("/api/interview/generate", body);
      persistSessionAndGo(
        createSession({
          resumeText: body.resumeText,
          jdText: body.jdText,
          preferences: body.preferences,
          profile: res.profile,
          questions: res.questions,
          source: "ai",
          notice: res.notice,
        }),
      );
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err
          : new ClientApiError("UNKNOWN", "Something went wrong. Please try again.", true),
      );
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      inflight.current = false;
      helpers.setSubmitting(false);
    }
  }

  function startSamplePreview(values: Values) {
    const preferences: Preferences = { focus: "mixed", difficulty: "medium", count: 5 };
    const out = outgoing({ ...values, resumeText: SAMPLE_RESUME, jdText: "" });
    persistSessionAndGo(
      createSession({
        resumeText: out.resumeText,
        jdText: null,
        preferences,
        profile: SAMPLE_PROFILE,
        questions: SAMPLE_QUESTIONS.filter((q) => out.resumeText.includes(q.resumeReference?.evidenceQuote ?? "")),
        source: "sample",
        notice:
          "These are prepared sample questions for the fictional resume, not live AI results. Answer checks use the live AI.",
      }),
    );
  }

  if (!initial) {
    return (
      <div role="status" className="text-ink-soft flex items-center gap-2 py-16">
        <Loader2 aria-hidden className="size-5 animate-spin" /> Loading your workspace…
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Formik<Values> initialValues={initial} validationSchema={schema} onSubmit={onSubmit}>
        {({ values, errors, touched, setFieldValue, setFieldTouched, isSubmitting, submitCount }) => {
          const out = outgoing(values);
          const isSample = values.resumeText.trim() === SAMPLE_RESUME.trim();
          return (
            <Form noValidate className="min-w-0 space-y-6">
              <AutosaveDraft values={values} fileName={fileInfo} />
              {!storageOk ? (
                <Notice tone="warn" title="Browser storage is unavailable">
                  This browser is blocking storage (often private mode). You can still practice, but nothing is saved
                  after you close this tab.
                </Notice>
              ) : null}
              {offline ? (
                <Notice tone="warn" title="You're offline">
                  You can upload and edit your resume. Generating questions needs a connection.
                </Notice>
              ) : null}

              <Card className="space-y-5">
                <div>
                  <h2 className="font-semibold">1. Your resume</h2>
                  <p className="text-ink-faint">
                    Upload a PDF or paste the text. You&apos;ll review it before anything is sent.
                  </p>
                </div>
                <ResumeUpload
                  onBeforeReplace={() =>
                    values.resumeText.trim()
                      ? new Promise<boolean>((resolve) => setConfirm(() => resolve))
                      : Promise.resolve(true)
                  }
                  onExtracted={(r) => {
                    void setFieldValue("resumeText", r.text);
                    setFileInfo(`${r.fileName} · ${r.pageCount} ${r.pageCount === 1 ? "page" : "pages"}`);
                  }}
                />
                <details className="group border-line rounded-[var(--radius-control)] border" open>
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 truncate">
                      Review resume text
                      {fileInfo ? <span className="text-ink-faint font-normal"> · {fileInfo}</span> : null}
                    </span>
                    <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-line space-y-2 border-t p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label htmlFor="resumeText">Resume text</Label>
                      {counter(values.resumeText.length, LIMITS.resumeChars)}
                    </div>
                    <Textarea
                      id="resumeText"
                      name="resumeText"
                      rows={12}
                      value={values.resumeText}
                      onChange={(e) => void setFieldValue("resumeText", e.target.value)}
                      onBlur={() => void setFieldTouched("resumeText", true)}
                      placeholder="Paste your resume text here, or upload a PDF above."
                      aria-invalid={Boolean(errors.resumeText && (touched.resumeText || submitCount > 0))}
                      aria-describedby="resumeText-help"
                    />
                    <p
                      id="resumeText-help"
                      className={
                        errors.resumeText && (touched.resumeText || submitCount > 0) ? "text-danger" : "text-ink-faint"
                      }
                    >
                      {errors.resumeText && (touched.resumeText || submitCount > 0)
                        ? errors.resumeText
                        : "Fix any lines that came out of order, especially on multi-column resumes."}
                    </p>
                    {isSample ? <Badge tone="warn">Synthetic sample resume (fictional person)</Badge> : null}
                  </div>
                </details>
              </Card>

              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="jdText">2. Job description (optional)</Label>
                  {counter(values.jdText.length, LIMITS.jdChars)}
                </div>
                <p className="text-ink-faint">
                  Skip this to practice from your resume alone. Skills only the job asks for are marked as gaps.
                </p>
                <Textarea
                  id="jdText"
                  name="jdText"
                  rows={6}
                  value={values.jdText}
                  onChange={(e) => void setFieldValue("jdText", e.target.value)}
                  placeholder="Paste a job description to prepare for a specific role."
                  aria-invalid={Boolean(errors.jdText)}
                  aria-describedby="jdText-error"
                />
                {errors.jdText ? (
                  <p id="jdText-error" className="text-danger">
                    {errors.jdText}
                  </p>
                ) : null}
              </Card>

              <Card className="space-y-5">
                <h2 className="font-semibold">3. Preferences</h2>
                <Segmented
                  name="focus"
                  label="Round"
                  value={values.focus}
                  onChange={(v) => void setFieldValue("focus", v)}
                  options={[
                    { value: "mixed", label: "Mixed" },
                    { value: "behavioral", label: "HR & behavioral" },
                    { value: "technical", label: "Technical" },
                  ]}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Segmented
                    name="difficulty"
                    label="Difficulty"
                    value={values.difficulty}
                    onChange={(v) => void setFieldValue("difficulty", v)}
                    options={[
                      { value: "easy", label: "Easy" },
                      { value: "medium", label: "Medium" },
                      { value: "hard", label: "Hard" },
                    ]}
                  />
                  <Segmented
                    name="count"
                    label="Questions"
                    value={values.count}
                    onChange={(v) => void setFieldValue("count", v)}
                    options={[
                      { value: "5", label: "5" },
                      { value: "10", label: "10" },
                      { value: "15", label: "15" },
                    ]}
                  />
                </div>
              </Card>

              <Card className="space-y-4">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Lock aria-hidden className="text-accent size-4" /> Privacy
                </h2>
                <p className="text-ink-soft">{PRIVACY_NOTICE}</p>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label htmlFor="redact">Remove obvious contact details</Label>
                    <p className="text-ink-faint">
                      Best effort: emails, phone numbers and profile links. Not full anonymization.
                      {values.redact && out.removed > 0 ? ` ${out.removed} item(s) will be removed.` : ""}
                    </p>
                  </div>
                  <Switch
                    id="redact"
                    checked={values.redact}
                    onCheckedChange={(v) => void setFieldValue("redact", v)}
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label htmlFor="save">Save sessions on this device</Label>
                    <p className="text-ink-faint">
                      Turn off to keep sessions in memory only; they disappear when you close or refresh the tab.
                    </p>
                  </div>
                  <Switch
                    id="save"
                    checked={saveEnabled}
                    disabled={!storageOk}
                    onCheckedChange={(v) => {
                      setSaveEnabled(v);
                      setSettings({ saveSessions: v });
                      if (!v) savePracticeDraft(null);
                    }}
                  />
                </div>
                <div>
                  <Button variant="secondary" aria-expanded={showOutgoing} onClick={() => setShowOutgoing((s) => !s)}>
                    {showOutgoing ? "Hide outgoing text" : "Show exactly what will be sent"}
                  </Button>
                  {showOutgoing ? (
                    <div className="mt-3 space-y-3">
                      <OutgoingBlock label="Resume text sent" text={out.resumeText || "(empty)"} />
                      <OutgoingBlock label="Job description sent" text={out.jdText ?? "(none: resume-only practice)"} />
                    </div>
                  ) : null}
                </div>
              </Card>

              {error ? (
                <Notice tone="error" title="Couldn't generate questions">
                  {error.message} Your resume text and job description are still here.
                </Notice>
              ) : null}
              {isSubmitting && slow ? (
                <Notice tone="info" live title="Still working">
                  The AI provider is slower than usual. Keep this tab open.
                </Notice>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" size="lg" disabled={isSubmitting || offline} aria-busy={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 aria-hidden className="animate-spin" /> Generating questions…
                    </>
                  ) : (
                    "Generate questions"
                  )}
                </Button>
                {isSample ? (
                  <Button
                    variant="secondary"
                    size="lg"
                    disabled={isSubmitting}
                    onClick={() => startSamplePreview(values)}
                  >
                    Preview sample questions (not AI)
                  </Button>
                ) : null}
              </div>

              <ConfirmDialog
                open={confirm !== null}
                onOpenChange={(open) => {
                  if (!open && confirm) {
                    confirm(false);
                    setConfirm(null);
                  }
                }}
                title="Replace your resume text?"
                description="The text you've reviewed or edited will be replaced by the new PDF's text."
                confirmLabel="Replace text"
                onConfirm={() => {
                  confirm?.(true);
                  setConfirm(null);
                }}
              />
            </Form>
          );
        }}
      </Formik>

      <aside className="space-y-6">
        <SavedSessions sessions={sessions} onChange={refresh} />
      </aside>
    </div>
  );
}

function OutgoingBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="font-semibold">{label}</p>
      <pre className="border-line bg-muted text-ink-soft mt-1 max-h-56 overflow-auto rounded-[var(--radius-control)] border p-3 font-sans whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}

function AutosaveDraft({ values, fileName }: { values: Values; fileName: string | null }) {
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (values.resumeText.trim() || values.jdText.trim())
        savePracticeDraft({ resumeText: values.resumeText, jdText: values.jdText, fileName });
    }, 600);
    return () => clearTimeout(t);
  }, [values.resumeText, values.jdText, fileName]);
  return null;
}
