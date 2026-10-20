# Final submission readiness

**Review date: October 20, 2026. Overall status: NOT READY TO SUBMIT.**

The local app and prepared Demo are runnable. The required public demo, public repository, completed Devpost entry and real-Qloo verification are not yet available. No claim of hackathon acceptance, production readiness, compliance certification or winning probability is made.

## Official rules compliance checklist

Sources: [official rules](https://qloo.devpost.com/rules), [event page](https://qloo.devpost.com/), [Qloo developer guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide). Checked October 20, 2026.

| Requirement | Status | Evidence / next action |
|---|---|---|
| Submit by **October 30, 2026, 11:45pm Eastern** | FIX BEFORE SUBMISSION | Deadline verified; entry has not been submitted. |
| Eligible entrant, age/jurisdiction/conflicts; authorized team representative if applicable | FIX BEFORE SUBMISSION | Owner must confirm against section 3 and team rules. Not inferable from source code. |
| Working Qloo-integrated agentic application | FIX BEFORE SUBMISSION | Structured integration exists; Qloo is not configured and no real response is verified. Organizer decides agentic/theme eligibility. |
| New project or qualifying Qloo update during the submission period | FIX BEFORE SUBMISSION | Entrant must confirm development timing and describe changes if pre-existing. |
| Functional, externally hosted, fully published demo | FIX BEFORE SUBMISSION | Deployment service reports **not deployed**. Workspace preview is not a submission URL. |
| Free, unrestricted judge access through **November 16, 2026, 11:45pm Eastern** | FIX BEFORE SUBMISSION | Publish publicly, test anonymously, retain service/key availability throughout judging. |
| Public GitHub/GitLab/Bitbucket source repository with runnable instructions/assets | FIX BEFORE SUBMISSION | Workspace has no Git repository metadata; no public repository URL is available. |
| Open-source license detectable in repository About | FIX BEFORE SUBMISSION | MIT `LICENSE` exists locally; confirm detection on the actual public repository. |
| English text description of features/functionality | FIX BEFORE SUBMISSION | `DEVPOST_DRAFT.md` prepared; final entry and links not verified or submitted. |
| Original work, third-party permissions and license compliance | FIX BEFORE SUBMISSION | Entrant must confirm ownership and API/media rights. Direct package metadata reviewed below; that is not a legal opinion or full transitive license audit. |
| Required demo video | PASS — NOT REQUIRED | Official event page explicitly says videos are not required. Optional media must accurately depict this build. |
| Required screenshots / fixed screenshot count | PASS — NOT SPECIFIED | No such requirement found in the checked official rules. Optional screenshots improve evidence; check actual Devpost form before submission. |
| Required LLM provider/framework | PASS — NOT SPECIFIED | Official alternatives allow an agentic tool, an agent-framework app, or Qloo in an existing agent. No specific LLM provider is mandated. |
| Match submitted claims to actual functionality | FIX BEFORE SUBMISSION | Draft is explicit about limitations; final public app and final entry still require a side-by-side check. |

## Gaps fixed in this pass

- Added the official four-criterion scorecard, evidence map, compliance checklist, product rationale and ready-to-edit Devpost draft.
- Made the opening value proposition explicit.
- Moved the actual door cards ahead of supporting DNA/graph content so the mobile demo reaches its core choices sooner.
- Added a visible applied-feedback summary, distinguishing live search routing from deterministic Demo adaptation.
- Added an explicit Demo recovery action for live failures.
- Removed the blanket “privacy-safe” sharing claim; interests can still be personal. Canceling the native share dialog no longer triggers a clipboard fallback.
- Added a keyboard skip link and basic guards against malformed top-level browser storage.
- Added social-preview metadata/artwork and upstream failure regression tests. Production canonical/image URLs and crawler behavior still need the real published origin.
- Made `/demo` independent of configuration/network status and kept it deterministic even when a Qloo key is configured. Live remains an explicit user choice.
- Prepared server-based autoscale publishing settings (`npm run build`, then `npm start`); this did not publish the app.

## Verification and limits

- Automated verification: **24/24 tests passed**, followed by a successful TypeScript/Vite production build.
- Production output includes the 1200×630 JPEG social card; initial JS is approximately 249 kB (75.7 kB gzip), CSS 59 kB (13.7 kB gzip). These are build sizes, not measured user-perceived performance.
- The development workflow starts successfully and `/api/health` reports API operational, Qloo not configured. No production service has been tested.

### Qloo

The key stays server-side; the host is fixed to `https://hackathon.api.qloo.com`; endpoints, entity types and parameters are explicit. Requests have timeouts and response/request size limits. Auth, rate-limit, network, timeout and invalid-response errors are explicit. **All automated Qloo tests use fixtures. No real Qloo service call is verified.**

Before submission, demonstrate Search resolution, multiple Insights calls, entity IDs, returned evidence, feedback routing and continuation with a real hackathon key on the public app. A green configuration status alone is insufficient.

### Agent

The custom structured orchestrator performs validation, resolution, route selection, retrieval, evaluation and continuation. Feedback changes requested result types, not verified prices or hours. It is not an LLM agent and does not expose chain-of-thought. Core orchestration is fixture-tested; live adaptation remains unverified.

### Demo

`/demo` is an authored deterministic sample. Its labels explicitly say so, and it does not automatically call Qloo. Desktop home and a 402px mobile Demo viewport were visually checked. Cards now precede supporting diagrams. Open/reject/continue/save/delete/share interactions and browser permission/cancellation cases still need full browser regression checks; screenshots cannot prove those behaviors.

### Security and privacy

See `SECURITY.md`, `COMPLIANCE_CONTROLS.md`, `INCIDENT_RESPONSE.md`, `THIRD_PARTY_SERVICES.md` and `../threat_model.md`. The app has no login, billing, database, admin/RBAC, tenant separation or compliance certification. Local browser data is not encrypted; deleting it cannot retract a story already shared. Fonts/images can make external requests.

Server validation, restricted tools, request IDs, security headers, bounded payloads, cross-site mutation protection and process-local rate limiting/audit exist. Process-local controls are not durable or fleet-wide. Prior scan results: zero dependency vulnerabilities, zero HoundDog findings, three medium SAST findings in unused skill-template code—not a guarantee of security.

### Devpost

The draft exists; the actual Devpost entry has not been accessed, completed or submitted. Check the final form, links, contributor details, claims and images manually before submitting. No team/eligibility declaration was made on the user's behalf.

## Deliberately deferred

1. **External prerequisites:** real Qloo credential, live verification, public publishing, public repository, final Devpost submission and entrant declarations. These cannot be replaced with generated evidence.
2. **Accessibility/browser proof:** interactive keyboard, screen reader, touch, 200% zoom, Safari/Firefox and full flow regressions. Current visual/code checks are not a WCAG certification.
3. **Practical planning accuracy:** verify which Build My Day preferences affect sequencing; no hours, prices, travel time or booking availability is currently verified.
4. **Impact validation:** no user research, validated demand, adoption/retention statistics or measured reduction in loneliness. The business case is a hypothesis.
5. **Scale/operations:** no distributed rate limiter, durable audit, load test, uptime SLA or quota telemetry. Avoid broad public promotion until cost/abuse behavior is evaluated.
6. **Enterprise expansion:** auth, admin, SSO, billing, database and compliance certification are not needed to prove the current concept and are not claimed as shipped.

## Package and asset review

Direct installed package metadata: React/React DOM/Express/Vite/plugin-react/React type definitions — MIT; Lucide React — ISC; TypeScript — Apache-2.0. Retain their applicable notices. This is not a full transitive-license or legal review.

The lockfile lists 183 dependency packages: MIT 168, ISC 10, Apache-2.0 2, BSD-3-Clause 2, CC-BY-4.0 1; none has an unlisted license field. Non-MIT/ISC packages include TypeScript and baseline-browser-mapping (Apache-2.0), qs and source-map-js (BSD-3-Clause), and caniuse-lite (CC-BY-4.0). Metadata inventory is not a substitute for reviewing their license/notice obligations.

The architectural door graphics are project-authored SVG/CSS artwork. The mascot poses, concept art and logo illustration were supplied by the user; the social card now uses that supplied logo illustration. Selected animations are optimized WebP files with reduced-motion stills and pause controls. None of this artwork is Qloo evidence. Remote images and Google Fonts are presentation dependencies, not cultural evidence; verify usage terms and fallbacks for submission. Qloo API access remains subject to Qloo terms. The MIT project license does not automatically relicense supplied or third-party artwork.

## Final go/no-go

Do **not** submit until all “FIX BEFORE SUBMISSION” rows are resolved or the organizer explicitly clarifies an exception. Retest the published app anonymously and keep it available through the end of judging. Recheck the official rules immediately before submission.
