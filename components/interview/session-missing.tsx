import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SessionMissing({ corrupt = false }: { corrupt?: boolean }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-4 text-center">
        <h1 className="text-heading font-semibold">
          {corrupt ? "This session can't be opened" : "We can't find this session"}
        </h1>
        <p className="text-ink-soft">
          {corrupt
            ? "The saved data for this session is damaged or from an older version, so it can't be opened safely."
            : "Sessions live only in the browser that created them. This one may have been deleted, cleared with your site data, or started on another device."}
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/practice">Start a new session</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
