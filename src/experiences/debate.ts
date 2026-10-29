import type { DiscoveryRequest, LiveDoor, LiveJourney, QlooConnectionSource } from "../agentApi";
import { cloneRequest } from "./whatIf.ts";

export type DebateDoor = Pick<LiveDoor, "id" | "tier" | "title" | "kind" | "category" | "source" | "why" | "now" | "evidence" | "thread">
  & Partial<Omit<LiveDoor, "id" | "tier" | "title" | "kind" | "category" | "source" | "why" | "now" | "evidence" | "thread">>;
export type DebateCandidate = {
  id: string; label: string; mode: "demo" | "live"; door: DebateDoor; request: DiscoveryRequest;
  resolvedAnchors: LiveJourney["resolvedAnchors"]; connection?: QlooConnectionSource;
  requestIsHistorical?: boolean;
  savedAnchors?: string[];
};
export const DEBATE_ACTIONS = [
  { id: "why", label: "Why this recommendation?", question: "Why did you recommend this?" },
  { id: "connection", label: "Connect it to my interests", question: "What connects this to my interests?" },
  { id: "evidence", label: "Show the evidence", question: "What evidence supports this recommendation?" },
  { id: "persuade", label: "Challenge the case for it", question: "I don't think I would like this. Convince me." },
  { id: "weak", label: "Question a weak connection", question: "That connection doesn't make sense." },
  { id: "perspective", label: "A different perspective", question: "Give me a different perspective." },
  { id: "disagree", label: "I disagree—find another", question: "I don't like this recommendation." },
  { id: "alternative", label: "Retrieve an alternative", question: "What else could you recommend instead?" },
  { id: "unexpected", label: "Retrieve something more unexpected", question: "Show me something more unexpected." },
] as const;
export type DebateAction = typeof DEBATE_ACTIONS[number]["id"];
export type DebateTurn = {
  id: string; role: "user" | "assistant"; text: string; targetTitle: string; targetEntityId?: string;
  action?: DebateAction; evidence?: string;
};
export type DebateSession = {
  original: DebateCandidate; current: DebateCandidate; turns: DebateTurn[];
  seenEntityIds: string[]; feedback: string[]; iteration: number;
};

