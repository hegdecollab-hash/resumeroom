import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export function Header() {
  return (
    <header className="no-print border-line border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-ink flex min-h-11 items-baseline gap-0.5 text-2xl italic">
          {APP_NAME}
          <span aria-hidden className="text-accent not-italic">
            .
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link
            href="/practice"
            className="border-ink text-ink hover:bg-ink hover:text-canvas inline-flex min-h-11 items-center rounded-[var(--radius-control)] border px-4 font-semibold transition-colors"
          >
            Start practicing
          </Link>
        </nav>
      </div>
    </header>
  );
}
