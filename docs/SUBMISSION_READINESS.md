# Submission readiness and final checks

**Updated October 30, 2026.** This is a final-check reference, not an assertion that Devpost has been submitted or that the organizer has accepted the project.

## Current evidence

- **Public application:** https://open-door.replit.app/
- **Public source:** https://github.com/jdinovitser/Open-Door
- **Judge’s Guide:** https://open-door.replit.app/judges
- **Guide PDF:** https://open-door.replit.app/Open-Door-Judges-Guide.pdf
- **License:** [MIT](../LICENSE).
- **Live Qloo:** successful Search resolution, multiple Insights requests, entity-led continuation, and independent live Discovery Lab branches have been verified in this workspace. Recorded successful requests and live provenance are distinct from fixture tests.
- **Accounts:** optional Clerk sign-in with PostgreSQL-backed saved doors, opt-in preferences, reward events, and lifecycle controls. Full journeys and Lab histories remain browser-local.
- **Demo recording:** described in [the current script and capture notes](DEMO_SCRIPT_UPDATED.md); includes real Qloo retrieval and guest saves. Rewards are shown as a labeled preview, and voice input is shown as a control rather than live microphone transcription.

See the [README](../README.md) for the current feature inventory and setup, [integration notes](HACKATHON_INTEGRATIONS.md) for tool/provenance boundaries, and [judging evidence map](JUDGING_CRITERIA.md) for the technical explanation. Older prototype readiness assessments are superseded by these documents.

## Final checks before submitting

The [rules](https://qloo.devpost.com/rules) and [event page](https://qloo.devpost.com/) are authoritative. Dates and requirements previously reviewed on October 20, 2026 must be rechecked against the final form; this update does not independently certify compliance.

| Check | What remains to confirm |
|---|---|
| Deadline and eligibility | Entrant confirms current deadline, jurisdiction, age, conflicts, representative authority, and qualifying development period. |
| Public access | Open the published app, repository, guide page, and PDF anonymously. Ensure the latest workspace changes are actually published and repository changes are pushed. |
| Qloo availability throughout judging | Start a fresh live request on the published build. Verify Search/Insights provenance and continuation; keep the shared connection available within its quota. A previous success is not an uptime guarantee. |
| Core workflow | Show all three doors and opening animation, then recommendation details, feedback, continuation, planner, maps links, and downloads. |
| Expanded experiences | Check Taste Bridge, What If? Explorer, Discovery Debate, Help others explore, and Discovery Lab checkpoint/branch comparison. |
| Account isolation | Check sign-in, account-owned saves, optional preference consent, progress, and deletion with test accounts. Do not imply that browser-local Lab history syncs. |
| Errors and privacy | Confirm visible upstream errors and no silent live-to-sample fallback. Inspect Trust and ensure credentials/private data are not exposed in shared evidence. |
| Repository and media | Confirm MIT detection, runnable instructions, current screenshots/video links, asset permissions, and consistency between README, guides, and the final entry. |
| Devpost entry | Owner confirms completion, actual URLs, contributor details, claims, and submission status. Do not infer these from source files. |

## Technical and product boundaries

Open Door is a custom structured orchestrator, not an LLM agent or a conventional agent-framework application. Its tool sequence resolves entities, retrieves Insights, evaluates candidates, routes using feedback, preserves entity continuity, and supports independent exploration branches. The organizer determines whether that meets the agentic-tool requirement.

Shared **Demo** means live Qloo access; **Try prepared examples** and `/demo` mean authored samples. Neither a configured key nor fixture tests establish that a particular live request succeeded.

Practical planning inputs do not verify venue hours, prices, accessibility, travel time, or booking availability. Route tiers and reward badges are Open Door interaction concepts, not Qloo affinity scores or verified real-world accomplishments. Partnership placements are illustrative mockups, not paying customers or a functioning advertising network. External partner API/MCP access remains a roadmap idea.

## Verification and security limits

Run `npm test` and `npm run build` for the current checkout; do not reuse historical test totals or bundle sizes as current evidence. Browser checks, live service checks, and security scans serve different purposes. Passing any one does not establish all the others.

See [security controls](SECURITY.md), [third-party data flows](THIRD_PARTY_SERVICES.md), and the [threat model](../threat_model.md). Account and admin-inquiry boundaries exist, but this is not an enterprise security certification. Process-local rate limits, connection storage, and diagnostics reset with server processes; no distributed quota protection, durable security audit, or uptime SLA is claimed.

No user study, measured adoption, retention, revenue, or independently validated impact is claimed. Verify package notices and supplied/third-party asset rights separately; the MIT code license does not automatically relicense every asset.
