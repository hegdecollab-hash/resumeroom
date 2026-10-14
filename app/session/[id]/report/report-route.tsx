"use client";

import { useParams } from "next/navigation";
import { ReportView } from "@/components/interview/report-view";

export function ReportRoute() {
  const { id } = useParams<{ id: string }>();
  return <ReportView key={id} id={id} />;
}
