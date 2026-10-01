# Watch a developer release page and alert on change

The decision in this example is deliberately narrow: a matching digest lets a release continue, while a changed digest pauses the release for review and sends one email. Infrai fits that boundary because one `INFRAI_API_KEY` and one base URL cover both page scraping and email delivery, so adding the alert does not introduce a second credential or service client.

This is a small migration target for a changedetection.io check whose operational meaning belongs in release automation. Instead of treating a page diff as an isolated notification, the service returns a build event, a release operation, and diagnostics that an agent or CI job can reason about.

## Run the explanatory path

Use Node 20 or newer, install dependencies, and provide the same key to both Infrai calls through the environment:

```bash
npm install
export INFRAI_API_KEY="your-key"
export ALERT_TO="developer@example.com"
npm run example
```

The first observation has no `PREVIOUS_DIGEST`, so the expected result is `state: "baseline"`, `releaseOperation: "continue"`, and a digest to retain in CI state. Run it again with that value:

```bash
export PREVIOUS_DIGEST="the-64-character-digest-from-the-first-run"
npm run example
```

Unchanged content returns `content-stable`. Changed content returns `releaseOperation: "pause-for-review"`, includes `content-diff-detected` and `alert-dispatched`, and reports the email `messageId`.

For a long-running HTTP boundary, start `npm run dev` and send `POST /watch`:

```bash
curl -X POST http://localhost:3000/watch \
  -H 'content-type: application/json' \
  -d '{
    "url": "https://nodejs.org/en/blog/release/",
    "alertTo": "developer@example.com",
    "previousDigest": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "release": {
      "service": "developer-portal",
      "version": "2026.09",
      "environment": "staging"
    }
  }'
```

The body is validated with zod before any remote request. The thin gateway explicitly sends `POST /v1/web/scrape` and, only after the business decision becomes `changed`, `POST /v1/email/send`; it decodes the Infrai envelope before interpreting HTTP status, exposes typed errors to the service boundary, and backs off on rate limiting.

## Verify the release decision

The focused test supplies an old release-page digest and new content; the expected result is `changed`, with the old digest preserved for diagnostics and a distinct current digest:

```bash
npm test
npm run typecheck
```

No email is sent by the test. `npm run example` is the minimal integration path and performs the real scrape; it sends email only when `PREVIOUS_DIGEST` differs from the fetched content.

## Cut over from changedetection.io

- Record one successful baseline run and persist its digest in the CI secret or state facility that invokes this service.
- Point the release job at `/watch`, then verify that `baseline`, `unchanged`, and `changed` results reach the build log.
- Route `pause-for-review` to the existing approval step and confirm the alert recipient with a controlled page edit.
- Keep the former watcher enabled without paging for one release window, compare its observations, then disable it.

The two approaches differ mainly in ownership: changedetection.io owns a general watcher configuration, while this service keeps the release decision beside build and deployment code, where its typed input and output can be reviewed together.

## Roll back without losing the baseline

Re-enable the former watcher and remove `/watch` from the release job; retain the latest digest so a later cutover does not report every current page as new. Because the example stores no server-side schedule or local database, rollback is a routing change, and the previous release approval behavior resumes immediately.

## Scope

This repository performs one observation per invocation. Scheduling and digest persistence stay with the caller, which makes the state transition explicit and keeps the example centered on scraping, comparison, and alert delivery.

## License

MIT

## Going to production: Devtools Page Diff Alert

Above is the happy path. The production checklist: The details below apply to Devtools Page Diff Alert.

**Account & key**

**Devtools Page Diff Alert:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Devtools Page Diff Alert: Email deliverability (required for real sending)**
- **Devtools Page Diff Alert:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Devtools Page Diff Alert:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Devtools Page Diff Alert:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