export function interpretDebateQuestion(text: string): DebateAction | null {
  const value = text.trim().replace(/[?!.\s]+$/g, "").replace(/\s+/g, " ").toLowerCase();
  const rules: [DebateAction, string[]][] = [
    ["why", ["why", "why this", "why did you recommend this", "why did you recommend that"]],
    ["connection", ["what connects this to my interests", "what connects that to my interests", "how does this connect", "which interests contributed"]],
    ["evidence", ["what evidence supports this recommendation", "what evidence supports that", "show me the evidence", "show the source ids", "what about the evidence"]],
    ["persuade", ["i don't think i would like this. convince me", "convince me", "why would i like this"]],
    ["weak", ["that connection doesn't make sense", "this connection seems weak", "that seems weak"]],
    ["perspective", ["give me a different perspective", "another perspective"]],
    ["disagree", ["i don't like this recommendation", "i don't like this", "i disagree", "not my scene"]],
    ["alternative", ["what else could you recommend instead", "show me an alternative", "try an alternative", "something else"]],
    ["unexpected", ["show me something more unexpected", "something more unexpected", "surprise me"]],
  ];
  return rules.find(([, phrases]) => phrases.includes(value))?.[0] || null;
}
export const isRetrievalAction = (action: DebateAction) => ["disagree", "alternative", "unexpected"].includes(action);
export function snapshotCandidate(candidate: DebateCandidate): DebateCandidate {
  return JSON.parse(JSON.stringify(candidate)) as DebateCandidate;
}
export function newDebateSession(candidate: DebateCandidate): DebateSession {
  const snapshot = snapshotCandidate(candidate);
  return { original: snapshotCandidate(snapshot), current: snapshot, turns: [], seenEntityIds: [...new Set([
    ...(snapshot.mode === "live" && snapshot.door.entityId ? [snapshot.door.entityId] : []), ...(snapshot.request.excludedEntityIds || []),
  ])], feedback: [...(snapshot.request.feedback || [])], iteration: snapshot.request.iteration || 0 };
}
export function debateContributions(candidate: DebateCandidate) {
  if (candidate.mode !== "live") return [];
  const sourceIds = new Set(candidate.door.sourceEntityIds || []);
  return candidate.resolvedAnchors.filter(anchor => sourceIds.has(anchor.entityId));
}
export function sanitizedDebateEvidence(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[nested evidence omitted]";
  if (Array.isArray(value)) return value.slice(0, 40).map(item => sanitizedDebateEvidence(item, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(credential|secret|api.?key|(^|[_-])key($|[_-])|password|bearer|token|authorization|prompt|reasoning|thought)/i.test(key))
    .slice(0, 40).map(([key, item]) => [key, sanitizedDebateEvidence(item, depth + 1)]));
  return typeof value === "string" ? value.slice(0, 2000) : value;
}
export function formattedDebateEvidence(candidate: DebateCandidate): string | undefined {
  if (candidate.mode !== "live" || candidate.door.explainability == null) return undefined;
  return JSON.stringify(sanitizedDebateEvidence(candidate.door.explainability), null, 2).slice(0, 12000);
}
export function debateReply(session: DebateSession, action: DebateAction): { text: string; evidence?: string } {
  const candidate = session.current;
  const door = candidate.door;
  const reference = `“${door.title}” (entity ${door.entityId || "ID unavailable"})`;
  const previousQuestion = [...session.turns].reverse().find(turn => turn.role === "user");
  const previousAction = DEBATE_ACTIONS.find(item => item.id === previousQuestion?.action)?.label || "question";
  const continuity = previousQuestion
    ? `Following your previous “${previousAction}” turn about “${previousQuestion.targetTitle || door.title}”, this follow-up examines the currently selected ${reference}. Earlier turns retain their original targets. ` : `Let’s examine ${reference}. `;
  if (candidate.mode !== "live") return {
    text: `${continuity}This is a prepared example, not a Qloo recommendation. Its recorded explanation is editorial, not cultural evidence from Qloo. I cannot defend it as Qloo-backed. You can retrieve a live alternative, which will resolve the selected name through Qloo Search; an authored example may not resolve.`,
  };
  const contributions = debateContributions(candidate);
  const sourceIds = (door.sourceEntityIds || []).join(", ") || "not recorded";
  const grounding = contributions.length
    ? `Resolved contributing query inputs: ${contributions.map(anchor => `${anchor.label} → ${anchor.entityName} [${anchor.entityId}]${anchor.exactNameMatch ? "" : " (approximate Search match; review it)"}`).join("; ")}.`
    : `No resolved input can be attributed from this snapshot. Recorded source label: ${door.source || "unavailable"}; it is not verified participant or interest attribution.`;
  const base = `Qloo returned this entity for a cultural query. ${grounding} Source entity IDs: ${sourceIds}. Query inputs establish retrieval context, not pairwise proof, a personal affinity score, or a prediction that you will enjoy it.`;
  const replies: Record<DebateAction, string> = {
    why: `${base} The ${door.tier.toLowerCase()} label is Open Door’s routing presentation, not a Qloo quality or taste score. A more specific personal reason is not established by retrieval alone.`,
    connection: `${base} ${candidate.request.anchors.length ? `${candidate.requestIsHistorical === false ? "Available continuation inputs (the historical saved query is unavailable)" : "The recorded request started from"}: ${candidate.request.anchors.map(anchor => anchor.label).join(", ")}.` : ""} Source IDs not matched to a resolved input are not assigned an invented meaning.`,
    evidence: `${base} Recorded evidence text: ${door.evidence || "No evidence text recorded."} ${door.explainability == null ? "No structured Qloo explainability is available in this snapshot." : "Structured explainability is recorded below as a bounded, sensitive-key-filtered excerpt. Its presence is not a personal-preference guarantee."}`,
    persuade: `${base} I cannot honestly convince you that you will like it or invent a shared mood, style, or biography. ${door.now ? `The recorded first step is: ${door.now}` : "Try a short preview only if you are curious."} You can reject the result and request a different route.`,
    weak: `${base} Your objection is reasonable: a query-conditioned result is weaker than an explained pairwise relationship. ${door.explainability == null ? "There is no structured explanation here to strengthen that claim." : "Review the actual structured excerpt; I will not infer an unreturned causal explanation from it."} Choose an alternative action if you want to change the route.`,
    perspective: `${base} Another way to use this is as a question to investigate, not an endorsement. Compare a preview of ${door.title} with one of the resolved inputs above and decide what, if anything, connects for you. This is a local exploration suggestion, not additional Qloo evidence.`,
    disagree: `${base} Your explicit disagreement will send “Not my scene” feedback and request a fresh route. It changes requested cultural types, not a learned personality profile.`,
    alternative: `${base} The next query will use the selected entity as its seed, retain the recorded location and practical context, and exclude results already seen in this conversation. Original interests remain visible in the session history; they are not falsely claimed as direct inputs to every continuation.`,
    unexpected: `${base} The next query uses “Too familiar” feedback, “Try something new” intent, and “Take me somewhere unexpected” depth. This changes routing, not a measurable surprise score; a cross-category result is not guaranteed.`,
  };
  const seedLimitation = isRetrievalAction(action) && (!door.entityId || !door.entityType)
    ? " This snapshot lacks a complete reusable entity ID/type. Qloo Search must resolve the selected name again; a match is not guaranteed." : "";
  return { text: `${continuity}${replies[action]}${seedLimitation}`, evidence: ["evidence", "weak", "persuade"].includes(action) ? formattedDebateEvidence(candidate) : undefined };
}

