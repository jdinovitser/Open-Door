# Phase 1: Taste Bridge

Open `/?view=taste-bridge`, or use the subordinate **Taste Bridge** experience tab.
The existing main navigation and solo discovery remain intact.

## Integration

- Uses `runAgentDiscovery(request, onEvent, signal)` and the App's selected shared/personal connection. No alternate recommendation engine, provider, dependency, or backend changes.
- Sends the full deduplicated, explicitly typed interest set in one request. The status policy's anchor limit is enforced before sending (current fallback: five). Over-budget groups must edit their inputs; no truncation or hidden partial batching.
- Participant labels and attribution snapshots live only in React memory. Names/participant IDs are not added to API requests, localStorage, saved doors, or journeys.
- Existing `DoorCard`, App `toggleSave`, and `exploreSaved` paths handle details, saves, and entity-seeded continuation. Bridge saves explicitly retain live provenance even when the solo journey is a demo.
- Leaving the experience cancels its pending request; its inputs and completed result remain available on return within the mounted App.
- Reuses actual MascotArt WebP animation/still assets with one responsive sizing rule for introductions, loading, and empty states.

## Evidence boundaries

The server returns Insights candidates conditioned on a combined resolved seed set. Participant attribution requires a matching resolved label/category and a returned `sourceEntityIds` entry. Unresolved inputs receive no credit. Approximate Search resolutions are visible for review.

Shared Ground / The Bridge / The Wild Card are Open Door presentation routes, not Qloo affinity scores. Results do not prove universal preference or pairwise cultural links. Missing routes stay missing. An Unexpected result without confirmed cross-category metadata is displayed separately, never presented as a confirmed wild card.

## Checks

Run from the workspace root:

```sh
node --test src/experiences/tasteBridge.test.mjs
TEST_BASE_URL=http://127.0.0.1:5000 npx playwright test -c src/experiences/playwright.config.ts
npm test
npm run build
```

The dedicated Playwright config keeps new tests under `src/experiences`; the default repository test globs do not include these focused tests automatically.

Browser tests intercept the real existing discovery/status endpoints with deterministic fixtures; they verify request wiring and UI behavior, not availability of an external Qloo service. No external API or database is required by these tests. Scenarios cover similar/different tastes, all five participants, shared/personal selection, privacy, actual source attribution, live saves, existing continuation, mobile overflow/mascot sizing, bounds, removals, API failure/retry, partial resolution, missing cross-category evidence, empty results, cancellation, and rejection of late responses.

## Phase 2: What If? Explorer

Open `/?view=what-if`, or use **What If? Explorer** in the subordinate experience navigation. Phase 1 remains available unchanged.

Capture a current journey, an individual current result, a saved item, or new named interests. Capture makes an independent original request/result snapshot; live saved/result starts preserve the real entity seed. Saved doors do not retain historical scenario controls, so their initial planning/routing controls come from current preferences and the UI says so.

The free-form scenario stays in component memory. Whole-statement, explicit deterministic rules preview recognized changes, require **Apply recognized changes**, and permit manual overrides. Negated, ambiguous, and unsupported prose is not interpreted. Child/less-touristy statements produce only qualified local planning guidance.

City (only where the server supports location), intent, and depth may change Qloo query routing. Budget, time, and movement are recorded public planning context, not verified price/duration/access filters or affinity controls. Comparisons show the submitted controls and actual entity-ID differences without claiming causality, suitability, or improvement. Repeated runs keep the initial original snapshot; edits do not rewrite earlier result metadata.

**Restore original scenario** resets the independent what-if controls/result display. **Return to original discovery** explicitly restores the captured App journey, including after an alternative was explored; saved starts return to My Doors. Alternative generation itself does not alter the App's journey or preferences. Saves and exploration reuse the same App card/callback path as Phase 1.

Additional checks:

```sh
node --test src/experiences/whatIf.test.mjs
TEST_BASE_URL=http://127.0.0.1:5000 npx playwright test -c src/experiences/whatIf.playwright.config.ts
```

These browser fixtures verify integration/privacy/behavior, not a live external Qloo response or the actual real-world effects of changing constraints.

## Phase 3: Discovery Debate

Open `/?view=debate`, or select **Discovery Debate** in the existing subordinate experience navigation. Both earlier phases remain intact.

Start with a current recommendation, a saved item, or a new Qloo retrieval from typed cultural interests. Each session snapshots its original, current selection, public query context, transcript, accumulated supported feedback, and all seen returned entity IDs. Question text/transcript stay in React memory; they are never used as API search terms, raw feedback, saved-door content, or persistent profiles.

Exact, explicit wording can select an action; ambiguous prose requires an editable action choice. Replies are deterministic, contextual readings of the currently selected result—not an LLM or general language understanding. Follow-ups cite the selected title, entity ID, source IDs, matched resolved inputs, and actual available explainability excerpts. Missing or approximate resolution is explicit. Recorded input attribution is not pairwise proof, personal persuasion, or verified suitability. Prepared examples never gain Qloo provenance. Saved items without historical query metadata do not acquire invented historical attribution.

Disagreement sends supported `Not my scene` feedback. Unexpected requests send `Too familiar`, `Try something new`, and the existing unexpected depth. Alternatives use `Go deeper`. Each continuation reuses the current real selected entity when possible, retains public location/practical context and accumulated feedback, and excludes every seen result. Original interests remain in transcript/session history; they are not claimed as direct query inputs after switching to a result-seeded continuation. Every returned candidate is remembered; repeated/missing-ID results are filtered even if an upstream response ignores exclusions. Crossing the 40-exclusion or 120-character seed limit fails explicitly instead of silently dropping history or truncating names.

The first unseen returned result becomes the next discussion target, and users can select another returned candidate. Earlier turns retain original target references and bounded, sensitive-key-filtered evidence snapshots. Source connection metadata is captured per new retrieval; switching today’s connection never relabels old evidence. Original App/saved results without recorded connection metadata say it is unavailable.

Retry reuses the exact approved public payload. Errors, cancellations, navigation, connection changes, and empty/repeated responses do not replace the selected evidence with invented results. Existing App callbacks handle selected-result saves/exploration; generated alternatives reuse the same `DoorCard` as the earlier phases.

Phase-specific and final local checks:

```sh
node --test src/experiences/debate.test.mjs
TEST_BASE_URL=http://127.0.0.1:5000 npx playwright test -c src/experiences/debate.playwright.config.ts
node --test src/experiences/*.test.mjs
TEST_BASE_URL=http://127.0.0.1:5000 npx playwright test -c src/experiences/all.playwright.config.ts
npm test
npm run build
```

The combined browser config includes cross-experience navigation/draft/original preservation and all three focused suites. Fixtures exercise the actual API client and App callbacks without contacting an external Qloo service. Existing old tests that expect hidden legacy connection/scenario disclosures to be open immediately are outside these changes and have not been rewritten.
