import test from "node:test";
import assert from "node:assert/strict";
import { DEBATE_ACTIONS, createDebateRequest, debateCandidateFromJourney, debateContributions, debateReply, formattedDebateEvidence, interpretDebateQuestion, isRetrievalAction, newDebateSession, snapshotCandidate, unseenDebateDoors } from "./debate.ts";

const candidate = () => ({
  id: "original", label: "Current: Original artist", mode: "live",
  door: { id: "qloo-original", entityId: "original", entityType: "artist", title: "Original artist", kind: "Artist", category: "Music",
    tier: "Adjacent", source: "Nina Simone", sourceEntityIds: ["seed-0"], why: "Recorded reason", now: "Try a preview",
    evidence: "Recorded query-conditioned result.", thread: "A returned direction", explainability: { relationship: "query-conditioned", source_ids: ["seed-0"], secret: "do-not-render" } },
  request: { location: "Brooklyn", occasion: "Saturday", intent: "Try something new", depth: "A little further", anchors: [{ label: "Nina Simone", category: "Music" }],
    context: { time: "Saturday", budget: "Flexible", movement: "Mostly seated", conditions: "Open to anything" }, feedback: [], iteration: 0 },
  resolvedAnchors: [{ label: "Nina Simone", category: "Music", entityId: "seed-0", entityType: "artist", entityName: "Nina Simone", exactNameMatch: true }],
});
test("all suggested challenge wording has an explicit deterministic interpretation", () => {
  for (const action of DEBATE_ACTIONS) assert.equal(interpretDebateQuestion(action.question), action.id);
  assert.equal(interpretDebateQuestion("What evidence supports that?"), "evidence");
  assert.equal(interpretDebateQuestion("Why?"), "why");
});
test("ambiguous, negated and personal prose is not guessed into a challenge action", () => {
  for (const question of ["I do not want something more unexpected", "I am worried about a private health condition", "Alternative but not that one", "What about my family?", ""]) {
    assert.equal(interpretDebateQuestion(question), null);
  }
});
test("all local replies are selected-entity-specific and distinguish attribution from pairwise preference proof", () => {
  const session = newDebateSession(candidate());
  for (const action of DEBATE_ACTIONS.filter(action => !isRetrievalAction(action.id))) {
    const reply = debateReply(session, action.id);
    assert.match(reply.text, /Original artist/);
    assert.match(reply.text, /entity original/);
    assert.match(reply.text, /seed-0/);
    assert.match(reply.text, /not pairwise proof/);
  }
});
test("persuasion, weak connections and perspective acknowledge limits rather than inventing biographies or similarity", () => {
  const session = newDebateSession(candidate());
  assert.match(debateReply(session, "persuade").text, /cannot honestly convince/);
  assert.match(debateReply(session, "weak").text, /weaker than an explained pairwise/);
  assert.match(debateReply(session, "perspective").text, /not additional Qloo evidence/);
});
test("only actual resolved source IDs receive attribution, including approximate-match warnings", () => {
  const source = candidate();
  source.resolvedAnchors.push({ label: "Unrelated", entityId: "other", entityName: "Other", category: "Film" });
  source.resolvedAnchors[0].exactNameMatch = false;
  assert.equal(debateContributions(source).length, 1);
  assert.match(debateReply(newDebateSession(source), "connection").text, /approximate Search match/);
  source.door.sourceEntityIds = ["unknown"];
  assert.deepEqual(debateContributions(source), []);
  assert.match(debateReply(newDebateSession(source), "evidence").text, /No resolved input can be attributed/);
});
test("saved/missing metadata does not become invented historical resolution or explainability", () => {
  const source = candidate();
  source.resolvedAnchors = [];
  source.requestIsHistorical = false;
  source.door.explainability = null;
  assert.match(debateReply(newDebateSession(source), "connection").text, /historical saved query is unavailable/);
  assert.match(debateReply(newDebateSession(source), "evidence").text, /No structured Qloo explainability/);
  assert.equal(formattedDebateEvidence(source), undefined);
});
test("prepared examples never acquire live evidence or reused Qloo seeds", () => {
  const source = candidate(); source.mode = "demo";
  const session = newDebateSession(source);
  assert.match(debateReply(session, "evidence").text, /prepared example, not a Qloo/);
  assert.equal(formattedDebateEvidence(source), undefined);
  assert.equal("resolvedEntities" in createDebateRequest(session, "alternative"), false);
});
test("evidence excerpts retain recorded fields while removing sensitive-key fields", () => {
  const source = candidate();
  source.door.explainability.nested = { authorization: "do-not-render", relation: "recorded" };
  const excerpt = formattedDebateEvidence(source);
  assert.match(excerpt, /query-conditioned/);
  assert.match(excerpt, /recorded/);
  assert.doesNotMatch(excerpt, /do-not-render|authorization|"secret"/);
});
test("snapshots preserve original evidence when source, selected candidate or later turns change", () => {
  const source = candidate();
  const session = newDebateSession(source);
  source.door.title = "Later original edit";
  session.current.door.title = "Later selected edit";
  assert.equal(session.original.door.title, "Original artist");
  const snapshot = snapshotCandidate(session.original);
  snapshot.request.location = "Paris";
  assert.equal(session.original.request.location, "Brooklyn");
});
test("live alternative uses the exact selected entity, context, accumulated feedback and exclusions—not private transcript", () => {
  const session = newDebateSession(candidate());
  session.turns.push({ role: "user", text: "Private family note" });
  session.feedback = ["Too far"];
  session.seenEntityIds.push("seen-a", "seen-b");
  const request = createDebateRequest(session, "disagree");
  assert.deepEqual(request.resolvedEntities, [{ label: "Original artist", category: "Music", entityId: "original", entityType: "artist" }]);
  assert.deepEqual(request.anchors, [{ label: "Original artist", category: "Music" }]);
  assert.deepEqual(request.context, session.current.request.context);
  assert.deepEqual(request.excludedEntityIds, ["original", "seen-a", "seen-b"]);
  assert.deepEqual(request.feedback, ["Too far", "Not my scene"]);
  assert.equal(request.intent, "Go deeper");
  assert.doesNotMatch(JSON.stringify(request), /Private|transcript|turns/);
});
test("unexpected action explicitly changes routing and retains prior feedback", () => {
  const session = newDebateSession(candidate()); session.feedback = ["Not my scene"];
  const request = createDebateRequest(session, "unexpected");
  assert.equal(request.depth, "Take me somewhere unexpected");
  assert.equal(request.intent, "Try something new");
  assert.deepEqual(request.feedback, ["Not my scene", "Too familiar"]);
  assert.equal(request.location, "Brooklyn");
});
test("followups and continued requests track newly selected result without rewriting original roots", () => {
  const session = newDebateSession(candidate());
  const request = createDebateRequest(session, "alternative");
  const door = { ...session.current.door, id: "qloo-new", entityId: "new", title: "New artist", sourceEntityIds: ["original"] };
  const returned = { resolvedAnchors: [{ label: "Original artist", entityName: "Original artist", entityId: "original" }] };
  session.current = debateCandidateFromJourney(returned, door, request, "personal");
  session.turns.push({ role: "user", text: "Previous challenge" });
  assert.match(debateReply(session, "why").text, /follow-up.*New artist/);
  assert.equal(createDebateRequest(session, "alternative").resolvedEntities[0].entityId, "new");
  assert.equal(session.original.request.anchors[0].label, "Nina Simone");
  assert.equal(session.current.connection, "personal");
});
test("seen, duplicated and missing-ID responses never masquerade as new alternatives", () => {
  const journey = { doors: [{ entityId: "seen" }, { entityId: "new" }, { entityId: "new" }, {}] };
  assert.deepEqual(unseenDebateDoors(journey, ["seen"]).map(door => door.entityId), ["new"]);
  assert.deepEqual(unseenDebateDoors({ doors: [{ entityId: "seen" }] }, ["seen"]), []);
});
test("server seed/exclusion limits fail clearly without silently truncating conversation memory", () => {
  const session = newDebateSession(candidate());
  session.seenEntityIds = Array.from({ length: 40 }, (_, index) => `seen-${index}`);
  assert.throws(() => createDebateRequest(session, "alternative"), /40-entity exclusion limit/);
  assert.equal(session.seenEntityIds.length, 40);
  session.seenEntityIds = [];
  session.current.door.title = "x".repeat(121);
  assert.throws(() => createDebateRequest(session, "alternative"), /no title will be silently shortened/);
  assert.throws(() => createDebateRequest(session, "evidence"), /Choose an alternative/);
});
