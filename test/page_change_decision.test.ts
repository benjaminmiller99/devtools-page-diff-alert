import assert from "node:assert/strict";
import test from "node:test";
import { decidePageTransition, digestPage } from "../src/page_change_decision.js";
import { watchRequestSchema } from "../src/release_page_watch.js";

test("a changed developer page pauses the release for review", () => {
  const previousDigest = digestPage("Node.js 22.1.0 release notes");
  const result = decidePageTransition(previousDigest, "Node.js 22.2.0 release notes");

  assert.equal(result.state, "changed");
  assert.equal(result.previousDigest, previousDigest);
  assert.notEqual(result.digest, previousDigest);
});

test("the request boundary rejects an invalid release environment", () => {
  const result = watchRequestSchema.safeParse({
    url: "https://example.com/tooling/releases",
    alertTo: "dev@example.com",
    release: { service: "tooling", version: "4.2.0", environment: "laptop" }
  });

  assert.equal(result.success, false);
});
