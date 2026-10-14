import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SessionMissing({ corrupt = false }: { corrupt?: boolean }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-4 text-center">
        <h1 className="text-heading font-semibold">
          {corrupt ? "This session can't be opened" : "Session not found on this device"}
        </h1>
        <p className="text-ink-soft">
          {corrupt
            ? "The saved data for this session is damaged or from an older version, so we can't safely load it."
            : "Sessions are saved only in the browser where you created them. It may have been deleted, the site data cleared, or it was created on another device or browser."}
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/practice">Practice again</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
