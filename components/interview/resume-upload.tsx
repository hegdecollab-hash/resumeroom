"use client";

import { FileUp, Loader2, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { LIMITS } from "@/lib/config";
import { EXTRACT_MESSAGES, ExtractError, type ExtractErrorCode } from "@/lib/pdf/extract";
import { cn } from "@/lib/utils";

export interface Extracted {
  text: string;
  fileName: string;
  pageCount: number;
}

type State =
  | { kind: "idle" }
  | { kind: "working"; fileName: string; page: number; total: number }
  | { kind: "error"; code: ExtractErrorCode; message: string }
  | { kind: "done"; fileName: string; pageCount: number };

/** PDF picker with local extraction. The PDF never leaves the browser and is not stored. */
export function ResumeUpload({
  onExtracted,
  onBeforeReplace,
}: {
  onExtracted: (r: Extracted) => void;
  /** Return false to cancel (e.g. user declined discarding existing text). */
  onBeforeReplace: () => Promise<boolean>;
}) {
  const [state, setState] = React.useState<State>({ kind: "idle" });
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  async function handle(file: File | undefined) {
    if (!file || state.kind === "working") return;
    if (!(await onBeforeReplace())) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: "working", fileName: file.name, page: 0, total: 0 });
    try {
      const { precheckPdf, extractPdfText } = await import("@/lib/pdf/extract");
      let buffer: ArrayBuffer | null = await precheckPdf(file);
      const result = await extractPdfText(buffer, {
        signal: controller.signal,
        onProgress: (page, total) => setState({ kind: "working", fileName: file.name, page, total }),
      });
      buffer = null; // release bytes
      if (result.text.length > LIMITS.resumeChars) {
        setState({
          kind: "error",
          code: "too_large",
          message: `The extracted text is ${result.text.length.toLocaleString("en-US")} characters, over the ${LIMITS.resumeChars.toLocaleString("en-US")} limit. Shorten it after pasting, or upload a shorter resume.`,
        });
        return;
      }
      setState({ kind: "done", fileName: file.name, pageCount: result.pageCount });
      onExtracted({ text: result.text, fileName: file.name, pageCount: result.pageCount });
    } catch (err) {
      if (err instanceof ExtractError) {
        if (err.code === "cancelled") setState({ kind: "idle" });
        else setState({ kind: "error", code: err.code, message: err.message });
      } else setState({ kind: "error", code: "corrupt", message: EXTRACT_MESSAGES.corrupt });
    } finally {
      abortRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handle(e.dataTransfer.files[0]);
        }}
        className={cn(
          "border-line-strong bg-surface flex flex-col items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragging && "border-accent bg-accent-soft",
        )}
      >
        {state.kind === "working" ? (
          <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
            <Loader2 aria-hidden className="text-accent size-6 animate-spin" />
            <p className="font-semibold break-all">{state.fileName}</p>
            <p className="text-ink-soft">
              {state.total
                ? `Reading page ${state.page} of ${state.total} on this device…`
                : "Opening PDF on this device…"}
            </p>
            <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
              <X aria-hidden /> Cancel
            </Button>
          </div>
        ) : (
          <>
            <FileUp aria-hidden className="text-accent size-6" />
            <div>
              <p className="font-semibold">Upload your resume (PDF)</p>
              <p className="text-ink-faint">
                Text-based PDF, up to {LIMITS.pdfBytes / 1024 / 1024} MB and {LIMITS.pdfPages} pages. Read on this
                device.
              </p>
            </div>
            <input
              ref={inputRef}
              id="resume-file"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => void handle(e.target.files?.[0])}
            />
            <Button variant="secondary" onClick={() => inputRef.current?.click()}>
              {state.kind === "done" ? "Choose a different PDF" : "Choose PDF"}
            </Button>
          </>
        )}
      </div>
      {state.kind === "done" ? (
        <Notice tone="success" live title={`Read ${state.fileName}`}>
          {state.pageCount} {state.pageCount === 1 ? "page" : "pages"}. Review the text below and fix anything that
          looks out of order.
        </Notice>
      ) : null}
      {state.kind === "error" ? (
        <Notice tone="error" title="We couldn't use that PDF">
          {state.message}
        </Notice>
      ) : null}
    </div>
  );
}
