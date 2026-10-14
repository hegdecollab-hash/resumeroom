"use client";

import { useParams } from "next/navigation";
import { SessionWorkspace } from "@/components/interview/session-workspace";

export function SessionRoute() {
  const { id } = useParams<{ id: string }>();
  return <SessionWorkspace key={id} id={id} />;
}
