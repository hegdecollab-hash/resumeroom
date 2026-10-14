"use client";

import { RadioGroup } from "radix-ui";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Accessible single-choice control (radio group) with arrow-key navigation. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  name: string;
}) {
  const id = `seg-${name}`;
  return (
    <div className="space-y-2">
      <div id={id} className="font-semibold">
        {label}
      </div>
      <RadioGroup.Root
        aria-labelledby={id}
        name={name}
        value={value}
        onValueChange={(v) => onChange(v as T)}
        className="border-line bg-muted flex flex-wrap gap-1 rounded-[var(--radius-control)] border p-1"
      >
        {options.map((o) => (
          <RadioGroup.Item
            key={o.value}
            value={o.value}
            className={cn(
              "text-ink-soft hover:text-ink min-h-11 flex-1 rounded-lg px-3 transition-colors",
              "data-[state=checked]:bg-surface data-[state=checked]:text-ink data-[state=checked]:shadow-soft data-[state=checked]:font-semibold",
            )}
          >
            {o.label}
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
    </div>
  );
}
