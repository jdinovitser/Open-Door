# Judging criteria and evidence

Updated **October 30, 2026** to reflect the current implementation. Start with the [README](../README.md), [Judge’s Guide](https://open-door.replit.app/judges), and [guide PDF](https://open-door.replit.app/Open-Door-Judges-Guide.pdf).

## Rubric reference

The [official rules](https://qloo.devpost.com/rules) and [event page](https://qloo.devpost.com/) control eligibility and judging. The rubric below follows the rules reviewed on October 20, 2026; this documentation update is not a new rules review or an eligibility decision.

Stage One assesses viability, theme fit, and application of the required technology. Stage Two lists four equally weighted criteria. This document maps implementation evidence to those criteria; it assigns **no internal scores or predicted judge scores**.

| Criterion | Current implementation evidence | Where to inspect | Limits and final checks |
|---|---|---|---|
| Technological Implementation | Server-side Qloo Search → resolved entity IDs → multiple Insights requests → candidate evaluation → provenance-bearing results. Feedback changes subsequent routing; continuation reuses returned entity IDs. Discovery Lab maintains independent branches from a checkpoint. | `server/qloo.js`, `server/agent.js`, `server/qlooConnections.js`, their tests; live trace, cultural graph, Discovery Lab | Successful live Search, Insights, continuation, and independent Lab requests have been verified in this workspace. Fixture tests independently cover contracts and errors. Recheck the final published build; configured-key status alone is not request evidence. |
| Design | Two entry paths; four complementary personal experiences; animated three-door reveal; inline recommendations, maps links, planner, downloads, saves, badges, and Trust controls | Public app, `/judges`, feature deep dives, `docs/DEMO_SCRIPT_UPDATED.md` | The recording includes real retrieval and guest saves. Its rewards view is a labeled artwork preview, not proof of signed-in synchronization. Do not equate visual checks with accessibility certification. |
| Potential Impact | Personal exploration and planning for others, including groups, destinations, and occasions. Optional accounts retain chosen doors and preferences; partnership mockups illustrate a possible business model. | Personal and Help others explore paths, account controls, partnership pages | No validated retention, revenue, customer adoption, or user-outcome measurements. Hours, prices, availability, travel time, and accessibility are not verified. |
| Quality of the Idea | Qloo-grounded cross-domain discovery with familiar, adjacent, and unexpected routes; Taste Bridge, What If? Explorer, Discovery Debate, and checkpoint-based branch comparisons | Three-door results, evidence inspector, personal experience tabs, `/lab` | Route labels are Open Door editorial choices, not Qloo affinity or distance scores. Group-conditioned retrieval does not prove everyone will like a result. |

## What makes the orchestration agentic

Open Door uses **custom structured tool orchestration**, not an LLM or conventional agent framework:

1. Validate the user's named interests and explicit discovery controls.
2. Resolve interests through Qloo Search, or preserve the exact Qloo ID of a selected prior result.
3. Select result types and issue multiple Qloo Insights requests.
4. Evaluate returned candidates, remove duplicates, and exclude previously opened entities.
5. Route the next request using explicit feedback rather than inventing prices or schedules.
6. Continue from returned entities, preserving their identity and provenance.
7. In Discovery Lab, freeze a checkpoint and explore independent branch histories; compare the recorded requests and returned results rather than regenerate a supposed past result.

This bounded, stateful tool sequence is the basis for the agentic-tool claim. Open Door does not autonomously browse, call arbitrary tools, use a generative model, or expose hidden model reasoning. The organizer decides whether this implementation satisfies the contest requirement.

## Evidence boundaries and submission checks

- Shared **Demo** uses the existing live Qloo API connection. **Try prepared examples** and `/demo` are separately labeled authored samples, not live Qloo evidence.
- A successful live response proves that request, not guaranteed future availability or that every published version has been checked.
- The public app is at https://open-door.replit.app/ and source is at https://github.com/jdinovitser/Open-Door. Check both anonymously before submission.
- Inspect successful responses, entity continuity, feedback routing, partial/empty results, and visible failure handling. Never publish credentials or raw private request data as evidence.
- Scenario interpretation and debate replies use disclosed deterministic rules. Qloo provides cultural retrieval, not medical advice, venue-suitability checks, or generated conversation.
- Confirm the actual Devpost entry, entrant eligibility, licenses, and final links separately; repository documentation does not establish submission or acceptance.
