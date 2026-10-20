# Discovery Lab

The Lab extends the original three-door experience; it does not replace its discovery, saved doors, group mode, inspector, sharing or trust controls.

## Workflow

1. Choose **Branch in Discovery Lab** on an original discovery. The selected discovery becomes the current anchor while original anchors, explicit context, feedback and source labels are preserved. Alternatively begin a new Demo exploration at `/lab`.
2. Save a named checkpoint. It is an immutable snapshot, not a pointer to an editable branch.
3. Choose a direction: Stay in Your World, Follow the Thread, Cross Into Another World, Find Your People, Take the Wild Door, or Make It Real. Each new branch copies the checkpoint and uses its own settings, results, history and feedback. Edited conditions apply to the new branch; the strategy supplies its starting adventure level.
4. Adjust adventure, time, mood, domain, occasion, location, budget, access conditions or volunteered group interests. Changes affect the next Explore action, not existing evidence.
5. Keep or reject a discovery, expand its details, open the next door using it as the anchor, or fork it into a child checkpoint. Earlier discoveries remain actionable.
6. Choose a shared checkpoint in Compare branches, select at least two siblings, and inspect their actual result histories, explanations, source labels, constraints and feedback. Favorite a branch, resume it, or fork/continue a selected discovery.
7. Rename checkpoints and branches, confirm branch deletion, or begin a fresh exploration. Saved siblings and checkpoints remain available in the map even when no current exploration exists.

## Persistence and privacy

All Lab state is stored under `opendoor.lab.v1` in browser local storage. There are no Lab accounts, server database or cross-device sync. The Lab's explicit saved work is separate from the original journey-personalization toggle. Export and Clear Lab data are available in the Lab. The Trust page's full export includes the Lab, and Clear all Open Door data removes it.

Unreadable saved data is not silently overwritten: export the raw data or confirm a clear. Storage failures display an in-memory-only warning. Export files can contain personal interests and volunteered location/context; handle them accordingly. Exports are backups for inspection; importing an export into another browser is not yet implemented.

To bound local data, a Lab allows 100 checkpoints, 100 branches and 80 exploration batches per branch. The loader rejects oversized or malformed data. Browser storage can fill sooner; export before leaving if a storage warning appears.

## Shared engine and provider boundary

- `src/lab/engine.ts`: immutable checkpoint/branch operations, restoration, continuation, forking, comparison and validated persistence. Provider logic is outside this engine.
- `src/lab/model.ts`: internal models and the `DiscoveryProvider` contract.
- `src/lab/demoProvider.ts`: one shared authored-exercise catalog across eight domains, with strategy selection and repetition avoidance. The original app's demo generator is injected as its neighboring-domain seed source; there are not six independent engines.
- `src/lab/liveProvider.ts`: an adapter to the existing `runAgentDiscovery` client and server normalization. No new provider endpoints, authentication schemes or secrets were added.
- `src/lab/journeyAdapter.ts`: handoff from original journeys, preserving selected entities only for genuine Live records.

## What the source labels mean

**User input:** original and current anchors, user-selected settings and volunteered constraints.

**Demo provider:** deterministic editorial exercises. Creative analogies are explicitly illustrative, not factual cultural relationships or Qloo graph evidence. Strategies change target domains/formats, and selecting a result changes the next anchor. Previously shown exercise IDs are excluded where possible. When the finite catalog is exhausted, the UI says so instead of inventing more results.

**Application selection:** branch strategy, domain selection, adventure level, route labels and self-guided planning prompts. The Lab displays no invented numerical affinity, novelty or confidence scores.

**Qloo provider:** only a successful existing server request can supply Live results. Failed or unavailable Live requests never substitute Demo content. Saved Live records are labeled historical, not a current connection.

**Constraints:** supplied time/occasion are planning inputs. Location, cost, access, availability and other practical suitability remain unverified. Make It Real provides adjustable self-guided steps, not bookings, directions, opening hours or guaranteed compatibility.

## Real Qloo integration still pending

Credentials are not configured in this workspace. The adapter reuses the current server's documented Search/Insights path, intent/depth routing, selected-entity continuation, feedback and exclusions. Requested mood and context are not guarantees of a provider filter. Domain filtering uses normalized returned categories; Design cannot distinguish Fashion from Architecture. Live strategy outcomes and provider evidence require validation with real successful responses once credentials are securely configured.

## Verification

`npm test` exercises the original server/Qloo/security tests plus checkpoint snapshots, sibling isolation, restoration, continuation, child checkpoints, comparison eligibility, six distinct Demo strategies, controls, repetition/exhaustion, serialization, missing-data rejection, failed-provider behavior, selected-entity requests and original-journey import.

`npm run test:browser` covers the original-door handoff, branch creation and continuation, sibling preservation, comparison, favorites, forking, reload, rename/delete confirmations, checkpoint access after deletion/fresh journeys, settings, all six directions, mobile overflow, corrupt-data recovery, storage failure, empty batches, and the pending-credentials Live gate. Synthetic Live fixtures and provider stubs are tests, not evidence that Qloo is connected.
