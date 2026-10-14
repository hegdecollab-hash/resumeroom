import type { DraftQuestion, ProfileSummary } from "./types";

/** Clearly synthetic resume for demos. The person, employer and projects are fictional. */
export const SAMPLE_RESUME = `ALEX RIVERA (SYNTHETIC SAMPLE RESUME)
alex.rivera@example.com | +1 555 010 0199 | github.com/alex-rivera-sample

SUMMARY
Full-stack developer with 3 years of experience building web applications with TypeScript, React and Node.js.

EXPERIENCE
Software Engineer, Northwind Learning (fictional company), 2022 - Present
- Built a course progress dashboard in React and TypeScript used by instructors to track learner activity.
- Reduced API response time for the reports endpoint by adding PostgreSQL indexes and query pagination.
- Wrote integration tests with Jest and Supertest for the billing service.
- Mentored two interns through code reviews and pair programming sessions.

Junior Developer, Bluebird Studio (fictional company), 2021 - 2022
- Maintained a Node.js and Express REST API for a booking product.
- Migrated legacy jQuery pages to React components.

PROJECTS
StudyBuddy - Flashcard app with spaced repetition
- Next.js, TypeScript, IndexedDB for offline storage.
- Implemented a spaced repetition scheduler and offline sync queue.

Trail Weather Bot
- Python script that sends daily trail weather summaries using a public weather API.
- Added retry logic and caching to stay within API rate limits.

SKILLS
TypeScript, JavaScript, React, Next.js, Node.js, Express, PostgreSQL, Jest, Python, Git

EDUCATION
B.Sc. Computer Science, Lakeside University (fictional), 2021`;

/** Labeled synthetic fixture shown only in the "Sample preview" mode. Never presented as live AI output. */
export const SAMPLE_PROFILE: ProfileSummary = {
  headline: "Full-stack developer with 3 years of TypeScript, React and Node.js experience",
  projects: [
    { name: "StudyBuddy", evidenceQuote: "Implemented a spaced repetition scheduler and offline sync queue." },
    { name: "Trail Weather Bot", evidenceQuote: "Added retry logic and caching to stay within API rate limits." },
  ],
  skills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Jest", "Python"],
  inferredFocus: "Inferred focus: full-stack web development roles",
  jdProvided: false,
  roleGaps: [],
};

export const SAMPLE_QUESTIONS: DraftQuestion[] = [
  {
    category: "project",
    difficulty: "medium",
    question:
      "Walk me through how you designed the offline sync queue in StudyBuddy. How did you handle conflicts when the device came back online?",
    resumeReference: {
      itemLabel: "StudyBuddy",
      evidenceQuote: "Implemented a spaced repetition scheduler and offline sync queue.",
    },
    jdReference: null,
    groundingType: "resume",
    whyAsked: "Offline sync involves real design tradeoffs, which shows how you reason about data consistency.",
    expectedConcepts: [
      "Queueing writes locally",
      "Conflict resolution strategy",
      "Retry and idempotency",
      "Testing offline states",
    ],
  },
  {
    category: "technical",
    difficulty: "medium",
    question:
      "You reduced API response time with PostgreSQL indexes and pagination. How did you decide which indexes to add, and how did you verify the improvement?",
    resumeReference: {
      itemLabel: "Software Engineer, Northwind Learning",
      evidenceQuote:
        "Reduced API response time for the reports endpoint by adding PostgreSQL indexes and query pagination.",
    },
    jdReference: null,
    groundingType: "resume",
    whyAsked: "Checks whether you can explain query performance work with evidence.",
    expectedConcepts: [
      "EXPLAIN / query plans",
      "Index selectivity and write cost",
      "Offset vs keyset pagination",
      "Before/after measurement",
    ],
  },
  {
    category: "behavioral",
    difficulty: "medium",
    question:
      "Tell me about a time a code review with one of the interns you mentored led to a disagreement. How did you handle it?",
    resumeReference: {
      itemLabel: "Software Engineer, Northwind Learning",
      evidenceQuote: "Mentored two interns through code reviews and pair programming sessions.",
    },
    jdReference: null,
    groundingType: "resume",
    whyAsked: "Invites a real mentoring example without assuming a specific event happened.",
    expectedConcepts: [
      "Situation and context",
      "Your specific actions",
      "How feedback was framed",
      "Outcome or lesson",
    ],
  },
  {
    category: "technical",
    difficulty: "easy",
    question: "In Trail Weather Bot, what retry strategy did you use, and why add caching as well as retries?",
    resumeReference: {
      itemLabel: "Trail Weather Bot",
      evidenceQuote: "Added retry logic and caching to stay within API rate limits.",
    },
    jdReference: null,
    groundingType: "resume",
    whyAsked: "Retries and caching interact with rate limits; this checks practical API reliability thinking.",
    expectedConcepts: ["Exponential backoff", "Which errors to retry", "Cache freshness", "Rate-limit budgeting"],
  },
  {
    category: "project",
    difficulty: "medium",
    question:
      "When you migrated legacy jQuery pages to React, how did you plan the migration so the product kept working?",
    resumeReference: {
      itemLabel: "Junior Developer, Bluebird Studio",
      evidenceQuote: "Migrated legacy jQuery pages to React components.",
    },
    jdReference: null,
    groundingType: "resume",
    whyAsked: "Incremental migrations show planning, risk management and testing habits.",
    expectedConcepts: ["Incremental rollout", "Shared state between old and new code", "Regression testing"],
  },
];
