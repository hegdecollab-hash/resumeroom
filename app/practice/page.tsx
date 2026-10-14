import type { Metadata } from "next";
import { PracticeClient } from "@/components/interview/practice-client";

export const metadata: Metadata = {
  title: "Practice",
  robots: { index: false, follow: false },
};

export default function PracticePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-heading font-semibold">Set up your session</h1>
      <p className="text-ink-soft mt-2 max-w-2xl">
        Add your resume, choose your round, and start answering. A job description is optional.
      </p>
      <div className="mt-8">
        <PracticeClient />
      </div>
    </div>
  );
}
