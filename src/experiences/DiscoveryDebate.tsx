import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { MascotArt } from "../MascotArt";
import QlooConnectionPanel from "../QlooConnectionPanel";
import type { AgentStatus, DiscoveryRequest, LiveDoor, LiveJourney, QlooConnectionSource } from "../agentApi";
import { BRIDGE_CATEGORIES } from "./tasteBridge";
import { DEBATE_ACTIONS, debateCandidateFromJourney, debateContributions, formattedDebateEvidence, interpretDebateQuestion, isRetrievalAction, type DebateAction, type DebateCandidate } from "./debate";
import { useDiscoveryDebate } from "./useDiscoveryDebate";
import "./taste-bridge.css";
import "./what-if.css";
import "./debate.css";

type Props = {
  active: boolean; candidates: DebateCandidate[]; status: AgentStatus | null; statusError: string;
  source: QlooConnectionSource; initialLocation: string; disabled?: boolean;
  savedIds: Set<string>; onSave: (candidate: DebateCandidate) => void; onExplore: (candidate: DebateCandidate) => void;
  onSelectConnection: (mode: "demo" | "live", source: QlooConnectionSource) => void;
  renderDoor: (door: LiveDoor, journey: LiveJourney) => ReactNode;
};
const namedInterest = () => ({ id: crypto.randomUUID(), label: "", category: "Other" });

