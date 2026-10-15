export function Footer() {
  return (
    <footer className="no-print border-line mt-auto border-t">
      <div className="text-ink-soft mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 text-center sm:px-6">
        <p>
          A product by{" "}
          <a
            href="https://sai11.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink decoration-line-strong inline-flex items-center gap-1.5 align-middle hover:decoration-accent font-semibold underline underline-offset-4"
          >
            <span className="inline-flex items-center rounded-md bg-[#0b0f1a] px-1.5 py-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sai-logo.svg"
                alt="Society for Artificial Intelligence logo"
                width={31}
                height={20}
                className="h-[20px] w-auto"
              />
            </span>
            Society for AI
          </a>{" "}
          initiative
        </p>
      </div>
    </footer>
  );
}
