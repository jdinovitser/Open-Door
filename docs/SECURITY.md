# Security

Open Door offers public Guest exploration and optional Replit-managed Clerk sign-in. Account-saved doors and reward events are stored in PostgreSQL and scoped to the authenticated owner. It has no enterprise authorization roles or durable audit log. Do not use it to store confidential or regulated information.

## Controls implemented

- Account APIs require a Clerk-authenticated session. Owner IDs come from server-side authentication, never request bodies. Saved-door and reward queries use parameterized SQL and explicit owner filters.
- Saved-door writes use bounded field allowlists, per-account limits, owner-scoped delta updates, and a serialized transaction. Reward events are idempotent per account and door; rewards are personal tallies, not independently verified achievements.
- Guest collections are kept separate from account caches. Guest-saved doors can be imported at sign-in; full journey, feedback, and Discovery Lab state remain browser-local.
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

The rate limit, audit buffer, and event sequence are process-local. They reset on restart, are not tamper-resistant, and are not a complete record of user activity. Standard output may be captured under the hosting platform’s own log-retention policy. Account isolation is implemented, but administrator roles, an application-level retention/backup policy, automatic account-deletion cleanup, and automated incident alerting are not.

Discovery is public; saved-door and progress APIs require authentication. Do not treat a request ID as an identity token. Do not put credentials in source files, browser storage, issue reports, or screenshots. Store real credentials in the workspace secret manager and rotate them there if exposed.

The configured Qloo key status does not test the Qloo connection. A live request is the only connection attempt. API availability, rate limits, data accuracy, current venue status, and image availability are not guaranteed.

## Reporting a security issue

Do not include secrets or personal data in a public issue. Report the affected route, the impact, and a minimal non-sensitive reproduction to the repository maintainer through a private channel. This prototype has no staffed security response team or guaranteed response time.

## Rechecking

Run `npm test` and `npm run build`, then run the project’s dependency, static analysis, and secret/privacy scans. Review scanner findings in context: scanner results are evidence to triage, not proof of security. Re-check dependencies before public releases.
