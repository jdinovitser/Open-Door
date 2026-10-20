# Security

Open Door offers public Guest exploration and optional Replit-managed Clerk sign-in. Account-saved doors and reward events are stored in PostgreSQL and scoped to the authenticated owner. It has no enterprise authorization roles or durable audit log. Do not use it to store confidential or regulated information.

## Controls implemented

- Account APIs require a Clerk-authenticated session. Owner IDs come from server-side authentication, never request bodies. Saved-door and reward queries use parameterized SQL and explicit owner filters.
- Saved-door writes use bounded field allowlists, per-account limits, owner-scoped delta updates, and a serialized transaction. Reward events are idempotent per account and door; rewards are personal tallies, not independently verified achievements.
- Guest collections are kept separate from account caches. Guest-saved doors can be imported at sign-in; full journey, feedback, and Discovery Lab state remain browser-local.
- Confirmed, authenticated `DELETE /api/account/data` erases reward events (`progress`), saved doors (`saved-doors`), or both (`all`). It requires the explicit `ERASE` confirmation. All affected tables are changed in a single owner-locked transaction; failure rolls back the whole erasure. Owner IDs in bodies and query strings never select an account.
- `DELETE /api/account` requires `CLOSE` confirmation. It atomically erases both cloud data sets and commits a durable `closing` marker before deleting the authenticated user's Clerk account through the server SDK. Clerk or network failure returns an explicit incomplete outcome, blocks new cloud writes, and leaves the closure request available for automatic retry. Clerk 404 is treated as an already-completed account deletion, not an error.
- All saved-door and reward writes share the deletion lock and require the current account revision. Erasure increments that revision. Stale tabs and offline queues cannot restore erased records: they must reload, discard old pending changes, and then explicitly save/open doors again. A minimal lifecycle marker (Clerk ID, revision, lifecycle status, last check time) remains after closure to block stale sessions; it contains no saved-door details, interests, location, or reward events.
- The Qloo credential is read by the server and sent only in the server-to-Qloo `X-Api-Key` header. It is not included in status responses or browser code.
- Qloo requests use a fixed HTTPS host and fixed routes. User values are URL-encoded parameters; they cannot choose a server-side destination.
- Live discovery requests are limited to 24 KiB, at most five anchors, 20 requests per process-local 60-second window per socket address, and one Qloo request timeout of 12 seconds. Oversized Qloo responses are rejected at 2 MiB.
- Mutating requests marked by the browser as cross-site are rejected. The app does not enable CORS. This is a browser boundary, not authentication; non-browser clients can call the public API.
- Production responses include a restrictive Content Security Policy and standard browser security headers. Development omits the production CSP for Vite hot reload.
- Responses carry a random request ID. Operational audit events are structured and bounded to 500 in-memory records. The event schema excludes user inputs, location, credentials, and upstream payloads.
- Qloo explainability output is bounded and sensitive-looking keys are removed before it reaches the UI. React renders untrusted values as text; the app does not interpret them as instructions or executable markup.
- The app uses no LLM. User input and Qloo results are data, not instructions.
- `/security-test` and `/api/dev/audit` are only registered in the development server.

## Limitations and operator responsibilities

The rate limit, audit buffer, and event sequence are process-local. They reset on restart, are not tamper-resistant, and are not a complete record of user activity. Standard output may be captured under the hosting platform’s own log-retention policy. Account isolation and active-data deletion are implemented, but administrator roles, an application-level retention/backup policy, and automated incident alerting are not.

### Account lifecycle cleanup

The server runs a bounded reconciliation pass at startup and every minute while it is running. Each pass checks up to 25 non-closed account owners, oldest check first, through Clerk's authenticated Backend API. This includes legacy saved-door/reward owners without a lifecycle marker. A **confirmed 404** from Clerk triggers transactional removal of saved doors and reward events, followed by a closed marker. Authentication errors, rate limits, and network/service errors do **not** establish that an account was deleted; they preserve its data and are retried. Pending app-initiated closures are retried through the same worker. There is no unsigned deletion webhook or client-supplied lifecycle identity.

This polling approach does not require additional Clerk dashboard access, webhook configuration, or webhook credentials. It is eventually consistent, not instant: time to cleanup depends on the number of owners, server uptime, database availability, and Clerk availability. An idle/scaled-down server performs no checks until it runs again. Errors produce generic operational warnings without owner IDs, credentials, or Clerk response payloads. There is not yet a durable cleanup-monitoring or alerting system.

Trust & privacy offers separate confirmed controls for cloud erasure, permanent account closure, and browser-only clearing. The header points to these controls instead of a profile menu that could bypass the app's closure flow. Browser clearing never silently erases cloud data; cloud erasure/closure never clears Guest collections, journeys, feedback, or Discovery Lab. Cloud erasure leaves login intact. Erasing only reward events resets Brave and Explorer; Door Collector reflects the current saved collection. Closing an account erases both data sets and signs out only after confirmed closure. A lost response is reported as unconfirmed, even if the server may already have committed; retrying is safe.

Deletion covers the app's active cloud tables. It is not a promise to remove existing backup copies, platform logs, downloaded exports, shared reward cards, or browser caches on other devices. Those copies have separate retention/control boundaries. A browser may show stale cached data until it reloads; server revisions prevent it from silently restoring that data.

### Schema setup

`server/schema.sql` is the canonical schema. The additive, idempotent development upgrade is `server/migrations/20261020-account-lifecycle.sql`; apply it to the development database before running the updated code. Task schema changes are carried into main's development database by the merge process; Replit's Publish flow applies the development schema diff to its managed production database. No startup or deployment-build DDL is used.

Discovery is public; saved-door and progress APIs require authentication. Do not treat a request ID as an identity token. Do not put credentials in source files, browser storage, issue reports, or screenshots. Store real credentials in the workspace secret manager and rotate them there if exposed.

The configured Qloo key status does not test the Qloo connection. A live request is the only connection attempt. API availability, rate limits, data accuracy, current venue status, and image availability are not guaranteed.

## Reporting a security issue

Do not include secrets or personal data in a public issue. Report the affected route, the impact, and a minimal non-sensitive reproduction to the repository maintainer through a private channel. This prototype has no staffed security response team or guaranteed response time.

## Rechecking

Run `npm test` and `npm run build`, then run the project’s dependency, static analysis, and secret/privacy scans. The deletion integration tests use a randomly named, isolated PostgreSQL schema and remove it afterward; set `DATABASE_URL` through the workspace configuration to run them (they skip when no database is configured). They never delete real Clerk accounts. Browser component fixtures check confirmations and error/status rendering without bypassing production authentication. Review scanner findings in context: scanner results are evidence to triage, not proof of security. Re-check dependencies before public releases.
