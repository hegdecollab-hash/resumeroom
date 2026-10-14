import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportRoute } from "./report-route";

export const metadata: Metadata = { title: "Practice report", robots: { index: false, follow: false } };

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportRoute />
    </Suspense>
  );
}
