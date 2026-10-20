# Third-party services and data flows

Open Door does not use advertising pixels, analytics SDKs, or payment processors.

| Service | When used | Data sent or exposed | Current boundary |
| --- | --- | --- | --- |
| Replit-managed Clerk | Optional account sign-in and session management | Account identity fields entered into the sign-in UI and authentication/session metadata. Clerk telemetry is disabled in the provider. | Clerk validates sessions; Open Door account APIs derive ownership from the authenticated user ID. Secret credentials remain server-side. |
| Replit PostgreSQL | Signed-in saved doors and personal reward progress | Saved-door details selected by the user, including city and source interests; progress stores only door ID, tier, and category, scoped to the account ID. | Server-only database access and parameterized, owner-scoped queries. Full journey and Lab history are not synced. |
| Qloo Hackathon API | Only when a user explicitly starts Live discovery and the server has `QLOO_API_KEY` configured | Search receives entered interest text and a requested entity type. Insights receives resolved Qloo entity IDs; location is included only for supported place/destination queries. Budget, time, movement, and energy preferences are not sent. | Server-to-server HTTPS at the fixed hackathon API host. The key is not sent to the browser. |
| Image hosts referenced by Qloo results | When a Live result contains an HTTPS image URL and the browser renders it | The browser requests the image from that URL, exposing ordinary network/browser request metadata to the image host. The app sends no referrer URL. | URL is restricted to HTTPS, but image hosting domains may vary. |
| Google Fonts | On page load, due to the stylesheet import in the UI | Font requests can expose ordinary network/browser request metadata to Google. No referrer URL is sent. | Cosmetic only; the browser falls back to system fonts if unavailable. |

Demo mode uses deterministic authored examples and does not call Qloo. Guest saves, full journey state, feedback, opened-door browser history, and Discovery Lab branches are browser-local. Optional sign-in uses Clerk session cookies and sends explicitly saved doors and minimal reward events to account storage. Shared reward summaries contain earned badge/star details and the home-page URL, not saved interests or location.
