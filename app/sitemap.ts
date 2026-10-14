import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

/** Only the public landing page. Practice, session and report pages are private and noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${APP_URL}/`, changeFrequency: "monthly", priority: 1 }];
}
