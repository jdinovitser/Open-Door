# AI and recommendation evaluation

Open Door does not call a generative AI model. Live discovery uses deterministic server-side orchestration of Qloo Search and Insights endpoints plus Open Door’s fixed routing rules. Demo journeys are authored deterministic examples and are not Qloo results.

There are no model-quality scores, fairness measurements, human-review statistics, or recommendation-success metrics to report. The app does not infer a user’s identity or psychological profile. “Familiar,” “Adjacent,” and “Unexpected” are Open Door route labels; Discovery Distance is an ordinal label, not a Qloo score or measured trait. Qloo popularity is displayed as popularity, not affinity.

Qloo response text and explainability are untrusted data. The app bounds returned explainability data, removes sensitive-looking key names, and renders values as text. No response can trigger a tool call or change application policy. If a language model is added later, that would require a separate threat and evaluation review.

Current defensive tests cover invalid input, request-size limits, response bounds, request metadata, rate-limiter behavior, and safe error handling. They are not a penetration test or a quality evaluation.
