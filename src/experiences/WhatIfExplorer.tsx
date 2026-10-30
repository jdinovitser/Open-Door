import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { MascotArt } from "../MascotArt";
import QlooConnectionPanel from "../QlooConnectionPanel";
import type { AgentStatus, LiveDoor, LiveJourney, QlooConnectionSource } from "../agentApi";
import { BRIDGE_CATEGORIES } from "./tasteBridge";
import { WHAT_IF_DEPTHS, WHAT_IF_INTENTS, applyWhatIfMappings, compareWhatIfResults, controlsFor, interpretWhatIf, practicalWhatIfNotes, snapshotStart, validateWhatIf, whatIfChanges, type WhatIfControls, type WhatIfStart } from "./whatIf";
import { useWhatIf } from "./useWhatIf";
import "./taste-bridge.css";
import "./what-if.css";

type Props = {
  active: boolean; sources: WhatIfStart[]; status: AgentStatus | null; statusError: string;
  source: QlooConnectionSource; initialLocation: string; disabled?: boolean;
  onSelectConnection: (mode: "demo" | "live", source: QlooConnectionSource) => void;
  renderDoor: (door: LiveDoor, journey: LiveJourney) => ReactNode;
  incoming?: WhatIfStart | null;
  onPreserve?: (original: WhatIfStart, alternative: LiveJourney) => void;
};
const blankInterest = () => ({ id: crypto.randomUUID(), label: "", category: "Other" });
const DEFAULT_CONTROLS: WhatIfControls = { location: "", intent: "Try something new", depth: "A little further", budget: "Flexible", time: "A free Saturday", movement: "Open to anything" };

