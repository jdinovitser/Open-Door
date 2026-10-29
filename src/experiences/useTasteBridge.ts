import { useEffect, useRef, useState } from "react";
import { runAgentDiscovery, type AgentEvent, type LiveJourney, type QlooConnectionSource } from "../agentApi";
import { createBridgeRequest, type BridgePerson } from "./tasteBridge";

type BridgeRun = { journey: LiveJourney; people: BridgePerson[]; source: QlooConnectionSource };

export function useTasteBridge(source: QlooConnectionSource, active: boolean) {
  const [result, setResult] = useState<BridgeRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false); setError(""); setStage("");
    // Preserve the previous result with its original connection provenance.
  }, [source, active]);

  async function discover(people: BridgePerson[], location: string, occasion: string, maxAnchors: number) {
    if (controller.current && !controller.current.signal.aborted) return;
    const next = new AbortController();
    controller.current = next;
    setBusy(true); setError(""); setStage("Resolving your group’s cultural interests…");
    try {
      const request = createBridgeRequest(people, location, occasion, maxAnchors);
      const snapshot = people.map(person => ({ ...person, interests: person.interests.map(interest => ({ ...interest })) }));
      const journey = await runAgentDiscovery(request, (event: AgentEvent) => {
        if (!next.signal.aborted && event.type === "stage") setStage(event.label);
      }, next.signal);
      if (!next.signal.aborted) setResult({ journey, people: snapshot, source });
    } catch (cause) {
      if (!next.signal.aborted) setError(cause instanceof Error ? cause.message : "Qloo discovery could not finish. Try again.");
    } finally {
      if (controller.current === next) { controller.current = null; setBusy(false); }
    }
  }

  function cancel() {
    controller.current?.abort(); controller.current = null;
    setBusy(false); setStage(""); setError("Discovery cancelled. Your inputs and any previous results are unchanged.");
  }
  return { result, busy, error, stage, discover, cancel };
}
