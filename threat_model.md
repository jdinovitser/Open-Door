# Open Door threat model

Implementation reference updated **October 30, 2026**. This describes trust boundaries and required guarantees, not a completed independent security audit.

## Project overview

Open Door is a React/TypeScript/Vite application served by Express. Public guest discovery uses server-to-server Qloo Search and Insights; prepared examples are separately authored content. Optional Clerk authentication enables PostgreSQL-backed account saves, opt-in preferences, and reward events. A public corporate inquiry form stores contact requests; a restricted admin workflow reads and manages them. Discovery Lab histories and full journeys remain browser-local.

The recommendation workflow is custom structured orchestration, not an LLM or arbitrary tool-execution agent. External partner API/MCP access is not implemented.

## Assets

- Shared Qloo and Clerk server credentials and the database connection credential.
- Personal Qloo keys held temporarily in server-process memory and the cookie identifiers granting access to those connections.
- Clerk identity/session metadata and account-owned saved doors, preferences, reward events, and lifecycle markers.
- Corporate inquiry contact details, project descriptions, and review status.
- User interests, optional location, feedback, local journeys, Lab checkpoints/branches, and exported/shared content.
- Qloo result metadata and third-party image URLs.
- Service availability, upstream API quota, and bounded operational diagnostics.

## Trust boundaries

1. **Browser → public API:** anonymous discovery, connection setup, and inquiry submission require bounded, validated inputs, mutation-origin controls, and rate limiting. Public access is not authentication.
2. **Browser → authenticated account API:** the server derives ownership from the verified Clerk session. Client-supplied user IDs or browser state MUST NOT determine ownership.
3. **Authenticated user → inquiry admin:** reads, status updates, and deletion require a server-verified Clerk user whose `publicMetadata.role` is `admin`. A visible UI or client claim is not authorization.
4. **Server → PostgreSQL:** parameterized queries and account-scoped transactions protect saved doors, preferences, progress, and lifecycle state. Inquiry records have a separate admin access boundary.
5. **Server → Qloo:** fixed HTTPS host/routes, bounded requests/responses, timeouts, and selected server-held credentials. Personal connections MUST NOT silently fall back to the shared key.
6. **Browser/server → Clerk:** Clerk manages authentication; session validation, role lookup, and account cleanup depend on its availability. Unconfirmed identity-service errors MUST NOT trigger destructive cleanup.
7. **Browser → third parties:** returned HTTPS image hosts and Google Fonts receive ordinary request metadata. Google Maps links and social sharing leave the application; exported material is outside its deletion boundary.
8. **Browser storage:** guest saves, full journeys, session drafts, and Lab branches are user-controlled, same-origin script-readable data, not a secure vault or account authority.
9. **Development diagnostics:** `/api/dev/audit` is development-only, not a production admin interface.

## Scan anchors

- Production entry: `server/index.js`; shared request controls in `server/security.js` and `server/policy.js`.
- Identity/data isolation: `server/accountSavedDoors.js`, `server/accountPreferences.js`, `server/accountLifecycle.js`, schema and migrations.
- Credentials/upstream data: `server/qlooConnections.js`, `server/qloo.js`, `server/agent.js`.
- Public insert/admin-only contact-data access: `server/companyInquiries.js`.
- Browser journeys, Lab state, and share/export rendering under `src/` cross data/display boundaries. Generated recordings, archived files, and skill examples are not production entry points.

## Threat categories

### Spoofing

Compromised or improperly validated sessions could expose another person's account data or corporate inquiries. Account APIs MUST validate Clerk identity and derive the owner server-side; inquiry admin routes MUST verify the role on the server and fail closed when it cannot be checked. Personal-connection tokens MUST be unpredictable; their cookie holds an identifier, never the Qloo key, and uses HttpOnly, SameSite=Strict, and Secure on HTTPS. Request IDs are diagnostic metadata, not identity.

### Tampering

Browser storage, saved-door payloads, reward events, scenarios, and Qloo metadata are untrusted inputs. The server MUST enforce validation, owner scoping, save limits, parameterized queries, idempotent progress, and lifecycle/revision checks. Erasure and closure MUST prevent stale client writes from restoring deleted data. Remote strings MUST be rendered as data, not executable markup or instructions. Inquiry consent, bounded fields, and server-verified status changes protect the separate contact workflow.

### Repudiation

Request IDs and process-local operational events aid debugging but are not a tamper-resistant action history. Database timestamps and inquiry statuses are not a comprehensive security audit. No durable audit or non-repudiation guarantee is claimed; administrative access and deletion remain operational responsibilities.

### Information disclosure

Credentials MUST NOT appear in client bundles, browser storage, account tables, API responses, traces, or logs. Personal keys are entered through the connection form and sent to the server, but MUST NOT be returned after connection setup. They expire or disappear on disconnect/restart. Account queries MUST remain owner-scoped; public inquiry submission MUST NOT expose stored contact records. Saved doors and opt-in preferences can contain personal context and require explicit storage choices.

Only approved discovery inputs should reach Qloo; free-form scenario/debate drafts and participant labels have separate browser-session boundaries. Account erasure/closure and Clerk reconciliation MUST follow the lifecycle controls documented in `docs/SECURITY.md`. Deleting app data cannot retract a downloaded document, shared story, external request, or third-party retention. Never enter confidential or regulated information.

### Denial of service

Anonymous discovery consumes shared Qloo quota; inquiry spam, account writes, and role lookups also consume resources. Bounded inputs, upstream timeouts, per-route limits, and bounded database operations reduce abuse but do not guarantee availability. Process-local rate limits and personal-key storage reset on restart and are not fleet-wide. Autoscaled requests may reach a process without the personal connection; that must fail visibly, not switch credentials. No distributed quota protection, load-test guarantee, or uptime SLA is claimed.

### Elevation of privilege

Account owners MUST NOT read or modify another owner's saves, preferences, or progress. Ordinary authenticated users MUST NOT access inquiry admin routes. The implemented inquiry role is narrow: it is not enterprise tenant isolation, a partner account platform, or generalized enterprise RBAC. Future partner APIs, billing, or MCP tools would introduce new authorization boundaries and require a separate review.

## Residual risks and decisions

- Guest use remains public. Optional accounts add real cross-user data-isolation obligations, not a general security certification.
- Clerk/database/Qloo availability, backup and retention policies, credential rotation, and admin-role assignment need operational oversight.
- Account cleanup is eventually consistent and runs only while the server is running; upstream failures are not proof that an identity was deleted.
- Browser storage is unencrypted and third-party images/fonts receive network metadata.
- No independent security review, durable security audit, distributed rate limiter, or compliance certification is claimed.
- Automated fixtures and scan results are evidence to interpret, not proof of live availability or absence of vulnerabilities.
