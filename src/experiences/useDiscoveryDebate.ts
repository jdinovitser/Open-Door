import { useEffect, useRef, useState } from "react";
import { runAgentDiscovery, type DiscoveryRequest, type LiveJourney, type QlooConnectionSource } from "../agentApi";
import { controlsFor, validateWhatIf } from "./whatIf";
import { createDebateRequest, debateCandidateFromJourney, debateReply, isRetrievalAction, newDebateSession, snapshotCandidate, unseenDebateDoors, type DebateAction, type DebateCandidate, type DebateSession, type DebateTurn } from "./debate";

type Pending = { request: DiscoveryRequest; base: DebateSession | null };
type Returned = { journey: LiveJourney; request: DiscoveryRequest; source: QlooConnectionSource };
const turn = (role: DebateTurn["role"], text: string, candidate: DebateCandidate, action?: DebateAction, evidence?: string): DebateTurn => ({
  id: crypto.randomUUID(), role, text, targetTitle: candidate.door.title, targetEntityId: candidate.door.entityId, action, evidence,
});

export function useDiscoveryDebate(source: QlooConnectionSource, active: boolean) {
  const [session, setSession] = useState<DebateSession | null>(null);
  const [returned, setReturned] = useState<Returned | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [empty, setEmpty] = useState("");
  const state = useRef<DebateSession | null>(null);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<Pending | null>(null);
  const publish = (next: DebateSession | null) => { state.current = next; setSession(next); };
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const wasRunning = !!controller.current;
    controller.current?.abort(); controller.current = null; setBusy(false); setStage("");
    if (wasRunning) setError("Discovery stopped because you left the conversation or changed connections. Previous evidence and results are unchanged.");
  }, [source, active]);

  function start(candidate: DebateCandidate) {
    if (controller.current) return;
    const next = newDebateSession(candidate);
    next.turns.push(turn("assistant", `We’re examining “${candidate.door.title}”. Ask a question or choose a challenge. Replies are deterministic readings of this recommendation’s recorded evidence, not an AI conversation or a prediction of your taste.`, next.current));
    publish(next); setReturned(null); setError(""); setEmpty(""); pending.current = null;
  }
  function clear() {
    if (controller.current) return;
    publish(null); setReturned(null); setError(""); setEmpty(""); pending.current = null;
  }
  function select(candidate: DebateCandidate) {
    if (!state.current || controller.current) return;
    const current = snapshotCandidate(candidate);
    const next = { ...state.current, current, turns: [...state.current.turns,
      turn("assistant", `You selected “${current.door.title}” for subsequent challenges. Earlier turns keep their original recommendation and evidence references.`, current)] };
    publish(next); setError(""); pending.current = null;
  }

  async function execute(request: DiscoveryRequest, base: DebateSession | null) {
    if (controller.current) return;
    const next = new AbortController(); controller.current = next;
    const connection = source;
    pending.current = { request: JSON.parse(JSON.stringify(request)) as DiscoveryRequest, base };
    setBusy(true); setError(""); setEmpty(""); setStage("Requesting a grounded cultural alternative…");
    try {
      const result = await runAgentDiscovery(request, event => {
        if (!next.signal.aborted && event.type === "stage") setStage(event.label);
      }, next.signal);
      if (next.signal.aborted) return;
      const doors = unseenDebateDoors(result, base?.seenEntityIds || []);
      const journey = { ...result, doors };
      setReturned({ journey, request, source: connection });
      if (!doors.length) {
        const message = "No unseen supported recommendation returned. Repeated or missing-entity results were not substituted. Your current recommendation and conversation are unchanged.";
        setEmpty(message);
        if (base) publish({ ...base, turns: [...base.turns, turn("assistant", message, base.current)] });
      } else {
        const current = debateCandidateFromJourney(journey, doors[0], request, connection);
        const initial = base || newDebateSession(current);
        publish({
          ...initial, current, iteration: request.iteration || 0, feedback: [...(request.feedback || [])],
          seenEntityIds: [...new Set([...initial.seenEntityIds, ...doors.map(door => door.entityId)])],
          turns: [...initial.turns, turn("assistant", `Qloo returned ${doors.length} unseen recommendation(s) using the ${connection} connection. “${current.door.title}” is selected for the next challenge. ${base ? `This continuation was seeded by “${base.current.door.title}”, not by an invented relationship to the original interests.` : "This starts a new conversation from the named interests you submitted."} Requested routing and exclusions do not prove preference or surprise.`, current)],
        });
      }
      pending.current = null;
    } catch (cause) {
      if (next.signal.aborted) return;
      const message = cause instanceof Error ? cause.message : "Discovery could not finish. Retry the same request.";
      setError(message);
      if (base) publish({ ...base, turns: [...base.turns, turn("assistant", `The live request failed: ${message} No replacement evidence or recommendation was invented.`, base.current)] });
    } finally {
      if (controller.current === next) { controller.current = null; setBusy(false); }
    }
  }

  function send(question: string, action: DebateAction) {
    const current = state.current;
    if (!current || controller.current || !question.trim()) return;
    const reply = debateReply(current, action);
    let next: DebateSession = { ...current, turns: [...current.turns, turn("user", question.trim(), current.current, action),
      turn("assistant", reply.text, current.current, action, reply.evidence)] };
    publish(next); setError(""); setEmpty("");
    if (!isRetrievalAction(action)) return;
    try {
      const request = createDebateRequest(next, action);
      next = { ...next, feedback: [...(request.feedback || [])], iteration: request.iteration || 0 };
      publish(next); void execute(request, next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This selection cannot be used as a live seed.");
      pending.current = null;
    }
  }
  function generate(request: DiscoveryRequest, maxAnchors: number) {
    if (controller.current) return;
    const errors = validateWhatIf({ id: "new", origin: "new", label: "Named interests", mode: "new", request, doors: [] }, controlsFor(request), maxAnchors);
    if (errors.length) { setError(errors.join(" ")); return; }
    void execute(JSON.parse(JSON.stringify(request)) as DiscoveryRequest, null);
  }
  function retry() {
    if (!pending.current || controller.current) return;
    const previous = pending.current;
    // Retry the exact public payload, never the newly edited prose or action.
    void execute(previous.request, previous.base ? state.current || previous.base : null);
  }
  function cancel() {
    controller.current?.abort(); controller.current = null; setBusy(false);
    const message = "Discovery cancelled. The current recommendation and recorded conversation are unchanged.";
    setError(message);
    if (state.current) publish({ ...state.current, turns: [...state.current.turns, turn("assistant", message, state.current.current)] });
  }
  return { session, returned, busy, stage, error, empty, canRetry: !!pending.current, start, select, clear, send, generate, retry, cancel };
}
