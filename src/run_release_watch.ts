import { watchReleasePage, watchRequestSchema } from "./release_page_watch.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const input = watchRequestSchema.parse({
  url: process.env.WATCH_URL ?? "https://nodejs.org/en/blog/release/",
  alertTo: process.env.ALERT_TO,
  previousDigest: process.env.PREVIOUS_DIGEST || undefined,
  release: {
    service: process.env.RELEASE_SERVICE ?? "developer-portal",
    version: process.env.RELEASE_VERSION ?? "2026.09",
    environment: process.env.RELEASE_ENV ?? "staging"
  }
});

console.log(JSON.stringify(await watchReleasePage(input, apiKey), null, 2));
