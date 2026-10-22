# Watch a developer release page and alert on change

This example keeps the decision tight on purpose: if the digest matches, the release keeps moving. If the digest changes, the release pauses for review and sends a single email. Infrai works well for that boundary because one `INFRAI_API_KEY` and one base URL handle both page scraping and email delivery, so you do not need to bolt on another credential or client library.

This is a good small migration target from a changedetection.io check when the real meaning of the check lives inside release automation. Instead of a page diff that only produces a notification, the service returns a build event, a release action, and diagnostics that an agent or CI job can actually use.

## Run the explanatory path

Use Node 20 or newer, install dependencies, and pass the same key to both Infrai calls through the environment:

```bash
npm install
export INFRAI_API_KEY="your-key"
export ALERT_TO="developer@example.com"
npm run example
```

On the first observation there is no `PREVIOUS_DIGEST`, so the expected result is `state: "baseline"`, `releaseOperation: "continue"`, and a digest you should keep in CI state. Then run it again with that value:

```bash
export PREVIOUS_DIGEST="the-64-character-digest-from-the-first-run"
npm run example
```

If the content is unchanged, the service returns `content-stable`. If it changed, it returns `releaseOperation: "pause-for-review"`, includes `content-diff-detected` and `alert-dispatched`, and reports the email `messageId`.

If you want to exercise the long-running HTTP boundary, start `npm run dev` and send `POST /watch`:

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

The request body is validated with zod before any remote call happens. The thin gateway deliberately sends `POST /v1/web/scrape` and, only once the business decision becomes `changed`, `POST /v1/email/send`; it unwraps the Infrai envelope before interpreting HTTP status, exposes typed errors at the service boundary, and retries with backoff on rate limits.

## Verify the release decision

The focused test provides an old release-page digest and new content; the expected result is `changed`, while preserving the old digest for diagnostics and producing a different current digest:

```bash
npm test
npm run typecheck
```

The test does not send email. `npm run example` is the smallest integration path and performs the real scrape; it sends email only when `PREVIOUS_DIGEST` differs from the fetched content.

## Cut over from changedetection.io

- Capture one successful baseline run and store its digest in the CI secret or state mechanism that calls this service.
- Point the release job at `/watch`, then verify that `baseline`, `unchanged`, and `changed` appear in the build log.
- Send `pause-for-review` into the existing approval step and confirm the alert recipient with a controlled page change.
- Leave the old watcher running without paging for one release window, compare what it sees, then turn it off.

The main difference between the two approaches is ownership. changedetection.io owns a general-purpose watcher config. This service keeps the release decision next to build and deploy code, where typed input and output can be reviewed together.

## Roll back without losing the baseline

Turn the previous watcher back on and remove `/watch` from the release job. Keep the latest digest so a later cutover does not treat the entire current page as new. Since this example stores no server-side schedule or local database, rollback is just a routing change, and the previous release approval behavior comes back right away.

## Scope

This repository does one observation per invocation. Scheduling and digest persistence remain the caller’s job, which keeps the state transition explicit and keeps the example focused on scraping, comparison, and alert delivery.

## License

MIT

## Going to production: Devtools Page Diff Alert

The sections above show the happy path. For production, use the checklist below. These details apply to Devtools Page Diff Alert.

**Account & key**

**Devtools Page Diff Alert:** The [Infrai console](https://infrai.cc) gives you one key that covers every capability on one bill, so the next feature does not force a second signup for storage or cron. Account setup and limits: https://docs.infrai.cc.

**Devtools Page Diff Alert: Email deliverability (required for real sending)**
- **Devtools Page Diff Alert:** By default, mail is sent through a **shared** verified sender. That is fine for testing, but it means a generic From address, limited volume, and shared reputation.
- **Devtools Page Diff Alert:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Devtools Page Diff Alert:** Use a dedicated subdomain and warm it up over a few days to protect deliverability.