# Open Door threat model

## Project overview

Open Door is a React/Vite single-user prototype served by Express. It offers authored deterministic demo journeys and optional server-to-server Qloo Live discovery. It has no user accounts, server-side user database, admin console, LLM, or durable audit system.

## Assets

- Qloo API credential in the server environment.
- User-entered interests and optional location in browser state and Live discovery requests.
- User journey, saved doors, explicit feedback, and opened-door counts in browser localStorage.
- Qloo result data and returned image URLs.
- Process availability and bounded operational event records.

## Trust boundaries

1. User browser to Open Door server: public, unauthenticated JSON API; 24 KiB body limit, input validation, request ID, same-site browser mutation guard, and best-effort process-local rate limit.
2. Open Door server to Qloo: fixed HTTPS host and routes; server-held API key; 12-second timeout; bounded response parsing.
3. Browser to third-party content providers: Qloo-returned image URLs and Google Fonts stylesheet/font requests.
4. Development-only diagnostics: `/api/dev/audit` exists only in the development server; never use it as a production administrative interface.
5. Browser localStorage: user-controlled device storage, visible to scripts running on the same origin and not a secure vault.

## Scan anchors and evidence

- Dependency audit: Vite was upgraded from the vulnerable baseline to the patched Vite 6 line; final scan results must be reviewed after verification.
- Static analysis and secret/privacy scans: scan results must be re-run after implementation and interpreted in project context.
- Tests: `npm test` covers deterministic agent/Qloo behavior and the new security controls. Tests do not prove absence of vulnerabilities.

## STRIDE analysis

### Spoofing

There is no account identity to spoof because the app has no accounts. A request ID is correlation metadata, not identity. The public discovery API accepts unauthenticated requests; rate limiting and input rules do not authenticate callers.

### Tampering

Browser localStorage is user-editable and must not be trusted as authoritative. Inputs are validated server-side; the server uses a fixed Qloo destination and parameter encoding. Qloo data is treated as untrusted display data, not instructions. Operational events are process-local and not tamper-resistant.

### Repudiation

Request IDs and bounded operational events aid debugging, but events reset on restart and omit user inputs. They cannot establish a complete, durable user action history. No non-repudiation claim is made.

### Information disclosure

The Qloo key is server-only. Status endpoints expose whether it is configured, not its value. Live requests disclose interest text and limited supported location queries to Qloo. The browser may request Qloo-hosted images and Google Fonts, exposing normal network metadata to those services. localStorage can be read by same-origin JavaScript and is not suitable for secrets.

### Denial of service

Request body and anchor counts are bounded; a process-local rate limit and Qloo timeout reduce some abuse. The limiter is not distributed, may share limits among clients behind a proxy, and can reset on restart. No bot defense, queue, autoscaling guarantee, or upstream circuit breaker exists.

### Elevation of privilege

No admin or role-protected routes exist. Adding a visible admin console without real identity and server-side authorization would create a false security boundary; enterprise controls remain unimplemented.

## Residual risks and decisions

- The service is public and anonymous; do not expose confidential or regulated data.
- The Qloo credential’s lifecycle and hosting log retention are operational responsibilities.
- Third-party image and font services receive browser requests.
- There is no database backup, persistent audit trail, authentication, cross-user isolation, or independent security review.
- Controls shown in the Trust page describe current implementation or explicitly marked planned work; they are not certification evidence.
