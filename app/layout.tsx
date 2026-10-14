import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { ToasterProvider } from "@/components/site/toaster-provider";
import { APP_NAME, APP_URL } from "@/lib/config";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz"],
  display: "swap",
});
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({
  variable: "--font-label-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const description =
  "Rehearse the interview questions your resume invites. Write your answers, get specific feedback, and keep everything in your browser. No account needed.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: `${APP_NAME} – Interview practice built around your resume`, template: `%s · ${APP_NAME}` },
  description,
  applicationName: APP_NAME,
  icons: { icon: "/icon.svg" },
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} – Interview practice built around your resume`,
    description,
    images: [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630, alt: `${APP_NAME} preview` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} – Interview practice built around your resume`,
    description,
    images: [`${APP_URL}/opengraph-image`],
  },
};

export const viewport: Viewport = { themeColor: "#f6f1e7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="bg-surface sr-only z-50 rounded-lg p-3 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <ToasterProvider />
      </body>
    </html>
  );
}
