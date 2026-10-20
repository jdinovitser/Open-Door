# Compliance controls and current status

This is a product-control inventory, not a compliance attestation. Open Door has not been independently audited and does not claim SOC 2, ISO 27001, GDPR, HIPAA, PCI DSS, or other certification or legal compliance.

| Area | Current implementation | Status |
| --- | --- | --- |
| User identity and access | No accounts, SSO, roles, or admin endpoints | Not implemented |
| User data storage | Browser localStorage for journey, saved doors, explicit feedback, and opened-door counts | Implemented locally |
| Personalization choice | Browser control stops persistence of journey, feedback, and opened-door history; in-memory work remains for the current page | Implemented |
| Export and deletion | User-initiated JSON export and browser-local delete controls | Implemented |
| Server-side user database | None | Not used |
| Operational event trail | Bounded process-memory records and structured standard output; no discovery input fields | Best-effort only; volatile and not tamper-resistant |
| External service disclosure | Qloo Live requests, remote result images, and Google Fonts are described in the Trust view and third-party inventory | Implemented |
| Credential handling | Qloo key is server-only and omitted from public status | Implemented |
| Retention and backup | No server-side user-data retention or backup system | Not implemented |
| Incident response | Maintainer guidance exists; no on-call team, SLA, or automated response workflow | Documented, not operationally staffed |
| Independent review | No completed independent penetration test or certification | Not performed |

Future enterprise work would need a real identity provider, server-side authorization on every protected route, secure secret/key lifecycle, durable access-controlled audit storage, explicit retention and deletion processes, backups, monitoring, incident ownership, and independent review. A visual console without those controls would not provide them.
