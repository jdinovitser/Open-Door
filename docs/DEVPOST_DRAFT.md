# Devpost draft — not submitted

Do not describe this as a completed entry. Add the real public URLs and real-Qloo test findings before submission. Do not paste placeholder URLs into Devpost.

## Title and tagline

**Open Door**  
Start with what you love. Find your way into a new place.

## Inspiration

Arriving somewhere new does not mean starting without taste. A favorite film, artist, book or food can be a useful starting point—but it is not always obvious what to explore next. We wanted a discovery experience that makes the connecting thread visible and gives people a manageable choice rather than another long list.

## What it does

Open Door presents familiar, adjacent and unexpected cultural directions. People choose interests, intent and exploration depth; open a door for its explanation; save or reject a direction; and continue from a returned entity. The interface separates retrieved evidence from its own route labels and explicitly identifies authored Demo content.

The current build includes a prepared demonstration, a Live Qloo request flow, returned-evidence inspection, feedback-driven routing, second-step exploration, local saved doors, a shareable story, and a Trust page with storage/deletion controls.

## How we built it

React and TypeScript provide the interface. An Express server holds the Qloo credential and streams structured progress/result events. The custom orchestrator validates a bounded request, resolves anchors through Qloo Search, selects cross-category Insights requests, evaluates returned candidates, and produces provenance-bearing doors. Explicit feedback changes the next result-type route. Continuing from a returned entity feeds that entity ID into the next request.

The integration uses the official hackathon host, `/search` and `/v2/insights/`. No browser-side Qloo key, generative-model call, autonomous web browsing or arbitrary tool execution is used. Tests cover contracts and error behavior with fixtures; they do not substitute for a real service check.

## What makes it Qloo-powered

The Live path depends on Qloo entity resolution and cross-domain cultural retrieval. Open Door does not generate cultural matches from an LLM. The app supplies orchestration, labels and interaction; Qloo supplies returned cultural entities and recommendation evidence. The authored Demo remains clearly separate.

**Before submission:** replace this readiness note with an accurate account of the successful real-key test. Do not claim a successful integration before one has occurred.

## Challenges and limitations

Provenance is as important as presentation. We separated sample content, Qloo evidence and user choices; bounded upstream responses; and avoided treating route labels as affinity scores. The project does not verify opening hours, prices, travel time, accessibility of venues or current availability. Build My Day is a sequence of possibilities, not a verified itinerary. There are no accounts, cross-device sync or persistent server-side user profiles.

## What is next

Validate the real Qloo flow on the public app, complete interactive accessibility/browser regression checks, and test whether newcomers find the results useful. Any claimed user impact, performance gains or customer adoption must come from evidence, not this draft.

## Built with

Qloo API, React, TypeScript, Express, Vite, Lucide.

## Testing instructions to attach

1. Open the final public demo URL in a private window. No account or payment should be required.
2. Use the prepared Demo for a labeled, deterministic overview. Open a door and inspect its sample disclosure.
3. Switch to Live, enter a small set of resolvable interests, and run discovery. Confirm a real response and returned entity IDs in Under the Door.
4. Reject a direction, explore again, and inspect the applied-feedback notice.
5. Continue from a returned entity and inspect the next request/result evidence.
6. Save/unsave a door, review a story before sharing, and use Trust to delete local data.

## Links and assets still to supply

- Public fully published demo URL.
- Public GitHub, GitLab or Bitbucket repository URL; MIT visible in About.
- Completed entrant/team information and eligibility confirmation.
- Optional screenshots: opening, three doors, live evidence/continuation, Trust. Never caption a Demo screenshot as Live.
- A video is **not required** by the official event page checked October 20, 2026. If one is made, it must match the current app.
