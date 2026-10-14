"use client";

import { LIMITS } from "@/lib/config";

export type ExtractErrorCode =
  "not_pdf" | "too_large" | "too_many_pages" | "encrypted" | "corrupt" | "no_text" | "cancelled";

export class ExtractError extends Error {
  constructor(
    public code: ExtractErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const EXTRACT_MESSAGES: Record<ExtractErrorCode, string> = {
  not_pdf: "This file isn't a PDF. Choose a PDF resume or paste your resume text.",
  too_large: `This PDF is larger than ${LIMITS.pdfBytes / 1024 / 1024} MB. Upload a smaller PDF or paste your resume text.`,
  too_many_pages: `This PDF has more than ${LIMITS.pdfPages} pages. Upload a shorter resume or paste the text.`,
  encrypted: "This PDF is password-protected. Remove the password and upload it again, or paste your resume text.",
  corrupt: "This PDF appears to be damaged. Export it again, or paste your resume text.",
  no_text: "This PDF has no readable text. Upload a text-based PDF or paste your resume text.",
  cancelled: "PDF reading cancelled.",
};

export interface ExtractResult {
  text: string;
  pageCount: number;
}

/** Fast pre-checks before loading PDF.js: extension/MIME, size, and %PDF- header. */
export async function precheckPdf(file: File): Promise<ArrayBuffer> {
  const nameOk = /\.pdf$/i.test(file.name);
  const typeOk = file.type === "" || file.type === "application/pdf";
  if (!nameOk || !typeOk) throw new ExtractError("not_pdf", EXTRACT_MESSAGES.not_pdf);
  if (file.size > LIMITS.pdfBytes) throw new ExtractError("too_large", EXTRACT_MESSAGES.too_large);
  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer, 0, Math.min(1024, buffer.byteLength));
  const headText = String.fromCharCode(...head);
  if (!headText.includes("%PDF-")) throw new ExtractError("not_pdf", EXTRACT_MESSAGES.not_pdf);
  return buffer;
}

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

/**
 * Rebuilds lines from positioned text items. Detects a two-column layout (a clear vertical
 * gutter) and reads the left column before the right one.
 */
export function itemsToText(items: TextItemLike[], pageWidth: number): string {
  const usable = items.filter((i) => i.str.trim().length > 0);
  if (!usable.length) return "";

  const gutter = findGutter(usable, pageWidth);
  const columns =
    gutter === null
      ? [usable]
      : [usable.filter((i) => i.transform[4] < gutter), usable.filter((i) => i.transform[4] >= gutter)];
  return columns.map(linesOf).filter(Boolean).join("\n\n");
}

function linesOf(items: TextItemLike[]): string {
  const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  const lines: { y: number; h: number; parts: TextItemLike[] }[] = [];
  for (const it of sorted) {
    const y = it.transform[5];
    const h = Math.max(it.height || Math.abs(it.transform[3]) || 10, 1);
    const line = lines.find((l) => Math.abs(l.y - y) < Math.min(l.h, h) * 0.5);
    if (line) line.parts.push(it);
    else lines.push({ y, h, parts: [it] });
  }
  lines.sort((a, b) => b.y - a.y);
  const out: string[] = [];
  let prev: { y: number; h: number } | null = null;
  for (const l of lines) {
    l.parts.sort((a, b) => a.transform[4] - b.transform[4]);
    let text = "";
    let lastEnd: number | null = null;
    for (const p of l.parts) {
      const x = p.transform[4];
      if (lastEnd !== null && x - lastEnd > 1 && !text.endsWith(" ") && !p.str.startsWith(" ")) text += " ";
      text += p.str;
      lastEnd = x + p.width;
    }
    if (prev && prev.y - l.y > Math.max(prev.h, l.h) * 1.9) out.push("");
    out.push(text.replace(/\s+/g, " ").trim());
    prev = l;
  }
  return out.join("\n");
}

function findGutter(items: TextItemLike[], pageWidth: number): number | null {
  if (!pageWidth || items.length < 20) return null;
  const bins = 60;
  const cover = new Array<number>(bins).fill(0);
  for (const it of items) {
    const start = Math.max(0, Math.floor((it.transform[4] / pageWidth) * bins));
    const end = Math.min(bins - 1, Math.floor(((it.transform[4] + it.width) / pageWidth) * bins));
    for (let b = start; b <= end; b++) cover[b] += 1;
  }
  // Look for an empty band in the middle 25%-75% of the page with text on both sides.
  let best: { mid: number; width: number } | null = null;
  let runStart = -1;
  for (let b = Math.floor(bins * 0.25); b <= Math.ceil(bins * 0.75); b++) {
    if (cover[b] === 0) {
      if (runStart < 0) runStart = b;
    } else if (runStart >= 0) {
      const width = b - runStart;
      if (!best || width > best.width) best = { mid: (runStart + b) / 2, width };
      runStart = -1;
    }
  }
  if (!best || best.width < 1) return null;
  const x = (best.mid / bins) * pageWidth;
  const left = items.filter((i) => i.transform[4] + i.width <= x).length;
  const right = items.filter((i) => i.transform[4] >= x).length;
  if (left < items.length * 0.2 || right < items.length * 0.2) return null;
  return x;
}

/**
 * Extracts text locally with a dynamically imported PDF.js and a self-hosted worker.
 * The PDF bytes never leave the browser and are released when done.
 */
export async function extractPdfText(
  buffer: ArrayBuffer,
  { onProgress, signal }: { onProgress?: (page: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<ExtractResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
  });
  const abort = () => void task.destroy();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    let doc;
    try {
      doc = await task.promise;
    } catch (err) {
      if (signal?.aborted) throw new ExtractError("cancelled", EXTRACT_MESSAGES.cancelled);
      const name = (err as { name?: string })?.name ?? "";
      if (name === "PasswordException") throw new ExtractError("encrypted", EXTRACT_MESSAGES.encrypted);
      throw new ExtractError("corrupt", EXTRACT_MESSAGES.corrupt);
    }
    if (doc.numPages > LIMITS.pdfPages) throw new ExtractError("too_many_pages", EXTRACT_MESSAGES.too_many_pages);

    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      if (signal?.aborted) throw new ExtractError("cancelled", EXTRACT_MESSAGES.cancelled);
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.filter((i): i is (typeof content.items)[number] & TextItemLike => "str" in i);
      pages.push(itemsToText(items, viewport.width));
      page.cleanup();
      onProgress?.(n, doc.numPages);
    }
    const text = pages
      .map((p) => p.trim())
      .filter(Boolean)
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (text.replace(/\s/g, "").length < 40) throw new ExtractError("no_text", EXTRACT_MESSAGES.no_text);
    return { text, pageCount: doc.numPages };
  } finally {
    signal?.removeEventListener("abort", abort);
    await task.destroy();
  }
}
