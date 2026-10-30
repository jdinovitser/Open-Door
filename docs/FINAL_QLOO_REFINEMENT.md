# Qloo discovery refinement — implementation and validation

Verified in the development workspace on October 30, 2026. This is not a claim that these workspace changes have been published.

## Changes

This is an extension of the existing React application, server-side Qloo orchestration, account storage, and browser-local Lab. No dependencies, credentials, database schema, navigation structure, or server routes were replaced.

| Files | Purpose |
| --- | --- |
| `src/ConnectionEvidence.tsx`, `src/connection-evidence.css` | Reusable, initially collapsed “Why this connection?” explanation with bounded, credential-filtered returned metadata. |
| `src/App.tsx` | Connect existing result cards to Debate, What If?, and Lab; reuse a group journey in Discover’s existing planner/save/download flow. |
| `src/experiences/TasteBridge.tsx`, `src/experiences/taste-bridge.css` | Emphasize The Bridge, show participants’ submitted interests, distinguish declared overlaps from Qloo retrieval, and retain connection provenance. |
| `src/experiences/journeyHandoff.ts`, `src/experiences/whatIf.ts` | Preserve public inputs, result references, and reusable entity IDs across experiences without transferring participant labels. |
| `src/experiences/DiscoveryDebate.tsx`, `src/experiences/debate.css` | Accept a selected discovery directly and compare the preserved original with actual returned alternatives. |
| `src/experiences/WhatIfExplorer.tsx` | Accept a captured journey and preserve its original and alternative in Lab. |
| `src/lab/engine.ts`, `src/lab/useDiscoveryLab.ts` | Import two existing paths as independent sibling branches under a shared checkpoint without another API request or deleting prior branches. |
| `tests/discovery-refinement.test.mjs`, `src/experiences/tasteBridge.browser.spec.ts` | Cover handoffs, exclusions, snapshots, group planning, comparison import, reload, privacy, and mobile overflow. |
| `tests/browser/inline-discovery.spec.ts`, `tests/browser/lab-connected.spec.ts` | Update legacy tests to open existing collapsed controls and use current accessible labels. Product controls were not redesigned to satisfy old selectors. |

## Evidence and Taste Bridge

“Why this connection?” separates Qloo-grounded retrieval information from Open Door’s **rule-based interpretation, not AI-generated text**. Open Door does not use an LLM for these explanations. Source entity information, popularity, and explainability are shown only when recorded; popularity and application routing labels are not presented as affinity.

- **Shared Ground:** exact overlapping interests declared by participants, explicitly labeled user input rather than a Qloo finding. A familiar result is not proof of universal preference.
- **The Bridge:** the visually emphasized adjacent direction, alongside participants’ starting interests. Resolved query inputs are attributed only where their IDs match the result’s recorded source IDs. Combined-interest retrieval is not proof of pairwise relationships.
- **The Wild Card:** only a returned Unexpected result confirmed as cross-category fills this slot. Missing results remain missing; a same-category fallback is not relabeled.

Existing animated mascots, door interactions, save controls, and guest/account distinctions remain. “Plan this journey together” uses the same returned results in Discover without a new request. Participant labels remain in the Taste Bridge component.

## Reconsideration and preservation

A result can open Debate directly. Evidence-only questions remain local; retrieval challenges use the existing Qloo operation, retaining the selected entity ID, public context, explicit feedback, and exclusions. All results from the originating journey are excluded when challenging a handed-off discovery.

What If? captures the original and changes only approved controls. It can still return unchanged entities; unchanged results are not advertised as new matches.

“Preserve both paths in Discovery Lab” imports the original and returned alternative as separately resumable sibling branches. This is a historical evidence import, **not another Qloo request**. Existing checkpoints/branches remain. A current uncheckpointed Lab draft requires confirmation to save it before importing.

What If? starting-result references may retain less metadata than a complete live response. Imported references say when detailed historical evidence is unavailable rather than reconstructing it.

## Executed checks

- Production build: passed. The existing large-bundle warning remains.
- `npm test`: **114 passed, 0 failed**, including PostgreSQL account isolation, persistence, preference consent, deletion/lifecycle, server orchestration, and Lab unit/integration checks.
- `node --test src/experiences/*.test.mjs`: **34 passed, 0 failed**.
- Experience browser suite: **24 passed, 0 failed**.
- Additional Solo/inline discovery, connected-Lab, guest/progress checks: **14 passed across targeted final runs**. Initial runs exposed stale collapsed-control selectors and obsolete labels; those test interactions were corrected and the affected cases rerun successfully.
- Desktop (1280 px) and phone (390 px) result layouts inspected; no horizontal overflow.
- Original and alternative histories, browser reload, saves, empty results, cancellation, failures, shared/personal connection selection, and privacy boundaries exercised by the automated checks.

### Real Qloo browser verification

No mocked discovery responses were used in this additional end-to-end browser run:

1. Nina Simone and Spirited Away were submitted as two participants’ cultural interests.
2. Qloo Search and Insights returned Chet Baker, Tokyo, and Shinjuku.
3. Tokyo was handed directly into Debate.
4. “Retrieve something more unexpected” reused Tokyo’s Qloo ID, applied “Too familiar” feedback, and excluded all three original results.
5. A new Insights operation returned Kyoto and Union Square Park.
6. Tokyo and the two alternatives were preserved as separate Lab branches, with no additional Qloo request.
7. The browser reported no uncaught page errors.

The reconsideration completed with **partial results**: one Insights call failed and two distinct supported routes remained. The app displayed the warning and did not fill the missing route with sample content.

Development evidence and screenshots are in the ignored `generated-artifacts/refinement-verification/` directory, including `live-browser.json`, `bridge-desktop.png`, `bridge-mobile.png`, and `debate-comparison.png`.

## Limits and outstanding checks

- An actual signed-in Clerk browser session was not exercised. Account and PostgreSQL behavior was tested through the existing automated account tests; the rendered signed-in UI remains unverified in this run.
- Personal-connection selection was covered using controlled browser tests, not an additional user-supplied live key.
- The failed upstream Insights route warrants separate investigation. The partial-result handling was verified; the cause was not established or hidden.
- No claim is made that constraints verify accessibility, medical suitability, current prices, opening hours, or local availability.
- The published app must be updated separately through publishing.
