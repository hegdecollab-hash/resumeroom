import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "border-line-strong bg-surface text-ink placeholder:text-ink-faint focus-visible:border-accent aria-[invalid=true]:border-danger block w-full resize-y rounded-[var(--radius-control)] border px-3.5 py-3",
        className,
      )}
      {...props}
    />
  );
}
