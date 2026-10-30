## Inspiration

We all know the question: “What should we do?” The harder part is finding an answer that fits the people, the occasion, and the things they actually love. Planning a solo afternoon, a day with a friend, a first week somewhere new, or an experience for guests should not start with an overwhelming list.

Open Door turns personal interests into a welcoming next step. Qloo supplies the cultural grounding; people keep the choice.

## What it does

One guide, two ways in: **Explore for yourself** or **Help others explore**.

Personal exploration has four complementary experiences: **Solo Discovery** opens familiar, adjacent, and unexpected cultural directions; **Taste Bridge** brings two to five people's interests into a shared discovery request; **What If? Explorer** compares alternatives when circumstances change without losing the original; and **Discovery Debate** lets people question a recommendation's recorded evidence and request another direction.

The three animated doors reveal readable recommendations with reasons, practical next steps, helpful tips, and a hidden-gem interaction. Users can type or use supported browser voice input, add individual considerations, build a day plan, follow Google Maps links, print, and download recommendations. **Discovery Lab** adds frozen checkpoints, independent exploration branches, and side-by-side comparisons.

Guests can keep local saves. Optional sign-in syncs chosen doors, opt-in preferences, and personal reward progress, with Brave, Explorer, and Door Collector tracks. Trust controls explain storage, provenance, export, and deletion. Full journey and Lab histories remain browser-local.

Help others explore supports group, destination, and occasion planning. Business-model pages and clearly labeled partnership mockups show how free user discovery could eventually be supported by business partnerships—not an existing paid advertising network.

Try the [public app](https://open-door.replit.app/), [Judge’s Guide](https://open-door.replit.app/judges), and [guide PDF](https://open-door.replit.app/Open-Door-Judges-Guide.pdf).

## How we built it

React, TypeScript, and Vite power the interface; Express runs the server-side Qloo integration. The shared **Demo** connection makes real Qloo requests. **Connect your own** uses a personal Qloo key held temporarily in server-process memory. Prepared examples remain a separate, explicitly authored path.

Our **custom structured orchestrator** validates inputs, resolves named interests through Qloo Search, carries resolved entity IDs into multiple Insights requests, evaluates returned candidates, removes duplicates, and attaches provenance. Explicit feedback changes subsequent result-type routing. Opening a returned entity preserves its exact Qloo ID for the next request; Lab branches continue independently from a shared checkpoint and compare recorded outcomes.

This is a bounded, stateful tool workflow, not an LLM or conventional agent framework. Scenario interpretation and debate replies use disclosed deterministic rules; Qloo supplies cultural retrieval, not invented conversational evidence. Successful live Search, Insights, continuation, and independent Lab requests have been verified in this workspace. Fixture tests separately cover contracts and failure handling.

Optional Clerk authentication and PostgreSQL storage provide account-owned saves, preferences, progress, and lifecycle controls. Inquiry submissions have a separate server-verified admin access boundary. The [MIT-licensed source](https://github.com/jdinovitser/Open-Door) includes setup and architecture documentation.

## Challenges we ran into

Making cultural discovery useful required more than retrieving a list. We needed to preserve entity continuity, make branching understandable, reduce interaction friction, and explain why a direction was offered without inventing what Qloo had proved.

We separated user inputs, returned Qloo evidence, Open Door routing, and authored examples. Failed live requests never silently become sample results. Group-conditioned retrieval is not proof that everyone will agree; route tiers are editorial labels, not measured affinity. Age, health, budget, movement, and time provide individual planning context—not verified venue suitability, medical advice, opening hours, prices, or availability.

## Accomplishments that we're proud of

We built a working cultural-discovery workflow whose live recommendations depend on Qloo, with feedback-driven routing, returned-entity continuation, and independent branch exploration—not just a static recommendation screen.

We expanded that core into four personal experiences, planning for others, and Discovery Lab while retaining recognizable mascot artwork and the three-door interaction. Maps links, planning, downloads, hidden gems, saved progress, and optional accounts help turn a recommendation into something a person can return to.

The public walkthrough and illustrated guide make the implementation inspectable, including its limits. Partnership mockups show a possible expansion without presenting hypothetical partners as real customers.

## What we learned

Cultural intelligence matters most when it connects what someone loves to an actionable next choice. Qloo gives that choice a retrieved cultural basis; explicit controls, feedback, and clear evidence make it understandable.

We also learned that trust is part of usability. People should be able to distinguish a live result from a prepared example, a cultural connection from a practical assumption, and an account save from browser-local history.

## What's next for Open Door

Test usefulness and repeat exploration with real users; continue accessibility and cross-browser testing; and add verified practical data where available. Venue hours, pricing, accessibility, travel time, and availability require separate sources.

Explore hospitality and destination-celebration partnerships, measure whether placements help users, and develop external partner API/MCP access only with appropriate authorization, attribution, and privacy controls. These are future opportunities, not claims of revenue or adoption.

**Your interests. Your circumstances. Your kind of day. Open Door—open up what’s possible.**
