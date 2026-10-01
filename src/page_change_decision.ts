import { createHash } from "node:crypto";

export type PageTransition =
  | { state: "baseline"; digest: string }
  | { state: "unchanged"; digest: string }
  | { state: "changed"; digest: string; previousDigest: string };

export function digestPage(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function decidePageTransition(
  previousDigest: string | undefined,
  content: string
): PageTransition {
  const digest = digestPage(content);
  if (!previousDigest) return { state: "baseline", digest };
  if (previousDigest === digest) return { state: "unchanged", digest };
  return { state: "changed", digest, previousDigest };
}
