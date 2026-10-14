import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "border-accent/20 bg-accent-soft text-ink", Icon: Info, iconCls: "text-accent" },
  warn: { cls: "border-warn/25 bg-warn-soft text-ink", Icon: AlertTriangle, iconCls: "text-warn" },
  error: { cls: "border-danger/25 bg-danger-soft text-ink", Icon: XCircle, iconCls: "text-danger" },
  success: { cls: "border-success/25 bg-success-soft text-ink", Icon: CheckCircle2, iconCls: "text-success" },
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
  live,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  live?: boolean;
}) {
  const { cls, Icon, iconCls } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : live ? "status" : undefined}
      className={cn("flex gap-3 rounded-[var(--radius-control)] border p-4", cls, className)}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", iconCls)} />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-ink-soft">{children}</div> : null}
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  );
}
