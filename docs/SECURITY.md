# Security

Open Door is a single-user prototype, not a hosted multi-tenant service. It has no accounts, authentication, authorization roles, server-side user database, or durable audit log. Do not use it to store confidential or regulated information.

## Controls implemented

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

The rate limit, audit buffer, and event sequence are process-local. They reset on restart, are not tamper-resistant, and are not a complete record of user activity. Standard output may be captured under the hosting platform’s own log-retention policy. There is no account isolation, administrator access control, persistent retention policy, backup, or automated incident alerting.

The app is public and unauthenticated. Do not expose private data or treat a request ID as an identity token. Do not put credentials in source files, browser storage, issue reports, or screenshots. Store real credentials in the workspace secret manager and rotate them there if exposed.

The configured Qloo key status does not test the Qloo connection. A live request is the only connection attempt. API availability, rate limits, data accuracy, current venue status, and image availability are not guaranteed.

## Reporting a security issue

Do not include secrets or personal data in a public issue. Report the affected route, the impact, and a minimal non-sensitive reproduction to the repository maintainer through a private channel. This prototype has no staffed security response team or guaranteed response time.

## Rechecking

Run `npm test` and `npm run build`, then run the project’s dependency, static analysis, and secret/privacy scans. Review scanner findings in context: scanner results are evidence to triage, not proof of security. Re-check dependencies before public releases.
