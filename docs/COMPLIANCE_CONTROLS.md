# Compliance controls and current status

This is a product-control inventory, not a compliance attestation. Open Door has not been independently audited and does not claim SOC 2, ISO 27001, GDPR, HIPAA, PCI DSS, or other certification or legal compliance.

| Area | Current implementation | Status |
| --- | --- | --- |
| User identity and access | Optional Replit-managed Clerk sign-in; owner-scoped account APIs; inquiry management requires a server-verified Clerk admin role | Account and limited inquiry-admin boundaries implemented; not enterprise RBAC |
| User data storage | Guest collections, journey, feedback, and Lab state are browser-local; account-saved doors, opt-in preferences, reward events, lifecycle markers, and corporate inquiries are PostgreSQL-backed | Implemented with separate account/admin scopes |
| Personalization choice | Browser control stops persistence of journey, feedback, and opened-door history; in-memory work remains for the current page | Implemented |
| Export and deletion | Export of loaded data, browser-local deletion, account-data erasure and closure, and eventual Clerk reconciliation; see `SECURITY.md` for confirmations and failure boundaries | Implemented lifecycle controls; third-party/shared copies cannot be retracted |
| Server-side user database | Account-owned saves, opt-in preferences, minimal reward events, and lifecycle state; separate corporate inquiry records | PostgreSQL |
| Operational event trail | Bounded process-memory records and structured standard output; no discovery input fields | Best-effort only; volatile and not tamper-resistant |
| External service disclosure | Qloo Live requests, remote result images, and Google Fonts are described in the Trust view and third-party inventory | Implemented |
| Credential handling | Shared Qloo/Clerk/database secrets remain server-side; personal Qloo keys are submitted to the server and held only temporarily in process memory, never returned in status or persisted in browser/account storage | Implemented |
| Retention and backup | No application-level user-data retention or backup policy | Not implemented |
| Incident response | Maintainer guidance exists; no on-call team, SLA, or automated response workflow | Documented, not operationally staffed |
| Independent review | No completed independent penetration test or certification | Not performed |

Future enterprise work would build on the existing identity and account-ownership boundary with enterprise roles, durable access-controlled audit storage, explicit retention and deletion processes, backups, monitoring, incident ownership, and independent review. A visual console without those controls would not provide them.
