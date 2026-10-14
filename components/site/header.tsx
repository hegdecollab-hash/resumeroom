import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export function Header() {
  return (
    <header className="no-print border-line bg-canvas/90 border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="text-ink flex min-h-11 items-center gap-2 font-semibold">
          <span aria-hidden className="bg-accent grid size-8 place-items-center rounded-lg text-white">
            R
          </span>
          {APP_NAME}
        </Link>
        <nav aria-label="Main">
          <Link
            href="/practice"
            className="text-accent hover:bg-accent-soft inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 font-semibold"
          >
            Practice
          </Link>
        </nav>
      </div>
    </header>
  );
}
