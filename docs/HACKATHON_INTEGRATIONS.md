# Open Door — hackathon integrations and provenance

Implementation status updated **October 30, 2026**. See the [README](../README.md) for current capabilities and setup. Competition details below were reviewed on October 20, 2026; this update does not constitute a fresh rules review.

## Competition requirements checked

Checked the current Qloo Agentic Hackathon rules and Qloo's official API documentation on October 20, 2026. See [the four official criteria and evidence](JUDGING_CRITERIA.md) and [current submission gates](SUBMISSION_READINESS.md). Videos are not required; a fully published demo and public open-source repository are required.

- The competition accepts a project that integrates Qloo into an agentic tool, uses an agent framework, or adds Qloo to an existing agent. It does not name a mandatory LLM provider.
- The submission requires a working demo and a public code repository with an open-source license. The app is at https://open-door.replit.app/ and the MIT-licensed repository is at https://github.com/jdinovitser/Open-Door. Recheck anonymous access and the final published revision before submission.
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

The shared **Demo** connection uses server-side `QLOO_API_KEY`. **Connect your own** accepts a user's Qloo key over the app's same-origin connection endpoint and holds it only in server-process memory for up to one hour. An HttpOnly, SameSite=Strict cookie holds a random identifier, not the key; HTTPS also enables Secure. Keys are not returned in status/trace data or written to browser/account storage or logs. Disconnect, expiry, or restart removes the personal connection; it never silently falls back to the shared key. Both connection modes use the fixed hackathon host.

### What has and has not been verified

**Live Qloo discovery has been verified in this workspace**, including successful Search anchor resolution, multiple Insights requests, continuation from a returned entity, and independent live Discovery Lab branches. Recorded requests returned HTTP 200 with live-result provenance. The [demo capture notes](DEMO_SCRIPT_UPDATED.md) describe the recorded flow.

Mocked contract tests are separate evidence for controlled behavior and error handling, not proof of live service availability. A configured key alone does not make a journey live; each live journey requires a successful Qloo-backed response. Previously verified requests do not establish that every later published build or future request will succeed. Recheck the final public build before submission.

If Qloo returns no entity match, no Insights candidates, or an API error, the live request fails visibly or returns only the real partial results. It never substitutes the authored demo results into a live journey.

## Agent orchestration and other contest technologies

Open Door uses explicit, inspectable **custom structured tool orchestration**, not an LLM or conventional agent framework:

1. Read the user's stated intent, depth, location, and constraints.
2. Resolve each typed anchor with Qloo Search, or reuse the exact Qloo entity ID when the user opens a previously returned door.
3. Pass the resolved Qloo entity IDs to multiple Qloo Insights requests with explainability enabled.
4. Evaluate returned entities in Qloo response order, remove duplicates, and exclude previously opened entity IDs.
5. Use the user's explicit feedback to adjust subsequent Qloo result-type queries; for example, “Too expensive” or “Wrong time” steers follow-up routes away from place and destination entity types, without claiming prices or schedules.
6. Label the result route as familiar, adjacent, or unexpected; include Qloo provenance, the request type, and returned explainability where present.
7. Build a journey and a graph from the actual user inputs, Search matches or user-selected prior entities, Insights results, and returned coordinates.
8. In Discovery Lab, freeze a checkpoint, continue independent branches through the selected Qloo connection, and compare their recorded requests and results. Restoring a recorded branch is not a new retrieval.

These are Open Door's real orchestration steps, not claims about hidden reasoning. It does not use an external LLM, model SDK, web search provider, or map-data API in this integration. Google Maps links are outbound links, not verified map-provider retrieval. No external-facing MCP server is implemented; partner API/MCP access is a roadmap idea. The organizer decides whether this bounded tool workflow meets the agentic-tool requirement.

## Provenance and limits

- **USER** — anchors, categories, location, intent, depth, and context entered by the user.
- **QLOO** — entity matches and recommendation entities returned by Search or Insights. The inspector identifies the endpoint and `filter.type` used.
- **OPEN DOOR ORCHESTRATION** — request routing, duplicate removal, and presentation logic.
- **EXTERNAL** — no external data provider is currently used.
- **AI SYNTHESIS** — none; no generative model is called.

`popularity` remains a popularity field; it is not relabeled as affinity or confidence. Qloo's explainability response is retained in bounded form with credential-like fields removed when present, without inventing a score when absent.

“Discovery Distance” is an Open Door ordinal route label. Familiar means the requested result type matches the first resolved input type; adjacent and unexpected are different result types selected by Open Door's explicit route table and the user's depth choice. It is not a Qloo distance score, a measured cultural distance, or a psychological score.

Qloo entity metadata does not verify live opening hours, event schedules, cost, availability, accessibility, or travel time. The app must not present those as confirmed facts. A map can use coordinates only when they are present in an actual Qloo response; it must not fabricate a point from a city name.

Build My Day passes the selected location to supported place/destination Insights queries and maps novelty to Open Door's explicit depth choice. Start/end times and budget are retained as user context, not undocumented Qloo parameters; none of these inputs verify a result's hours, price, or availability. Prepared examples reshape authored samples only. Taste Bridge can use the selected live Qloo connection for combined interests; this is not evidence of pairwise affinity or universal group preference. What If? interpretation and Discovery Debate replies use disclosed deterministic rules, separate from live cultural retrieval.

## Shared Demo versus prepared examples

The shared **Demo** connection uses real Qloo requests, without requiring a user-supplied key. **Connect your own** uses the personal connection for the browsing session. Discovery Lab and the personal experiences reuse the selected connection.

**Try prepared examples** and `/demo` use deterministic authored sample paths. They are not Qloo results, external facts, or real venue listings. Prepared examples are an explicit choice, never a silent fallback from a failed live request.

The `/api/status` endpoint reports Qloo configuration and the public tool/limit policy; it does not expose the key. The live route is `POST /api/agent/discover`. A missing, invalid, expired, or unavailable selected connection fails explicitly rather than silently switching to sample data or another credential. `/demo` always starts an authored sample without calling Qloo.

## Run and test

```sh
npm run dev
npm test
npm run build
```

For a deployed server, run `npm run build` and `npm start` with `NODE_ENV=production`. Add `QLOO_API_KEY` through Replit Secrets only after receiving a Qloo hackathon key.
