# Compliance controls and current status

This is a product-control inventory, not a compliance attestation. Open Door has not been independently audited and does not claim SOC 2, ISO 27001, GDPR, HIPAA, PCI DSS, or other certification or legal compliance.

| Area | Current implementation | Status |
| --- | --- | --- |
| User identity and access | Optional Replit-managed Clerk sign-in; owner-scoped saved-door and progress APIs; no enterprise roles or admin endpoints | Basic account boundary implemented |
| User data storage | Guest collections, journey, feedback, and Lab state are browser-local; account-saved doors and reward events are PostgreSQL-backed | Implemented with separate scopes |
| Personalization choice | Browser control stops persistence of journey, feedback, and opened-door history; in-memory work remains for the current page | Implemented |
| Export and deletion | JSON export of loaded data, browser-local deletion, and account-saved door deletion; complete cloud-progress erasure and account-closure cleanup remain future work | Partial account lifecycle |
| Server-side user database | Account-owned saved doors and minimal opened-door reward events | PostgreSQL |
| Operational event trail | Bounded process-memory records and structured standard output; no discovery input fields | Best-effort only; volatile and not tamper-resistant |
| External service disclosure | Qloo Live requests, remote result images, and Google Fonts are described in the Trust view and third-party inventory | Implemented |
| Credential handling | Qloo and Clerk secret keys and database connection are server-only and omitted from public status | Implemented |
| Retention and backup | No application-level user-data retention or backup policy | Not implemented |
| Incident response | Maintainer guidance exists; no on-call team, SLA, or automated response workflow | Documented, not operationally staffed |
| Independent review | No completed independent penetration test or certification | Not performed |

Future enterprise work would build on the existing identity and account-ownership boundary with enterprise roles, durable access-controlled audit storage, explicit retention and deletion processes, backups, monitoring, incident ownership, and independent review. A visual console without those controls would not provide them.
