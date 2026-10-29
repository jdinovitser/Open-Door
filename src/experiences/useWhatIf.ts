import { useEffect, useRef, useState } from "react";
import { runAgentDiscovery, type DiscoveryRequest, type LiveJourney, type QlooConnectionSource } from "../agentApi";
import { createWhatIfRequest, snapshotStart, type WhatIfControls, type WhatIfStart } from "./whatIf";

export type WhatIfRun = {
  original: WhatIfStart; request: DiscoveryRequest; controls: WhatIfControls;
  privateScenario: string; journey: LiveJourney; source: QlooConnectionSource;
};
export function useWhatIf(source: QlooConnectionSource, active: boolean) {
  const [run, setRun] = useState<WhatIfRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const iteration = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    controller.current?.abort(); controller.current = null; setBusy(false); setError(""); setStage("");
  }, [source, active]);
  function cancel() {
    controller.current?.abort(); controller.current = null; setBusy(false);
    setError("Scenario discovery cancelled. Your starting point and previous alternatives are unchanged.");
  }
  function clear() { setRun(null); setError(""); iteration.current = 0; }
  async function discover(original: WhatIfStart, controls: WhatIfControls, privateScenario: string, maxAnchors: number) {
    if (controller.current) return;
    const next = new AbortController();
    controller.current = next; setBusy(true); setError(""); setStage("Resolving your starting interests…");
    try {
      const snapshot = snapshotStart(original);
      const request = createWhatIfRequest(snapshot, controls, maxAnchors, ++iteration.current);
      // Free-form private prose deliberately never enters request/context/feedback.
      const journey = await runAgentDiscovery(request, event => {
        if (!next.signal.aborted && event.type === "stage") setStage(event.label);
      }, next.signal);
      if (!next.signal.aborted) setRun({ original: snapshot, request, controls: { ...controls }, privateScenario, journey, source });
    } catch (cause) {
      if (!next.signal.aborted) setError(cause instanceof Error ? cause.message : "Scenario discovery failed. Try again.");
    } finally {
      if (controller.current === next) { controller.current = null; setBusy(false); }
    }
  }
  return { run, busy, error, stage, discover, cancel, clear };
}
