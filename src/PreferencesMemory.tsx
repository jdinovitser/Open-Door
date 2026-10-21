import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw, Trash2 } from "lucide-react";

export type PreferenceValues = {
  intent: "Find my people" | "Go deeper" | "Try something new";
  depth: "Close to home" | "A little further" | "Surprise me" | "Take me somewhere unexpected";
  budget: "Flexible" | "Free or low-cost" | "Moderate" | "Open to a splurge";
  movement: "Mostly seated" | "Easy walking" | "Active and moving" | "Transit is fine";
};
type Props = {
  userId: string | null;
  signedIn: boolean;
  values: PreferenceValues;
  hasJourney: boolean;
  demoActive: boolean;
  hasFormEdits: boolean;
  onApply: (values: PreferenceValues) => void;
  onRevisionChanged: () => void;
};
type Loaded = { preferences: PreferenceValues | null; revision: number };
const defaults: PreferenceValues = { intent: "Try something new", depth: "A little further", budget: "Flexible", movement: "Mostly seated" };
function validPreferences(value: unknown): value is PreferenceValues {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["Find my people", "Go deeper", "Try something new"].includes(item.intent as string)
    && ["Close to home", "A little further", "Surprise me", "Take me somewhere unexpected"].includes(item.depth as string)
    && ["Flexible", "Free or low-cost", "Moderate", "Open to a splurge"].includes(item.budget as string)
    && ["Mostly seated", "Easy walking", "Active and moving", "Transit is fine"].includes(item.movement as string);
}

export default function PreferencesMemory(props: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "saving">("loading");
  const [error, setError] = useState("");
  const [memory, setMemory] = useState<Loaded | null>(null);
  const [message, setMessage] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const writeController = useRef<AbortController | null>(null);
  const current = useRef(props);
  current.current = props;

  useEffect(() => {
    if (!props.signedIn || !props.userId) { setMemory(null); setStatus("ready"); return; }
    const controller = new AbortController();
    let active = true;
    setStatus("loading"); setError(""); setMessage(""); setMemory(null);
    fetch("/api/account/preferences", { credentials: "include", headers: { Accept: "application/json" }, signal: controller.signal })
      .then(async response => {
        if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.message || "Saved preferences could not be loaded."); }
        return response.json();
      })
      .then((result: Loaded) => {
        if (!active) return;
        if (!Number.isSafeInteger(result.revision)) throw new Error("Account version could not be loaded.");
        if (result.preferences !== null && !validPreferences(result.preferences)) throw new Error("Saved discovery preferences could not be read safely.");
        setMemory({ preferences: result.preferences || null, revision: result.revision });
        setStatus("ready");
        // Restore only while still on an untouched initial discovery form.
        const now = current.current;
        if (result.preferences && !now.hasJourney && !now.demoActive && !now.hasFormEdits
          && now.values.intent === defaults.intent && now.values.depth === defaults.depth
          && now.values.budget === defaults.budget && now.values.movement === defaults.movement) now.onApply(result.preferences);
      })
      .catch(reason => { if (!active || controller.signal.aborted) return; setError(reason instanceof Error ? reason.message : "Saved preferences could not be loaded."); setStatus("error"); });
    return () => { active = false; controller.abort(); };
  }, [props.userId, props.signedIn, loadAttempt]);
  useEffect(() => () => writeController.current?.abort(), [props.userId]);

  async function write(method: "PUT" | "DELETE") {
    if (!memory || status === "saving") return;
    setStatus("saving"); setError(""); setMessage("");
    const controller = new AbortController();
    writeController.current = controller;
    try {
      const response = await fetch("/api/account/preferences", {
        method, credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(method === "PUT"
          ? { preferences: props.values, revision: memory.revision }
          : { revision: memory.revision }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) {
          props.onRevisionChanged();
          setLoadAttempt(value => value + 1);
        }
        throw new Error(result?.message || (response.status === 409 ? "These preferences changed elsewhere. Account data is syncing; reload before trying again." : "Could not update saved preferences."));
      }
      if (!Number.isSafeInteger(result?.revision)) throw new Error("The account version was not returned.");
      setMemory({ preferences: method === "PUT" ? props.values : null, revision: result.revision });
      setMessage(method === "PUT" ? "Preferences saved to your account." : "Saved preferences forgotten.");
      setStatus("ready");
      if (method === "DELETE") props.onRevisionChanged();
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "Could not update saved preferences.");
      setStatus("error");
    } finally {
      if (writeController.current === controller) writeController.current = null;
    }
  }

  if (!props.signedIn) return <aside className="preference-memory guest-memory"><div><span className="eyebrow">Optional account memory</span><h3>Keep a few discovery settings handy?</h3><p>Sign in to optionally remember intent, exploration depth, budget, and movement preference. Nothing is saved without your choice.</p></div><a href="/sign-in" className="secondary-btn">Sign in to choose</a></aside>;

  const busy = status === "loading" || status === "saving";
  return <section className="preference-memory" aria-labelledby="memory-title">
    <div className="module-heading"><div><span className="eyebrow">Optional · account-only</span><h3 id="memory-title">Remember a few discovery settings?</h3></div><p>No auto-save. You choose when to save, update, or forget.</p></div>
    <div className="memory-fields"><div><b>Can be remembered</b><p>Discovery intent · exploration depth · budget · movement preference</p></div><div><b>Never stored here</b><p>Health notes · scenario text · anchors or interests · city or location</p></div></div>
    <p className="memory-preview">If you choose Save: {props.values.intent} · {props.values.depth} · {props.values.budget} · {props.values.movement}</p>
    {memory?.preferences
      ? <div className="memory-preview"><b>Saved values</b><p>Intent: {memory.preferences.intent} · Depth: {memory.preferences.depth} · Budget: {memory.preferences.budget} · Movement: {memory.preferences.movement}</p><small>{props.hasJourney || props.demoActive || props.hasFormEdits ? "Preview only; they were not applied over your current journey or edits. Restore them to apply." : "Restored to the editable discovery form. Review or adjust before discovering."}</small></div>
      : <p className="memory-preview">Current editable discovery settings are not saved to your account.</p>}
    {status === "loading" && <p role="status">Loading account preference memory…</p>}
    {status === "error" && <div className="memory-error" role="alert"><p>{error}</p>{!memory && <button type="button" className="secondary-btn" onClick={() => setLoadAttempt(value => value + 1)}>Retry loading preferences</button>}</div>}
    {message && <p role="status" className="memory-success">{message}</p>}
    <div className="memory-actions">
      <button type="button" className="secondary-btn" disabled={busy || !memory} onClick={() => void write("PUT")}><Check size={14} /> Save these four settings</button>
      <button type="button" className="secondary-btn" disabled={busy || !memory?.preferences} onClick={() => void write("DELETE")}><Trash2 size={14} /> Forget saved settings</button>
      {memory?.preferences && <button type="button" className="text-button" disabled={busy} onClick={() => props.onApply(memory.preferences!)}><RotateCcw size={14} /> Restore saved values</button>}
    </div>
    <p className="memory-note">Saving or forgetting requires this button and uses your account's current revision. Health notes and other personal considerations are excluded.</p>
  </section>;
}
