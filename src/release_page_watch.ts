import { z } from "zod";
import { createInfraiGateway } from "./infrai_gateway.js";
import { decidePageTransition } from "./page_change_decision.js";

export const watchRequestSchema = z.object({
  url: z.string().url(),
  alertTo: z.string().email(),
  previousDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  release: z.object({
    service: z.string().min(1),
    version: z.string().min(1),
    environment: z.enum(["staging", "production"])
  })
}).strict();

export type WatchRequest = z.infer<typeof watchRequestSchema>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

export async function watchReleasePage(input: WatchRequest, apiKey: string) {
  const infrai = createInfraiGateway(apiKey);
  const scraped = await infrai.web.scrape(input.url);
  const transition = decidePageTransition(input.previousDigest, scraped.content);
  const buildEvent = {
    service: input.release.service,
    version: input.release.version,
    environment: input.release.environment,
    observedAt: new Date().toISOString()
  };

  if (transition.state !== "changed") {
    return {
      state: transition.state,
      digest: transition.digest,
      buildEvent,
      releaseOperation: "continue" as const,
      diagnostics: [transition.state === "baseline" ? "baseline-recorded" : "content-stable"]
    };
  }

  const message = await infrai.email.send({
    to: input.alertTo,
    subject: `[page changed] ${input.release.service} ${input.release.version}`,
    html: `<h1>Developer page changed</h1><p><a href="${escapeHtml(input.url)}">${escapeHtml(input.url)}</a></p><p>Release: ${escapeHtml(input.release.service)} ${escapeHtml(input.release.version)} (${input.release.environment})</p><p>Previous digest: <code>${transition.previousDigest}</code><br>Current digest: <code>${transition.digest}</code></p>`
  }, `page-change:${transition.digest}:${input.alertTo}`);

  return {
    state: transition.state,
    digest: transition.digest,
    previousDigest: transition.previousDigest,
    buildEvent,
    releaseOperation: "pause-for-review" as const,
    diagnostics: ["content-diff-detected", "alert-dispatched"],
    messageId: message.message_id
  };
}
