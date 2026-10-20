# Judging criteria and evidence

Checked **October 20, 2026** against the [official rules](https://qloo.devpost.com/rules) and [event requirements](https://qloo.devpost.com/). Recheck before submitting; the organizer controls eligibility and scoring.

## Official rubric

Stage One is **pass/fail**: baseline viability, theme fit, and reasonable application of the required APIs/SDKs. Open Door is **not yet verified to pass**: integration code exists, but this workspace has no configured Qloo key or successful live-Qloo evidence, and no published demo.

Stage Two has exactly four **equally weighted** criteria. The rules do not publish a 0–10 scale. The scores below are a candid internal assessment, not official scores, judge predictions, or evidence of acceptance.

| Official criterion | What judges seek | What Open Door demonstrates | Evidence | Weakness / required action | Internal score / risk |
|---|---|---|---|---|---|
| Technological Implementation | Thorough, skillful Qloo use; genuinely working, non-trivial code | Server-side Search → entity resolution → cross-category Insights → evaluation → returned evidence; feedback changes result-type routing; continuation accepts a returned entity | `server/qloo.js`, `server/agent.js`, their contract tests; Live evidence inspector and graph | **Blocking:** configure a real hackathon key and prove end-to-end success, feedback, continuation, empty results and upstream failures on the public deployment. Mock tests are not live proof. | **4/10 — High** |
| Design | A complete, coherent product rather than just a proof of concept | Door-based entry/reveal, three differentiated directions, editable inputs, save/feedback/reset/share, Demo recovery, Trust page, reduced-motion support | `/`, `/demo`, `/trust`, `src/App.tsx`, `src/index.css`; desktop and 402px mobile screenshots | Cards now precede supporting diagrams. Still needs interactive keyboard/screen-reader, touch, zoom, Safari and Firefox verification. A long results page remains. | **7/10 — Medium** |
| Potential Impact | A specific audience/problem and demonstrated fit | Helps a culturally curious newcomer move from a named interest toward a less obvious next discovery, with explicit choice and continuation | Product flow; `WHY_OPEN_DOOR.md`; authored demonstration and live implementation | No target-user study, retention, outcome measurements, verified travel time, opening hours or affordability. Do not claim reduced loneliness or proven relocation outcomes. Test utility with newcomers before making impact claims. | **6/10 — High** |
| Quality of the Idea | Creative, non-obvious Qloo use and understanding of the problem | Cross-domain exploration from interests rather than a generic venue list; bounded familiar/adjacent/unexpected choices and a connecting thread | Three-door flow, returned-evidence graph, continuation, `WHY_OPEN_DOOR.md` | The key differentiator must be shown with real Qloo responses. Route tiers are Open Door editorial labels, not Qloo affinity/distance scores. No validated competitor study. | **7/10 — Medium** |

**Internal total: 24/40.** Do not hide the low technology readiness behind visual polish. None is rated 9: live integration proof and public submission gates are unresolved; impact and accessibility evidence remain limited.

## Most valuable fixes, in order

1. Prove real Qloo behavior with the correct [hackathon host and documented endpoints](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide). Keep Demo and Live provenance separate.
2. Publish an unrestricted demo and public GitHub/GitLab/Bitbucket repository with MIT license visible in About. Test both anonymously.
3. Complete the Devpost description with the real URLs, an accurate Qloo/agent explanation, and honest limitations.
4. Run interactive browser/accessibility checks. Use feedback and continuation in the judge walkthrough, not only the initial cards.
5. Validate usefulness with the target audience; report findings rather than invented impact numbers.

## Agentic claim boundary

Open Door uses **custom structured tool orchestration**, not an LLM or agent-framework integration. It validates inputs, resolves entities, selects a category route from explicit controls, calls multiple Qloo tools, evaluates candidates, and supports feedback/continuation. It does not autonomously browse, execute arbitrary tools, or reveal model reasoning. The official rules allow an agentic tool and do not mandate an LLM provider, but the organizer—not this document—decides whether the implementation meets that requirement.

## Evidence boundaries

- Automated API tests use controlled Qloo fixtures, not the real Qloo service.
- A configured-key status is not a successful Qloo response.
- The prepared `/demo` is deterministic authored content; it is never Qloo evidence.
- The graph displays only returned entities/evidence and separately labeled user continuation edges. Its route labels are not a scientific measure of cultural distance.
- No external recommendation search provider or generative model is currently called. Fonts and remote images are separate presentation requests, disclosed under Trust.
