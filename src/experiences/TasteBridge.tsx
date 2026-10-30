import { useState, type ReactNode } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { MascotArt } from "../MascotArt";
import QlooConnectionPanel from "../QlooConnectionPanel";
import type { AgentStatus, LiveDoor, LiveJourney, QlooConnectionSource } from "../agentApi";
import { BRIDGE_CATEGORIES, BRIDGE_ROUTES, bridgeAnchors, bridgeContributors, bridgeRouteDoors, normalizeInterest, validateBridge, type BridgeCategory, type BridgePerson } from "./tasteBridge";
import { useTasteBridge } from "./useTasteBridge";
import "./taste-bridge.css";

type Props = {
  active: boolean;
  status: AgentStatus | null;
  statusError: string;
  source: QlooConnectionSource;
  initialLocation: string;
  disabled?: boolean;
  onSelectConnection: (mode: "demo" | "live", source: QlooConnectionSource) => void;
  renderDoor: (door: LiveDoor, journey: LiveJourney) => ReactNode;
  onUseJourney?: (journey: LiveJourney) => void;
};
const newInterest = () => ({ id: crypto.randomUUID(), label: "", category: "Other" as BridgeCategory });
const newPerson = (number: number): BridgePerson => ({ id: crypto.randomUUID(), name: `Person ${number}`, interests: [newInterest()] });
const sharedInputOverlaps = (people: BridgePerson[]) => {
  const entries = new Map<string, { label: string; category: BridgeCategory; people: { id: string; name: string }[] }>();
  people.forEach((person, index) => person.interests.forEach(interest => {
    const label = interest.label.trim().replace(/\s+/g, " ");
    if (!label) return;
    const key = `${normalizeInterest(label)}|${interest.category}`;
    const entry = entries.get(key) ?? { label, category: interest.category, people: [] };
    if (!entry.people.some(participant => participant.id === person.id)) entry.people.push({ id: person.id, name: person.name.trim() || `Person ${index + 1}` });
    entries.set(key, entry);
  }));
  return [...entries.values()].filter(entry => entry.people.length > 1);
};

