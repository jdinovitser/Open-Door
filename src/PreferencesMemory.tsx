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
  interests?: string[];
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
    if (!props.signedIn || !props.userId) {
      setError(""); setMessage("");
      try {
        const stored = JSON.parse(localStorage.getItem("opendoor.preferences") || "null");
        setMemory({ preferences: validPreferences(stored) ? stored : null, revision: 0 });
      } catch { setMemory({ preferences: null, revision: 0 }); }
      setStatus("ready");
      return;
    }
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
    if (!props.signedIn) {
      try {
        if (method === "PUT") localStorage.setItem("opendoor.preferences", JSON.stringify(props.values));
        else localStorage.removeItem("opendoor.preferences");
        setMemory({ preferences: method === "PUT" ? props.values : null, revision: 0 });
        setMessage(method === "PUT" ? "Preferences saved in this browser only." : "Saved preferences forgotten.");
        setStatus("ready");
      } catch {
        setError("Browser storage is unavailable. Your current choices still work, but were not saved.");
        setStatus("error");
      }
      return;
    }
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

  const busy = status === "loading" || status === "saving";
  return <section className="preference-memory" aria-labelledby="memory-title">
    <div className="module-heading"><div><span className="eyebrow">{props.signedIn ? "Optional · account memory" : "Optional · this browser only"}</span><h3 id="memory-title">Your discovery preferences</h3></div><p>No auto-save. You choose when to save, update, or forget.</p></div>
    <p><b>Current interests:</b> {props.interests?.length ? props.interests.join(" · ") : "Add named interests in the form above."} Edit interests and categories in the discovery form.</p>
    <div className="planner-controls">
      <label>Discovery intention<select aria-label="Profile discovery intention" value={props.values.intent} onChange={event => props.onApply({ ...props.values, intent: event.target.value as PreferenceValues["intent"] })}>
        {["Find my people", "Go deeper", "Try something new"].map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Exploration depth<select aria-label="Profile exploration depth" value={props.values.depth} onChange={event => props.onApply({ ...props.values, depth: event.target.value as PreferenceValues["depth"] })}>
        {["Close to home", "A little further", "Surprise me", "Take me somewhere unexpected"].map(value => <option key={value}>{value}</option>)}
      </select></label>
    </div>
    <p className="memory-note">Intention and depth change the requested Qloo result types. Interests become Qloo search inputs. Saving a door alone does not train Qloo or change retrieval; choose a saved door to explore from it.</p>
    <details><summary>Trip defaults · budget and movement</summary>
      <p>Separate from your interests. These affect local planning, not verified Qloo prices or accessibility. Review them for each outing.</p>
      <div className="planner-controls">
        <label>Budget<select aria-label="Profile trip budget" value={props.values.budget} onChange={event => props.onApply({ ...props.values, budget: event.target.value as PreferenceValues["budget"] })}>
          {["Flexible", "Free or low-cost", "Moderate", "Open to a splurge"].map(value => <option key={value}>{value}</option>)}
        </select></label>
        <label>Movement<select aria-label="Profile trip movement" value={props.values.movement} onChange={event => props.onApply({ ...props.values, movement: event.target.value as PreferenceValues["movement"] })}>
          {["Mostly seated", "Easy walking", "Active and moving", "Transit is fine"].map(value => <option key={value}>{value}</option>)}
        </select></label>
      </div>
    </details>
    <div className="memory-fields"><div><b>Can be remembered</b><p>Discovery intent · exploration depth · budget · movement preference</p></div><div><b>Never stored here</b><p>Health notes · scenario text · anchors or interests · city or location</p></div></div>
    <p className="memory-preview">If you choose Save: {props.values.intent} · {props.values.depth} · {props.values.budget} · {props.values.movement}</p>
    {memory?.preferences
      ? <div className="memory-preview"><b>Saved values</b><p>Intent: {memory.preferences.intent} · Depth: {memory.preferences.depth} · Budget: {memory.preferences.budget} · Movement: {memory.preferences.movement}</p><small>{!props.signedIn || props.hasJourney || props.demoActive || props.hasFormEdits ? "Preview only; they were not applied over your current journey or edits. Restore them to apply." : "Restored to the editable discovery form. Review or adjust before discovering."}</small></div>
      : <p className="memory-preview">Current editable discovery settings are not saved {props.signedIn ? "to your account" : "as browser preferences"}.</p>}
    {status === "loading" && <p role="status">Loading account preference memory…</p>}
    {status === "error" && <div className="memory-error" role="alert"><p>{error}</p>{!memory && <button type="button" className="secondary-btn" onClick={() => setLoadAttempt(value => value + 1)}>Retry loading preferences</button>}</div>}
    {message && <p role="status" className="memory-success">{message}</p>}
    <div className="memory-actions">
      <button type="button" className="secondary-btn" disabled={busy || !memory} onClick={() => void write("PUT")}><Check size={14} /> Save these four settings</button>
      <button type="button" className="secondary-btn" disabled={busy || !memory?.preferences} onClick={() => void write("DELETE")}><Trash2 size={14} /> Forget saved settings</button>
      {memory?.preferences && <button type="button" className="text-button" disabled={busy} onClick={() => props.onApply(memory.preferences!)}><RotateCcw size={14} /> Restore saved values</button>}
    </div>
    <p className="memory-note">Health notes and personal scenarios are excluded. {props.signedIn ? "Account updates use your current account revision." : "Browser preferences are not synced or automatically applied. Use Restore saved values to apply them."}</p>
  </section>;
}
