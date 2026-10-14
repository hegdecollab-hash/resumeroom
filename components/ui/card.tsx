import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-line bg-surface shadow-soft rounded-[var(--radius-card)] border p-5 sm:p-6", className)}
      {...props}
    />
  );
}