export default function TasteBridge({ active, status, statusError, source, initialLocation, disabled, onSelectConnection, renderDoor, onUseJourney }: Props) {
  const [people, setPeople] = useState<BridgePerson[]>(() => [newPerson(1), newPerson(2)]);
  const [location, setLocation] = useState(initialLocation);
  const [occasion, setOccasion] = useState("A free Saturday");
  const [attempted, setAttempted] = useState(false);
  const bridge = useTasteBridge(source, active);
  const maxAnchors = status?.policy?.limits.anchorsPerRequest ?? 5;
  const errors = validateBridge(people, maxAnchors);
  const blocked = bridge.busy || !!disabled;
  const changePerson = (id: string, update: Partial<BridgePerson>) => setPeople(current => current.map(person => person.id === id ? { ...person, ...update } : person));
  const submit = () => {
    setAttempted(true);
    if (errors.length || blocked || !status?.qlooConfigured) return;
    void bridge.discover(people, location, occasion, maxAnchors);
  };

  return <section className="taste-bridge" aria-labelledby="taste-bridge-title">
    <header className="bridge-intro"><div><span className="eyebrow">Different tastes. A new starting point.</span>
      <h1 id="taste-bridge-title">Taste Bridge</h1>
      <p>Two to five people. Different tastes. One unexpected connection to explore together.</p>
      <p className="helper">Names stay in this browser session. Only the interests, location, and occasion are sent for discovery. No group profile is saved.</p>
    </div><MascotArt scene="curiosity" priority /></header>
    {active && <QlooConnectionPanel status={status} mode="live" source={source} disabled={blocked} onSelect={onSelectConnection} />}
    <p className="helper">Live Qloo discovery, through your selected connection. Prepared examples stay in Discover.</p>
    {statusError && <p role="alert">{statusError} <button type="button" className="text-button" onClick={() => onSelectConnection("live", source)}>Retry connection</button></p>}
    <form className="bridge-setup" onSubmit={event => { event.preventDefault(); submit(); }}>
      <fieldset disabled={blocked} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <legend className="eyebrow">Start with your people</legend>
        <div className="bridge-context">
          <label>Location<input value={location} onChange={event => setLocation(event.target.value)} maxLength={120} /></label>
          <label>Occasion<input value={occasion} onChange={event => setOccasion(event.target.value)} maxLength={100} /></label>
        </div>
        <div className="bridge-people">{people.map((person, index) => <fieldset className="bridge-person" key={person.id}>
          <legend>PERSON {index + 1} · THEIR STARTING POINTS</legend>
          <div className="bridge-person-head"><label>Name or label<input aria-label={`Person ${index + 1} name`} value={person.name} maxLength={60} onChange={event => changePerson(person.id, { name: event.target.value })} /></label>
            <button type="button" className="icon-action" disabled={people.length <= 2} aria-label={`Remove person ${index + 1}`} onClick={() => setPeople(current => current.filter(item => item.id !== person.id))}><Trash2 size={15} /></button>
          </div>
          {person.interests.map((interest, interestIndex) => <div className="bridge-interest" key={interest.id}>
            <label>Interest {interestIndex + 1}<input aria-label={`Person ${index + 1} interest ${interestIndex + 1}`} placeholder="An artist, film, food…" maxLength={120} value={interest.label}
              onChange={event => changePerson(person.id, { interests: person.interests.map(item => item.id === interest.id ? { ...item, label: event.target.value } : item) })} /></label>
            <label>Category<select aria-label={`Person ${index + 1} category ${interestIndex + 1}`} value={interest.category}
              onChange={event => changePerson(person.id, { interests: person.interests.map(item => item.id === interest.id ? { ...item, category: event.target.value as BridgeCategory } : item) })}>{BRIDGE_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
            <button type="button" className="icon-action" aria-label={`Remove person ${index + 1} interest ${interestIndex + 1}`} onClick={() => changePerson(person.id, { interests: person.interests.filter(item => item.id !== interest.id) })}><X size={14} /></button>
          </div>)}
          <button type="button" className="text-button" disabled={person.interests.length >= maxAnchors} onClick={() => changePerson(person.id, { interests: [...person.interests, newInterest()] })}><Plus size={13} /> Add interest</button>
        </fieldset>)}</div>
        <div className="bridge-form-actions">
          <button type="button" className="secondary-btn" disabled={people.length >= 5} onClick={() => setPeople(current => [...current, newPerson(current.length + 1)])}><Plus size={15} /> Add person</button>
          <span className="helper">{people.length}/5 people · {bridgeAnchors(people).length}/{maxAnchors} distinct interests</span>
          <button type="submit" className="primary-btn" disabled={!status?.qlooConfigured}>Find our bridge</button>
          <p className="helper">Repeated interests in the same category count once. Every person needs at least one. Nothing is silently left out.</p>
        </div>
      </fieldset>
      {(attempted || bridgeAnchors(people).length > maxAnchors) && errors.length > 0 && <div className="bridge-validation" role="alert">{errors.map(error => <p key={error}>{error}</p>)}</div>}
      {!status?.qlooConfigured && <p role="status" className="helper">{status ? "This Qloo connection is unavailable. Select a working connection above." : "Checking the selected Qloo connection…"}</p>}
    </form>
    {bridge.busy && <div className="bridge-state" role="status" aria-live="polite" aria-busy="true"><MascotArt scene="qloo" /><h2>Looking for a thread between you.</h2><p>{bridge.stage}</p><div className="bridge-skeleton" /><div className="bridge-skeleton" /><button type="button" className="secondary-btn" onClick={bridge.cancel}>Cancel discovery</button></div>}
    {bridge.error && <div className="bridge-validation" role="alert"><p>{bridge.error}</p><p>Your previous results, if any, have not changed. No prepared examples were substituted.</p><button className="secondary-btn" type="button" disabled={blocked || !status?.qlooConfigured} onClick={submit}>Retry discovery</button></div>}
    {!bridge.result && !bridge.busy && !bridge.error && <div className="bridge-state"><MascotArt scene="map" /><h2>A little common curiosity.</h2><p>Add everyone’s interests above. The connections start there.</p></div>}
    {bridge.result && <section className="bridge-results" aria-label="Taste Bridge results">
      <span className="eyebrow">Live Qloo · {bridge.result.source === "shared" ? "shared connection" : "personal connection"} · combined-interest search</span>
      <h2>One place to begin. Three ways in.</h2>
      <p className="bridge-results-lede">A few cultural directions for this group to explore together.</p>
      <details className="bridge-caveat"><summary>What this connection means</summary>
        <p>Results reflect Qloo retrieval conditioned on the resolved interests submitted for this search. They are candidates, not pairwise affinity, evidence that people are connected, or a prediction that everyone will like them. Results reflect this search, not later edits.</p>
      </details>
      <details className="bridge-resolutions"><summary>Review how Qloo resolved each interest</summary><ul>{bridge.result.people.flatMap(person => person.interests.map(interest => {
        const resolved = bridge.result!.journey.resolvedAnchors.find(anchor => normalizeInterest(anchor.label) === normalizeInterest(interest.label) && anchor.category === interest.category);
        return <li key={`${person.id}-${interest.id}`}><strong>{person.name}: {interest.label}</strong> · {interest.category} — {resolved ? `${resolved.entityName} (${resolved.entityType})${resolved.exactNameMatch ? " · exact name match" : " · approximate match; please review"}` : "Not resolved; not attributed as a contributing interest."}</li>;
      }))}</ul></details>
      {bridge.result.journey.notices?.map((notice, index) => <p className="helper" key={index}>{notice}</p>)}
      {onUseJourney && bridge.result.journey.doors.length > 0 && <div className="bridge-form-actions">
        <button type="button" className="primary-btn" disabled={blocked} onClick={() => onUseJourney(bridge.result!.journey)}>Plan this journey together</button>
        <p className="helper">Use these same results in Discover to build your day, open maps, download, and save doors. Participant names remain here.</p>
      </div>}
      {!bridge.result.journey.doors.length && <div className="bridge-state"><MascotArt scene="coffee" /><h2>No supported results this time.</h2><p>Try more specific named interests or another category, then find your bridge again.</p></div>}
      {BRIDGE_ROUTES.map(route => {
        const doors = bridgeRouteDoors(bridge.result!.journey, route.tier);
        const overlaps = route.tier === "Familiar" ? sharedInputOverlaps(bridge.result!.people) : [];
        return <section className={`bridge-result${route.tier === "Adjacent" ? " bridge-result-featured" : ""}`} key={route.tier} aria-label={route.title}><div className="bridge-result-context"><span className="eyebrow">{route.tier} direction</span><h2>{route.title}</h2><p>{route.tier === "Adjacent" ? "A nearby cultural direction for your next conversation." : route.note}</p>
          <div className="bridge-starting-points"><strong>Who’s bringing what</strong>
            {bridge.result!.people.map((person, personIndex) => <div className="bridge-starting-person" key={person.id}>
              <b>{person.name.trim() || `Person ${personIndex + 1}`}</b>
              <span>{person.interests.map(interest => interest.label.trim()).filter(Boolean).join(" · ") || "No named interests"}</span>
            </div>)}
          </div>
          {route.tier === "Familiar" && <div className="bridge-overlap">
            <strong>Shared Ground · your declared overlap</strong>
            {overlaps.length ? <ul>{overlaps.map(item => <li key={`${item.label}-${item.category}`}><b>{item.label}</b> · {item.category} — {item.people.map(person => person.name).join(" and ")}</li>)}</ul> : <p>No exact shared interests were entered. This is based only on what you typed, not Qloo.</p>}
            <p className="bridge-input-note">User input only; not a Qloo finding.</p>
          </div>}
          {doors.map(door => {
            const contributors = bridgeContributors(bridge.result!.people, bridge.result!.journey, door);
            return <details className="bridge-contributors" key={door.id}><summary>Why this appeared: {door.title}</summary>
              {contributors.length ? <ul>{contributors.map(person => <li key={person.personId}><b>{person.name}</b>: {person.interests.map(interest => `${interest.label} → ${interest.entityName}`).join("; ")}</li>)}</ul> : <p>No participant-level source attribution is available for this result.</p>}
              <p>These are submitted query inputs matched to returned source entity IDs. They are not individual affinity scores or pairwise evidence.</p></details>;
          })}
        </div><div>{doors.length ? doors.map(door => <div key={door.id}>{renderDoor(door, bridge.result!.journey)}</div>) : <div className="bridge-missing"><strong>No supported {route.title.toLowerCase()} returned.</strong><p>{route.tier === "Unexpected" ? "Qloo did not return a confirmed cross-category result for this slot. We haven’t relabeled another result as a wild card." : "This route has no available Qloo result. Try editing your interests and searching again."}</p></div>}</div></section>;
      })}
      {bridge.result.journey.doors.some(door => door.tier === "Unexpected" && !door.unexpectedCrossCategory) && <section><h2>Another direction, not a confirmed wild card</h2><p>The available result is not confirmed as cross-category.</p>{bridge.result.journey.doors.filter(door => door.tier === "Unexpected" && !door.unexpectedCrossCategory).map(door => <div key={door.id}>{renderDoor(door, bridge.result!.journey)}</div>)}</section>}
    </section>}
  </section>;
}