export function createDebateRequest(session: DebateSession, action: DebateAction): DiscoveryRequest {
  if (!isRetrievalAction(action)) throw new Error("Choose an alternative, disagreement, or unexpected action for a live retrieval.");
  const current = session.current;
  const door = current.door;
  if (!door.title.trim() || door.title.length > 120) throw new Error("This result name cannot be reused within the 120-character seed limit. Start a new named-interest discovery; no title will be silently shortened.");
  const excluded = [...new Set([...session.seenEntityIds, ...(current.request.excludedEntityIds || []),
    ...(current.mode === "live" && door.entityId ? [door.entityId] : [])])];
  if (excluded.length > 40) throw new Error("This conversation has reached the 40-entity exclusion limit. Start a new conversation; no seen-result exclusions will be silently dropped.");
  const feedback = [...new Set([...session.feedback, ...(action === "disagree" ? ["Not my scene"] : action === "unexpected" ? ["Too familiar"] : [])])];
  const original = cloneRequest(current.request);
  const reusable = current.mode === "live" && door.entityId && door.entityType;
  return {
    location: original.location, occasion: original.occasion, context: { ...original.context },
    intent: action === "unexpected" ? "Try something new" : "Go deeper",
    depth: action === "unexpected" ? "Take me somewhere unexpected" : original.depth,
    anchors: [{ label: door.title, category: door.category }],
    ...(reusable ? { resolvedEntities: [{ label: door.title, category: door.category, entityId: door.entityId!, entityType: door.entityType! }] } : {}),
    excludedEntityIds: excluded, feedback, iteration: session.iteration + 1,
  };
}

export function debateCandidateFromJourney(journey: LiveJourney, door: LiveDoor, request: DiscoveryRequest, connection: QlooConnectionSource): DebateCandidate {
  return snapshotCandidate({
    id: `live:${door.entityId}`, label: door.title, mode: "live", door, request,
    resolvedAnchors: journey.resolvedAnchors, connection,
  });
}
export function unseenDebateDoors(journey: LiveJourney, seen: string[]): LiveDoor[] {
  const excluded = new Set(seen);
  return journey.doors.filter(door => {
    if (!door.entityId || excluded.has(door.entityId)) return false;
    excluded.add(door.entityId); return true;
  });
}
