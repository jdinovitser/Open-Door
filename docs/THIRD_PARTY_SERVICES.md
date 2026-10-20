# Third-party services and data flows

Open Door does not use advertising pixels, analytics SDKs, or payment processors.

| Service | When used | Data sent or exposed | Current boundary |
| --- | --- | --- | --- |
| Qloo Hackathon API | Only when a user explicitly starts Live discovery and the server has `QLOO_API_KEY` configured | Search receives entered interest text and a requested entity type. Insights receives resolved Qloo entity IDs; location is included only for supported place/destination queries. Budget, time, movement, and energy preferences are not sent. | Server-to-server HTTPS at the fixed hackathon API host. The key is not sent to the browser. |
| Image hosts referenced by Qloo results | When a Live result contains an HTTPS image URL and the browser renders it | The browser requests the image from that URL, exposing ordinary network/browser request metadata to the image host. The app sends no referrer URL. | URL is restricted to HTTPS, but image hosting domains may vary. |
| Google Fonts | On page load, due to the stylesheet import in the UI | Font requests can expose ordinary network/browser request metadata to Google. No referrer URL is sent. | Cosmetic only; the browser falls back to system fonts if unavailable. |

Demo mode uses deterministic authored examples and does not call Qloo. The app does not use server cookies or accounts. Saved doors, journey state, feedback, and opened-door counts are stored in this browser’s localStorage; they are not sent to Open Door’s server except fields included in a user-started Live discovery request.
