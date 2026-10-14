/** Normalizes text for evidence-quote matching: case, whitespace, quotes, dashes, bullets. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2022\u25CF\u25AA\u25E6\u2023\u2043]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the quote appears in the source after normalization. */
export function quoteAppearsIn(quote: string, source: string): boolean {
  const q = normalizeForMatch(quote)
    .replace(/^["']|["']$/g, "")
    .trim();
  if (q.length < 3) return false;
  return normalizeForMatch(source).includes(q);
}

/** Whitespace-only text is treated as absent. */
export function optionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  return value.trim().length === 0 ? null : value;
}

export function excerpt(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}