export default function WhatIfExplorer({ active, sources, status, statusError, source, initialLocation, disabled, onSelectConnection, renderDoor, incoming, onPreserve }: Props) {
  const [sourceId, setSourceId] = useState(() => sources[0]?.id || "new");
  const [interests, setInterests] = useState(() => [blankInterest()]);
  const [original, setOriginal] = useState<WhatIfStart | null>(null);
  const [controls, setControls] = useState<WhatIfControls>({ ...DEFAULT_CONTROLS, location: initialLocation });
  const [scenario, setScenario] = useState("");
  const [attempted, setAttempted] = useState(false);
  const explorer = useWhatIf(source, active);
  const received = useRef("");
  useEffect(() => {
    if (!active || !incoming || received.current === incoming.id) return;
    received.current = incoming.id;
    if (original && !window.confirm("Use this discovery as your new What If? starting point? The current what-if comparison will be replaced; discoveries in other experiences stay unchanged.")) return;
    const snapshot = snapshotStart(incoming);
    setSourceId(incoming.id); setOriginal(snapshot); setControls(controlsFor(snapshot.request));
    setScenario(""); setAttempted(false); explorer.clear();
  }, [active, incoming]); // A handoff is consumed once; later edits remain private.
  const interpretation = interpretWhatIf(scenario);
  const maxAnchors = status?.policy?.limits.anchorsPerRequest ?? 5;
  const blocked = explorer.busy || !!disabled;
  const validation = original ? validateWhatIf(original, controls, maxAnchors) : ["Choose and capture a starting point first."];
  const change = (field: keyof WhatIfControls, value: string) => setControls(current => ({ ...current, [field]: value }));
  function captureStart() {
    const selected = sourceId === "new" ? {
      id: `new-${crypto.randomUUID()}`, origin: "new" as const, label: "New named interests", mode: "new" as const, doors: [],
      request: { location: initialLocation, occasion: DEFAULT_CONTROLS.time, intent: DEFAULT_CONTROLS.intent, depth: DEFAULT_CONTROLS.depth,
        context: { time: DEFAULT_CONTROLS.time, budget: DEFAULT_CONTROLS.budget, movement: DEFAULT_CONTROLS.movement, conditions: "Open to anything" },
        anchors: interests.map(({ label, category }) => ({ label, category })), feedback: [], iteration: 0 },
    } : sources.find(item => item.id === sourceId);
    if (!selected) return;
    const snapshot = snapshotStart(selected);
    setOriginal(snapshot); setControls(controlsFor(snapshot.request)); setScenario(""); setAttempted(false); explorer.clear();
  }
  function submit() {
    setAttempted(true);
    if (!original || validation.length || blocked || !status?.qlooConfigured) return;
    void explorer.discover(original, controls, scenario, maxAnchors);
  }
  const comparison = explorer.run ? compareWhatIfResults(explorer.run.original, explorer.run.journey) : null;
  const changes = explorer.run ? whatIfChanges(explorer.run.original.request, explorer.run.request) : [];

  return <section className="what-if-explorer" aria-labelledby="what-if-title">
    <header className="bridge-intro"><div><span className="eyebrow">Same curiosity. Different circumstances.</span><h1 id="what-if-title">What If? Explorer</h1>
      <p>A different city, a quieter afternoon, or a bigger leap. Try another version of your discovery without rewriting the original.</p>
      <p className="helper">Your free-form scenario stays in this browser session. Only the named interests and the controls you approve are sent for discovery.</p>
    </div><MascotArt scene="explorer" priority /></header>
    {active && <QlooConnectionPanel status={status} mode="live" source={source} disabled={blocked} onSelect={onSelectConnection} />}
    <p className="helper">Alternatives use the selected live Qloo connection. Prepared examples return to Solo discovery; no demo results are substituted here.</p>
    {statusError && <p role="alert">{statusError} <button type="button" className="text-button" onClick={() => onSelectConnection("live", source)}>Retry connection</button></p>}
    <section className="what-if-source" aria-label="Scenario starting point">
      <fieldset disabled={blocked} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <legend className="eyebrow">01 / Keep a starting point</legend>
        <div className="what-if-source-controls"><label>Start from<select aria-label="Start from" value={sourceId} onChange={event => setSourceId(event.target.value)}>
          <option value="new">New named interests</option>{sources.map(item => <option key={item.id} value={item.id}>{item.label} · {item.mode === "live" ? "Qloo" : "prepared example"}</option>)}
        </select></label><button type="button" className="secondary-btn" onClick={captureStart}>Use this starting point</button></div>
        {sourceId === "new" && <><p className="helper">Use specific cultural names. All rows are included; the connection accepts up to {maxAnchors} interests.</p>
          {interests.map((interest, index) => <div className="bridge-interest" key={interest.id}><label>Named interest {index + 1}<input maxLength={120} value={interest.label} placeholder="An artist, film, book…" onChange={event => setInterests(current => current.map(item => item.id === interest.id ? { ...item, label: event.target.value } : item))} /></label>
            <label>Interest category {index + 1}<select aria-label={`Interest category ${index + 1}`} value={interest.category} onChange={event => setInterests(current => current.map(item => item.id === interest.id ? { ...item, category: event.target.value } : item))}>{BRIDGE_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
            <button type="button" className="icon-action" aria-label={`Remove named interest ${index + 1}`} onClick={() => setInterests(current => current.filter(item => item.id !== interest.id))}><X size={14} /></button></div>)}
          <button type="button" className="text-button" disabled={interests.length >= maxAnchors} onClick={() => setInterests(current => [...current, blankInterest()])}><Plus size={14} /> Add named interest</button>
        </>}
        {original && <p role="status" className="helper">Captured: {original.label}. Choosing or editing a source above does not replace it until you press “Use this starting point”.</p>}
      </fieldset>
    </section>
    {original ? <>
      <form className="bridge-setup" onSubmit={event => { event.preventDefault(); submit(); }}>
        <fieldset disabled={blocked} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <legend className="eyebrow">02 / Change the circumstances</legend>
          <label>Your private what-if scenario<textarea value={scenario} maxLength={2000} placeholder="What if I only have two hours? I want something completely different." onChange={event => setScenario(event.target.value)} /></label>
          <div className="what-if-recognition" aria-label="Scenario interpretation preview">
            <strong>A small set of explicit rules, not an AI interpretation</strong>
            <p className="helper">Nothing is applied automatically. Recognized statements are previewed below; apply them, then edit any control to override. Unrecognized prose stays private and does not change the request.</p>
            {interpretation.mappings.length ? <><ul>{interpretation.mappings.map((mapping, index) => <li key={index}>“{mapping.statement}” → <b>{mapping.field}: {mapping.value}</b><span className="what-if-scope">{mapping.scope === "routing" ? "May affect Qloo query routing (location only for supported place/destination queries)." : "Local planning context only—not a Qloo suitability filter."}</span></li>)}</ul>
              <button className="secondary-btn" type="button" onClick={() => setControls(current => applyWhatIfMappings(current, interpretation.mappings))}>Apply recognized changes</button>
            </> : <p className="helper">No supported control changes recognized. Set the controls below yourself.</p>}
            {interpretation.localNotes.map(note => <p className="helper" key={note}>{note}</p>)}
            {interpretation.unrecognized.length > 0 && <p className="helper">Not mapped: {interpretation.unrecognized.length} statement(s). No intent, needs, or restrictions were inferred from these.</p>}
            <details><summary>Supported statement examples</summary><p className="helper">“I only have two hours.” “I have a smaller budget.” “I want a relaxed experience.” “I am exploring in Paris.” “I want to go deeper.” “I want something completely different.” These are exact-pattern rules, not general language understanding. Conflicting recognized statements apply in written order; the last one wins in the previewed control.</p></details>
          </div>
          <div className="what-if-controls">
            <label>Alternative city<input maxLength={120} value={controls.location} onChange={event => change("location", event.target.value)} /><span className="what-if-scope">Qloo location only on supported place/destination queries.</span></label>
            <label>Alternative intent<select value={controls.intent} onChange={event => change("intent", event.target.value)}>{WHAT_IF_INTENTS.map(intent => <option key={intent}>{intent}</option>)}</select><span className="what-if-scope">May change the cultural entity types requested.</span></label>
            <label>Alternative depth<select value={controls.depth} onChange={event => change("depth", event.target.value)}>{WHAT_IF_DEPTHS.map(depth => <option key={depth}>{depth}</option>)}</select><span className="what-if-scope">Open Door routing choice, not a Qloo distance score.</span></label>
            <label>Alternative budget<input maxLength={100} value={controls.budget} onChange={event => change("budget", event.target.value)} /><span className="what-if-scope">Planning only. Current prices are not checked or filtered.</span></label>
            <label>Alternative time<input maxLength={100} value={controls.time} onChange={event => change("time", event.target.value)} /><span className="what-if-scope">Planning only. Duration and opening hours are not verified. Changing this clears any inherited start/end window.</span></label>
            <label>Alternative movement<input maxLength={100} value={controls.movement} onChange={event => change("movement", event.target.value)} /><span className="what-if-scope">Planning only. Access and physical suitability are not verified.</span></label>
          </div>
          <div className="bridge-form-actions"><button type="button" className="secondary-btn" onClick={() => { setControls(controlsFor(original.request)); setScenario(""); setAttempted(false); explorer.clear(); }}>Restore original scenario</button>
            <button type="submit" className="primary-btn" disabled={!status?.qlooConfigured}>Explore this what-if</button></div>
        </fieldset>
        {attempted && validation.length > 0 && <div className="bridge-validation" role="alert">{validation.map(error => <p key={error}>{error}</p>)}</div>}
        {!status?.qlooConfigured && <p className="helper" role="status">{status ? "Choose an available Qloo connection above." : "Checking the selected Qloo connection…"}</p>}
      </form>
      <div className="what-if-comparison">
        <aside className="what-if-original" aria-label="Original starting point"><span className="eyebrow">Original · unchanged snapshot</span><h2>{original.label}</h2>
          <p>{original.request.location || "No location specified"} · {original.request.occasion}</p>
          <p>{original.request.intent} · {original.request.depth}</p>
          {original.origin === "saved" && <p className="helper">A saved door retains its cultural entity and city, not its historical scenario. The starting time, budget, movement, intent, and depth were captured from your current controls.</p>}
          <h3>Starting interests</h3><ul>{original.request.anchors.map((anchor, index) => <li key={index}>{anchor.label || "Empty interest"} · {anchor.category}</li>)}</ul>
          <h3>Original results</h3><p className="helper">{original.mode === "live" ? "Original Qloo-returned results." : original.mode === "demo" ? "Prepared examples—not Qloo evidence." : "Named-interest start; no original recommendations yet."}</p>
          {original.doors.length > 0 && <ul>{original.doors.map(door => <li key={door.id}><strong>{door.title}</strong><br />{door.category}</li>)}</ul>}
          {original.restore && <button className="secondary-btn" type="button" disabled={blocked} onClick={original.restore}>Return to original discovery</button>}
        </aside>
        <section className="what-if-alternatives" aria-label="What-if alternatives">
          {explorer.busy && <div className="bridge-state" role="status" aria-busy="true"><MascotArt scene="qloo" /><h2>Trying another version.</h2><p>{explorer.stage}</p><div className="bridge-skeleton" /><div className="bridge-skeleton" /><button type="button" className="secondary-btn" onClick={explorer.cancel}>Cancel what-if discovery</button></div>}
          {explorer.error && <div className="bridge-validation" role="alert"><p>{explorer.error}</p><p>No examples substituted. Your original and any earlier alternatives remain unchanged.</p><button type="button" className="secondary-btn" disabled={blocked || !status?.qlooConfigured} onClick={submit}>Retry what-if discovery</button></div>}
          {!explorer.run && !explorer.busy && !explorer.error && <div className="bridge-state"><MascotArt scene="map" /><h2>A different version is waiting.</h2><p>Change one or more controls, then explore. Your original stays beside the alternatives.</p></div>}
          {explorer.run && <><div className="what-if-summary"><span className="eyebrow">Live Qloo · {explorer.run.source} connection</span><h2>What actually changed</h2>
            <p className="helper">This comparison describes the submitted scenario, not later edits above.</p>
          {onPreserve && <button type="button" className="secondary-btn" disabled={blocked} onClick={() => onPreserve(explorer.run!.original, explorer.run!.journey)}>Preserve both paths in Discovery Lab</button>}
          {explorer.run.privateScenario && <details><summary>Private scenario used for this version</summary><p className="what-if-private">{explorer.run.privateScenario}</p><p className="helper">This prose was not sent to the API or saved with a door.</p></details>}
            {changes.length ? <ul className="what-if-changes">{changes.map(item => <li key={item.field}><strong>{item.field}</strong>: {item.before} → {item.after}<span className="what-if-scope">{item.scope === "routing" ? "Qloo-affecting routing input; actual results can still be unchanged." : "Recorded planning context only; does not filter Qloo cultural matches."}</span></li>)}</ul> : <p>No discovery controls changed from the starting snapshot. This is a fresh retrieval, not a changed scenario.</p>}
            {comparison?.comparable ? <p>{comparison.added} newly returned · {comparison.retained} retained · {comparison.missing} original results not returned. This compares entity IDs, not quality or suitability. Changes in returned results do not prove which input caused them.</p> : <p>No comparable original live entity set is available. These are new Qloo-returned alternatives, not a measured improvement over the starting point.</p>}
            {!changes.some(item => item.scope === "routing") && <p>Only planning context changed, or no controls changed. Qloo may return the same cultural matches. We do not claim budget, time, or movement changed affinity.</p>}
            <details><summary>Local practical planning—not Qloo evidence</summary><ul>{[...practicalWhatIfNotes(explorer.run.controls), ...interpretWhatIf(explorer.run.privateScenario).localNotes].map(note => <li key={note}>{note}</li>)}</ul><p className="helper">Confirm restrictions, age suitability, prices, access, travel time, and availability independently.</p></details>
          </div>
          {explorer.run.journey.notices?.map((notice, index) => <p className="helper" key={index}>{notice}</p>)}
          {explorer.run.journey.doors.length ? explorer.run.journey.doors.map(door => <div key={door.id}>{renderDoor(door, explorer.run!.journey)}</div>) : <div className="bridge-state"><MascotArt scene="coffee" /><h2>No alternatives returned.</h2><p>Try a different named interest, city, or routing choice. Your original is still here.</p></div>}
          </>}
        </section>
      </div>
    </> : <div className="bridge-state"><MascotArt scene="map" /><h2>First, keep something to come back to.</h2><p>Choose a journey, a saved door, or new named interests and capture your starting point.</p></div>}
  </section>;
}
