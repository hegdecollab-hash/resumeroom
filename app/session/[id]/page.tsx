import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionRoute } from "./session-route";

export const metadata: Metadata = { title: "Practice session", robots: { index: false, follow: false } };

export default function SessionPage() {
  return (
    <Suspense fallback={null}>
      <SessionRoute />
    </Suspense>
  );
}
