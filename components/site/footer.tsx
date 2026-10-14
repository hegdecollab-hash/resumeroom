import { MessageCircle } from "lucide-react";
import { WHATSAPP_URL } from "@/lib/config";

export function Footer() {
  return (
    <footer className="no-print border-line bg-canvas mt-auto border-t">
      <div className="text-ink-soft mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:px-6">
        <p>
          Designed &amp; Developed By <span className="text-accent font-semibold">FlowSite AI</span>
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink hover:bg-muted inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 font-semibold"
        >
          <MessageCircle aria-hidden className="size-4" />
          Chat with FlowSite AI on WhatsApp
        </a>
      </div>
    </footer>
  );
}
