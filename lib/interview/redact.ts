/**
 * Best-effort removal of obvious contact details. This is NOT anonymization:
 * names, employers, unusual formats, and context can still identify a person.
 */
const PATTERNS: { label: string; re: RegExp }[] = [
  { label: "[email]", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  {
    label: "[link]",
    re: /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|twitter\.com|x\.com|wa\.me)\/[^\s,;)]*/gi,
  },
  { label: "[link]", re: /\bhttps?:\/\/[^\s,;)]+/gi },
  { label: "[phone]", re: /(?<![\w-])\+?\d[\d\s().-]{7,}\d(?![\w-])/g },
];

export interface RedactionResult {
  text: string;
  count: number;
}

export function redactContacts(input: string): RedactionResult {
  let count = 0;
  let text = input;
  for (const { label, re } of PATTERNS) {
    text = text.replace(re, (match) => {
      // Avoid redacting year ranges such as "2019 - 2023".
      if (label === "[phone]" && match.replace(/\D/g, "").length < 9) return match;
      count += 1;
      return label;
    });
  }
  return { text, count };
}
