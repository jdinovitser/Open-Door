# Open Door — hackathon integrations and provenance

## Competition requirements checked

Checked the current Qloo Agentic Hackathon rules and Qloo's official API documentation on October 20, 2026. See [the four official criteria and evidence](JUDGING_CRITERIA.md) and [current submission gates](SUBMISSION_READINESS.md). Videos are not required; a fully published demo and public open-source repository are required.

- The competition accepts a project that integrates Qloo into an agentic tool, uses an agent framework, or adds Qloo to an existing agent. It does not name a mandatory LLM provider.
- The submission requires a working demo and a public code repository with an open-source license. This project now includes the MIT License; the workspace still has no configured public Git remote.
- The published deadline is October 30, 2026 at 11:45 p.m. Eastern.
- Qloo's hackathon API keys are requested through the official [access form](https://forms.gle/zz12orkLHTAneLGz6). The docs say manual provisioning can take a few business days.

Sources:

- [Qloo Agentic Hackathon rules](https://qloo.devpost.com/rules)
- [Qloo hackathon developer guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide)
- [Qloo API overview](https://docs.qloo.com/reference/api-overview)
- [Qloo Search Entities](https://docs.qloo.com/reference/get-search)
- [Qloo Insights API deep dive](https://docs.qloo.com/reference/insights-api-deep-dive)
- [Insights with location](https://docs.qloo.com/reference/insights-with-location-use-case)

## Qloo integration implemented

The server-side live path uses direct HTTP requests; no Qloo SDK or unofficial endpoint is used.

| Purpose | Official request | Details |
| --- | --- | --- |
| Resolve a user-entered anchor | `GET https://hackathon.api.qloo.com/search` | Uses `query`, a documented `types` value, `take`, and `sort_by=match`. |
| Explore a cultural result type | `GET https://hackathon.api.qloo.com/v2/insights/` | Uses required `filter.type`, one `signal.interests.entities` value for each resolved Qloo entity, and `feature.explainability=true`. |
| Apply a location | `GET /v2/insights/` | Adds `signal.location.query` only for `place` and `destination` result types. It is not sent as a general-purpose location filter for every entity type. |

The only credential expected by the server is `QLOO_API_KEY`, stored as a Replit Secret. It is never sent to the browser, returned by `/api/status`, or included in trace data. The integration uses the hackathon host because Qloo's guide says hackathon keys are scoped to `hackathon.api.qloo.com`.

### What has and has not been verified

The live integration code and mocked contract tests are present. **This workspace did not have a Qloo key when this document was written, so no live Qloo request has yet been made or verified.** The app must remain in Demo Mode until a key is provisioned and a live response succeeds. A configured key alone does not make a journey “Live”; the UI should label a journey Live only after the server returns a Qloo-backed result.

If Qloo returns no entity match, no Insights candidates, or an API error, the live request fails visibly or returns only the real partial results. It never substitutes the authored demo results into a live journey.

## Agent orchestration and other contest technologies

Open Door uses explicit, inspectable tool orchestration rather than a third-party LLM:

1. Read the user's stated intent, depth, location, and constraints.
2. Resolve each typed anchor with Qloo Search, or reuse the exact Qloo entity ID when the user opens a previously returned door.
3. Pass the resolved Qloo entity IDs to multiple Qloo Insights requests with explainability enabled.
4. Evaluate returned entities in Qloo response order, remove duplicates, and exclude previously opened entity IDs.
5. Use the user's explicit feedback to adjust subsequent Qloo result-type queries; for example, “Too expensive” or “Wrong time” steers follow-up routes away from place and destination entity types, without claiming prices or schedules.
6. Label the result route as familiar, adjacent, or unexpected; include Qloo provenance, the request type, and returned explainability where present.
7. Build a journey and a graph from the actual user inputs, Search matches or user-selected prior entities, Insights results, and returned coordinates.

These are Open Door's real orchestration steps, not claims about hidden reasoning. The app does not use an external LLM, model SDK, web search provider, map provider, or additional contest partner technology in this integration. The current competition rules do not require a particular model provider.

## Provenance and limits

- **USER** — anchors, categories, location, intent, depth, and context entered by the user.
- **QLOO** — entity matches and recommendation entities returned by Search or Insights. The inspector identifies the endpoint and `filter.type` used.
- **OPEN DOOR ORCHESTRATION** — request routing, duplicate removal, and presentation logic.
- **EXTERNAL** — no external data provider is currently used.
- **AI SYNTHESIS** — none; no generative model is called.

`popularity` remains a popularity field; it is not relabeled as affinity or confidence. Qloo's explainability response is retained in bounded form with credential-like fields removed when present, without inventing a score when absent.

“Discovery Distance” is an Open Door ordinal route label. Familiar means the requested result type matches the first resolved input type; adjacent and unexpected are different result types selected by Open Door's explicit route table and the user's depth choice. It is not a Qloo distance score, a measured cultural distance, or a psychological score.

Qloo entity metadata does not verify live opening hours, event schedules, cost, availability, accessibility, or travel time. The app must not present those as confirmed facts. A map can use coordinates only when they are present in an actual Qloo response; it must not fabricate a point from a city name.

Build My Day passes the selected location to supported place/destination Insights queries and maps novelty to Open Door's explicit depth choice. Start/end times and budget are retained as user context, not undocumented Qloo parameters; none of these inputs verify a result's hours, price, or availability. Demo Mode reshapes authored samples only. The separate group scenario uses fictional participants and remains explicitly labeled as demo data.

## Demo fallback

Demo Mode uses the existing deterministic sample paths. They are authored examples, not Qloo results, not external facts, and not real venue listings. The dedicated `/demo` route is intended to open a prepared sample journey when live access is not configured.

The `/api/status` endpoint reports Qloo configuration and the public tool/limit policy; it does not expose the key. The live route is `POST /api/agent/discover`. When no key is configured, that route returns `QLOO_NOT_CONFIGURED` rather than silently switching to sample data. `/demo` always starts an authored sample without calling Qloo; Live requires an explicit selection and request.

## Run and test

```sh
npm run dev
npm test
npm run build
```

For a deployed server, run `npm run build` and `npm start` with `NODE_ENV=production`. Add `QLOO_API_KEY` through Replit Secrets only after receiving a Qloo hackathon key.
