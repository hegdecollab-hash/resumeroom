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
            className="text-ink decoration-line-strong hover:decoration-accent font-semibold underline underline-offset-4"
          >
            Society for AI
          </a>{" "}
          initiative
        </p>
      </div>
    </footer>
  );
}