export default function DiscoveryDebate({ active, candidates, status, statusError, source, initialLocation, disabled, savedIds, onSave, onExplore, onSelectConnection, renderDoor }: Props) {
  const [candidateId, setCandidateId] = useState(() => candidates[0]?.id || "new");
  const [interests, setInterests] = useState(() => [namedInterest()]);
  const [location, setLocation] = useState(initialLocation);
  const [question, setQuestion] = useState("");
  const [actionChoice, setActionChoice] = useState<"auto" | DebateAction>("auto");
  const [validation, setValidation] = useState("");
  const debate = useDiscoveryDebate(source, active);
  const blocked = debate.busy || !!disabled;
  const recognized = interpretDebateQuestion(question);
  const action = actionChoice === "auto" ? recognized : actionChoice;
  const maxAnchors = status?.policy?.limits.anchorsPerRequest ?? 5;
  const selected = debate.session?.current;
  const contributions = selected ? debateContributions(selected) : [];
  const selectedEvidence = selected ? formattedDebateEvidence(selected) : undefined;
  const replacingSession = () => !debate.session || window.confirm("Start a new conversation? The current private transcript will be cleared after a recommendation is ready.");

  function start() {
    if (blocked) return;
    if (candidateId === "new") {
      if (!status?.qlooConfigured) { setValidation("Choose a working Qloo connection before generating a recommendation."); return; }
      const request: DiscoveryRequest = {
        location, occasion: "A free Saturday", intent: "Try something new", depth: "A little further",
        context: { time: "A free Saturday", budget: "Flexible", movement: "Open to anything", conditions: "Open to anything" },
        anchors: interests.map(({ label, category }) => ({ label, category })), feedback: [], iteration: 0,
      };
      if (replacingSession()) { setValidation(""); debate.generate(request, maxAnchors); }
    } else {
      const candidate = candidates.find(item => item.id === candidateId);
      if (!candidate) { setValidation("Choose an available recommendation to start with."); return; }
      if (replacingSession()) { debate.start(candidate); setQuestion(""); setActionChoice("auto"); setValidation(""); }
    }
  }
  function send() {
    if (blocked) return;
    if (!question.trim()) { setValidation("Write a challenge or choose a suggested question."); return; }
    if (!action) { setValidation("This wording is not recognized by the explicit rules. Choose the action you want; your prose will remain private."); return; }
    if (isRetrievalAction(action) && !status?.qlooConfigured) { setValidation("A working Qloo connection is needed for alternatives. Evidence questions remain available without it."); return; }
    debate.send(question, action); setValidation(""); setQuestion("");
  }

  return <section className="discovery-debate" aria-labelledby="discovery-debate-title">
    <header className="bridge-intro"><div><span className="eyebrow">A recommendation is a starting point, not a verdict.</span><h1 id="discovery-debate-title">Discovery Debate</h1>
      <p>Question a connection. Look at its evidence. Disagree and follow another route. The conversation follows the recommendation you select, not a guess about who you are.</p>
      <p className="helper">This is an explicit, rule-based evidence conversation—not an AI chat. Your questions and transcript stay in this browser session. Only approved cultural inputs, action feedback, and routing controls reach discovery.</p>
    </div><MascotArt scene="curiosity" priority /></header>
    {active && <QlooConnectionPanel status={status} mode="live" source={source} disabled={blocked} onSelect={onSelectConnection} />}
    {statusError && <p role="alert">{statusError} <button type="button" className="text-button" onClick={() => onSelectConnection("live", source)}>Retry connection</button></p>}
    <section className="what-if-source" aria-label="Debate starting point">
      <fieldset disabled={blocked} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <legend className="eyebrow">Choose a recommendation to question</legend>
        <div className="what-if-source-controls"><label>Recommendation source<select aria-label="Recommendation source" value={candidateId} onChange={event => setCandidateId(event.target.value)}>
          <option value="new">Generate from named interests</option>{candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label} · {candidate.mode === "live" ? "Qloo" : "prepared example"}</option>)}
        </select></label><button type="button" className="secondary-btn" onClick={start}>{candidateId === "new" ? "Generate a recommendation" : "Start this debate"}</button></div>
        {candidateId === "new" && <><label style={{ marginTop: 18 }}>Discovery city<input maxLength={120} value={location} onChange={event => setLocation(event.target.value)} /></label>
          {interests.map((interest, index) => <div className="bridge-interest" key={interest.id}><label>Debate interest {index + 1}<input maxLength={120} value={interest.label} onChange={event => setInterests(current => current.map(item => item.id === interest.id ? { ...item, label: event.target.value } : item))} /></label>
            <label>Category<select aria-label={`Debate category ${index + 1}`} value={interest.category} onChange={event => setInterests(current => current.map(item => item.id === interest.id ? { ...item, category: event.target.value } : item))}>{BRIDGE_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
            <button type="button" className="icon-action" aria-label={`Remove debate interest ${index + 1}`} onClick={() => setInterests(current => current.filter(item => item.id !== interest.id))}><X size={14} /></button></div>)}
          <button type="button" className="text-button" disabled={interests.length >= maxAnchors} onClick={() => setInterests(current => [...current, namedInterest()])}><Plus size={14} /> Add debate interest</button>
          <p className="helper">All typed interests are included, up to the connection’s {maxAnchors}-interest limit. No private question is used as a search term.</p>
        </>}
      </fieldset>
    </section>
    {validation && <p className="bridge-validation" role="alert">{validation}</p>}
    {debate.error && <div className="bridge-validation" role="alert"><p>{debate.error}</p>{debate.canRetry && <button type="button" className="secondary-btn" disabled={blocked || !status?.qlooConfigured} onClick={debate.retry}>Retry exact discovery request</button>}</div>}
    {debate.busy && <div className="bridge-state" role="status" aria-busy="true"><MascotArt scene="qloo" /><h2>Following a different thread.</h2><p>{debate.stage}</p><div className="bridge-skeleton" /><div className="bridge-skeleton" /><button type="button" className="secondary-btn" onClick={debate.cancel}>Cancel debate discovery</button></div>}
    {debate.empty && <div className="bridge-state" role="status"><MascotArt scene="coffee" /><h2>No unseen recommendation this time.</h2><p>{debate.empty}</p></div>}
    {!selected && !debate.busy && !debate.empty && <div className="bridge-state"><MascotArt scene="map" /><h2>Bring a recommendation. Bring your doubts.</h2><p>Choose an existing door, or generate a live recommendation from named interests.</p></div>}
    {selected && debate.session && <div className="debate-layout">
      <aside className="debate-selected" aria-label="Currently debated recommendation"><span className="eyebrow">Current recommendation · {selected.mode === "live" ? "Qloo-returned" : "prepared example"}</span><h2>{selected.door.title}</h2><p>{selected.door.category} · {selected.request.location || "No location specified"}</p>
        <dl><dt>Entity ID</dt><dd>{selected.door.entityId || "Not available"}</dd><dt>Recorded source entity IDs</dt><dd>{selected.door.sourceEntityIds?.join(", ") || "Not recorded"}</dd><dt>Original connection for this result</dt><dd>{selected.connection ? `${selected.connection} connection` : "Not recorded in the source snapshot; not inferred from today’s selection."}</dd></dl>
        <p className="helper">New discovery requests use the currently selected {source} connection. This does not rewrite the source of earlier evidence.</p>
        {selected.requestIsHistorical === false && <p className="helper">This saved item does not retain its full historical query. Its continuation settings come from current controls, not a reconstructed history.</p>}
        <h3>Resolved contributing inputs</h3>{contributions.length ? <ul>{contributions.map(anchor => <li key={`${anchor.label}-${anchor.entityId}`}>{anchor.label} → {anchor.entityName}<br /><small>{anchor.entityId}{anchor.exactNameMatch ? "" : " · approximate match; review"}</small></li>)}</ul> : <p className="helper">No resolved-input attribution is available for this snapshot. A source label alone is not verified attribution.</p>}
        <details><summary>Original session starting point</summary><p>{debate.session.original.door.title}</p><ul>{debate.session.original.request.anchors.map((anchor, index) => <li key={index}>{anchor.label} · {anchor.category}</li>)}</ul><p className="helper">Original interests stay in this local history. A continuation uses the selected recommendation as its next seed, not an invented direct relationship to every original interest.</p></details>
        {selectedEvidence && <details className="debate-evidence"><summary>Recorded explainability excerpt</summary><pre>{selectedEvidence}</pre><p className="helper">Bounded excerpt; sensitive-key fields and oversized/nested portions may be omitted. This is not a personal-preference guarantee.</p></details>}
        <div className="bridge-form-actions"><button type="button" className="secondary-btn" onClick={() => onSave(selected)}>{savedIds.has(selected.door.id) ? "Remove selected from My Doors" : "Save selected recommendation"}</button>
          <button type="button" className="primary-btn" disabled={blocked} onClick={() => onExplore(selected)}>Explore selected in Open Door</button>
          <button type="button" className="text-button" disabled={blocked} onClick={() => { if (window.confirm("Clear this private conversation?")) { debate.clear(); setQuestion(""); setValidation(""); } }}>Clear conversation</button></div>
      </aside>
      <section aria-label="Discovery debate conversation">
        <ol className="debate-transcript" aria-label="Session transcript" aria-live="polite" aria-relevant="additions">{debate.session.turns.map(entry => <li key={entry.id} className={`debate-turn ${entry.role === "user" ? "is-user" : "is-guide"}`}><span className="eyebrow">{entry.role === "user" ? "You" : "Evidence guide"}</span><small>About {entry.targetTitle}{entry.targetEntityId ? ` · ${entry.targetEntityId}` : " · no entity ID"}</small><p>{entry.text}</p>
          {entry.evidence && <details className="debate-evidence"><summary>Evidence excerpt at this turn</summary><pre>{entry.evidence}</pre><small>Bounded and sensitive-key filtered; omissions are not evidence of absence.</small></details>}
        </li>)}</ol>
        <form className="debate-composer" onSubmit={event => { event.preventDefault(); send(); }}>
          <fieldset disabled={blocked} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <legend className="eyebrow">Challenge the current recommendation</legend>
            <div className="debate-quick-actions">{DEBATE_ACTIONS.map(item => <button key={item.id} type="button" onClick={() => { setQuestion(item.question); setActionChoice(item.id); setValidation(""); }}>{item.label}</button>)}</div>
            <label>Your private challenge<textarea maxLength={2000} value={question} onChange={event => { setQuestion(event.target.value); setActionChoice("auto"); }} placeholder="What evidence supports this recommendation?" /></label>
            <label style={{ marginTop: 14 }}>Challenge action<select aria-label="Challenge action" value={actionChoice} onChange={event => setActionChoice(event.target.value as "auto" | DebateAction)}><option value="auto">Recognize explicit wording only</option>{DEBATE_ACTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <div className="debate-routing-preview" aria-label="Challenge interpretation">
              {action ? <><strong>{actionChoice === "auto" ? "Recognized by an exact wording rule" : "Your explicitly selected action"}: {DEBATE_ACTIONS.find(item => item.id === action)?.label}.</strong><p>{isRetrievalAction(action) ? `Sends a live request seeded by ${selected.door.title}${selected.mode === "live" && selected.door.entityId && selected.door.entityType ? ` [${selected.door.entityId}]` : " (name must be resolved through Qloo Search)"}. Keeps location/planning context and session feedback; excludes seen entities. ${action === "unexpected" ? "Adds Too familiar feedback and unexpected depth." : action === "disagree" ? "Adds Not my scene feedback." : "Uses Go deeper intent."} The private question is not sent.` : "Reads the current result’s recorded evidence locally. No new Qloo request and no inferred personal prediction."}</p></> : <p>Ambiguous or unsupported wording: select an action yourself. No intent will be guessed.</p>}
            </div>
            <button type="submit" className="primary-btn">Send challenge</button>
          </fieldset>
        </form>
      </section>
    </div>}
    {debate.returned && debate.returned.journey.doors.length > 0 && <section className="debate-results" aria-label="Debate returned recommendations"><span className="eyebrow">Actual returned alternatives · {debate.returned.source} connection</span><h2>Choose the next recommendation to question.</h2>
      {debate.returned.journey.notices?.map((notice, index) => <p className="helper" key={index}>{notice}</p>)}
      {debate.returned.journey.doors.map(door => <article key={door.id}><button type="button" className="secondary-btn" disabled={blocked || selected?.door.entityId === door.entityId} onClick={() => debate.select(debateCandidateFromJourney(debate.returned!.journey, door, debate.returned!.request, debate.returned!.source))}>{selected?.door.entityId === door.entityId ? `Currently debating ${door.title}` : `Debate ${door.title}`}</button>{renderDoor(door, debate.returned!.journey)}</article>)}
    </section>}
  </section>;
}
