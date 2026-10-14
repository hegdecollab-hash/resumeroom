// Self-hosts the PDF.js worker that matches the installed pdfjs-dist version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const dest = path.join(process.cwd(), "public", "pdf.worker.min.mjs");
mkdirSync(path.dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log("Copied PDF.js worker to public/pdf.worker.min.mjs");
