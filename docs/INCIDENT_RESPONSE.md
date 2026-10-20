# Incident response guide

This guide is for a repository maintainer. It is not evidence of a staffed or rehearsed incident-response program.

## 1. Triage

Record when the report arrived, the affected deployment and route, observed impact, and the reporter’s safe reproduction. Do not copy credentials, personal journey content, or raw request bodies into tickets or logs. Assign a maintainer to decide whether the issue concerns credential exposure, unauthorized access, service abuse, data loss, or availability.

## 2. Contain

- If the Qloo credential may be exposed, disable or rotate it in the secret manager and verify the replacement without placing it in code or chat.
- If a route is being abused, disable the affected feature or deployment while preserving only the non-sensitive operational evidence needed to investigate.
- If a dependency is implicated, pin or update to a reviewed fixed release and verify the build and affected behavior before restoring service.
- Do not claim that disabling the Qloo key removes browser-local data; those are separate stores.

## 3. Investigate and preserve

Use request IDs and available host logs to correlate requests. Current application audit events are volatile and may already have been lost on restart. They do not contain request bodies, user interests, location, or upstream response content. Preserve relevant platform logs according to the hosting operator’s actual retention rules; do not infer a complete user timeline from this prototype.

## 4. Recover

Deploy a reviewed correction, rotate credentials where appropriate, and verify health, safe input rejection, and the affected user journey. Record the correction and remaining risk in the repository. Avoid reusing sensitive production data in tests.

## 5. Notifications and follow-up

The maintainer must assess applicable contractual and legal notification duties with qualified counsel. This project defines no notification deadline, regulator process, or service-level commitment. Review root cause, update tests and documentation, and make any public statement specific to verified facts.
