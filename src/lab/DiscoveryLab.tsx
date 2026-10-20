import { useMemo, useState } from "react";
import { AudioLines, GitBranch, MoveUpRight, Users, Sparkles, Map } from "lucide-react";
import { MascotArt } from "../MascotArt";
import { allDiscoveries, compareBranches } from "./engine.ts";
import { DOMAINS, STRATEGIES, type Discovery, type LabSeed, type Settings, type Strategy } from "./model.ts";
import type { LabController } from "./useDiscoveryLab.ts";
import "./lab.css";
import { ScenarioFields } from "./ScenarioFields.tsx";

type Props = { lab: LabController; qlooConfigured: boolean };

const strategyNotes: Record<Strategy, string> = {
  stay: "Keep close to your starting taste; look for a neighboring expression inside the same world.",
  thread: "Carry one creative thread into a neighboring domain and follow how it changes form.",
  cross: "Choose a destination domain before opening this door. Your starting point stays visible.",
  people: "Set the occasion and shared interests first; use them to shape the next discovery.",
  wild: "Invite an unusual connection, with its explanation kept alongside the result.",
  real: "Shape a practical plan using only the time, place, budget, and access details you provide.",
};
const strategyIcons = { stay: AudioLines, thread: GitBranch, cross: MoveUpRight, people: Users, wild: Sparkles, real: Map };

const optionSets = {
  adventure: ["familiar", "adjacent", "unexpected"],
  time: ["Quick discovery", "Afternoon", "Full day", "Weekend"],
  mood: ["Creative", "Cozy", "Social", "Adventurous", "Unusual"],
  domain: ["Any", ...DOMAINS],
  occasion: ["Solo outing", "Date", "Family activity", "Social gathering"],
} as const;
const rejectReasons = ["Not my taste", "Too far from my interests", "Not practical right now", "I have already explored this"];

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved journey" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function valuesText(items: string[]) { return items.length ? items.join(" · ") : "No anchors recorded"; }

export default function DiscoveryLab({ lab, qlooConfigured }: Props) {
  const { state, busy, error, loadError, storageWarning, notices } = lab;
  const current = state.current;
  const [anchors, setAnchors] = useState<string[]>([]);
  const [anchorDraft, setAnchorDraft] = useState("");
  const [location, setLocation] = useState("");
  const [scenario, setScenario] = useState<Pick<Settings, "scenario" | "scenarioCategory">>({});
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>("stay");
  const [destination, setDestination] = useState<string>("Art");
  const [compareCheckpoint, setCompareCheckpoint] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const checkpoints = state.checkpoints;
  const activeCheckpoint = checkpoints.find(item => item.id === state.activeCheckpointId);
  const activeBranch = state.branches.find(item => item.id === state.activeBranchId);
  const selectedCompareBranches = useMemo(
    () => compareCheckpoint ? compareBranches(state, compareCheckpoint, compareIds) : [],
    [state, compareCheckpoint, compareIds],
  );
  const compareCheckpointBranches = state.branches.filter(item => item.checkpointId === compareCheckpoint);
  const demo = !current || current.mode === "demo";

  function addAnchor() {
    const value = anchorDraft.trim();
    if (value && !anchors.some(item => item.toLocaleLowerCase() === value.toLocaleLowerCase())) setAnchors(items => [...items, value]);
    setAnchorDraft("");
  }
  function startDemo() {
    if (!anchors.length) return;
    const categories = Object.fromEntries(anchors.map(anchor => [anchor, "User interest"]));
    const seed: LabSeed = { anchors, categories, location: location.trim(), context: {
      ...(scenario.scenario ? { scenario: scenario.scenario } : {}),
      ...(scenario.scenarioCategory ? { scenarioCategory: scenario.scenarioCategory } : {}),
    }, mode: "demo", discoveries: [], feedback: {} };
    lab.start(seed);
  }
  function saveCheckpoint() {
    const name = window.prompt("Name this checkpoint", current?.selected ? `From ${current.selected.title}` : "A place to begin");
    if (name === null) return;
    lab.checkpoint(name);
  }
  function rename(kind: "branch" | "checkpoint", id: string, oldName: string) {
    const value = window.prompt(`Rename ${kind}`, oldName);
    if (value !== null) lab.rename(kind, id, value);
  }
  function removeBranch(id: string, name: string) {
    if (window.confirm(`Remove “${name}”? Its branch history will be deleted; its checkpoint and sibling branches will stay.`)) lab.remove(id);
  }
  function clearLab() {
    if (window.confirm("Clear all Discovery Lab checkpoints, branches, and favorites from this browser? Export first if you want a copy.")) lab.clear();
  }
  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) { lab.settings({ [key]: value } as Pick<Settings, K>); }
  function toggleCompare(id: string) {
    setCompareIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
  }
  function toggleExpanded(id: string) {
    setExpanded(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
  }
  function markFeedback(discovery: Discovery, action: "keep" | "reject") {
    const selectedReason = action === "reject" ? reason[discovery.id] || rejectReasons[0] : "Kept for this journey";
    lab.feedback(discovery.id, { action, reason: selectedReason });
  }
  function runNext(discovery: Discovery, branchId?: string) {
    if (branchId) lab.resume(branchId);
    void lab.next(discovery);
  }
  function runFork(discovery: Discovery, branchId?: string) {
    if (branchId) lab.resume(branchId);
    lab.fork(discovery);
  }
  const setComparisonCheckpoint = (id: string) => {
    setCompareCheckpoint(id);
    setCompareIds([]);
  };

  return <div className="discovery-lab" aria-labelledby="lab-title">
    <header className="lab-heading">
      <div>
        <span className="eyebrow">Open Door · Discovery Lab</span>
        <h1 id="lab-title">A few ways <em>forward.</em></h1>
        <p>Keep one discovery close. Save a place to return to, then open different doors from the same point.</p>
      </div>
      <div className="lab-heading-mark" aria-hidden="true"><span className="lab-door"><i /></span><span>FIELD<br />NOTES</span></div>
    </header>

    {demo && <div className="lab-mode-note" role="status">
      <span className="lab-mode-dot" aria-hidden="true" />
      <strong>{qlooConfigured ? "Demo discovery mode — authored sample data." : "Demo discovery mode — Qloo credentials pending."}</strong>
      <span>Illustrative results are not live cultural intelligence.</span>
    </div>}
    {current?.mode === "live" && <div className="lab-mode-note lab-mode-historical" role="status">
      <span className="lab-mode-dot" aria-hidden="true" />
      <strong>Historical live journey</strong>
      <span>Saved provenance is shown as recorded; it does not indicate a current connection. {!qlooConfigured && "Live requests are unavailable while Qloo credentials are pending."}</span>
    </div>}
    {loadError && <section className="lab-alert lab-alert-error" role="alert">
      <div><strong>Saved Lab data could not be read.</strong><p>{loadError} Export the original browser-local file or explicitly clear it to begin again.</p></div>
      <div className="lab-alert-actions"><button className="secondary-btn" type="button" onClick={lab.exportData}>Export saved data</button><button className="danger-btn" type="button" onClick={clearLab}>Clear Lab data</button></div>
    </section>}
    {storageWarning && <div className="lab-alert lab-alert-warn" role="status">{storageWarning}</div>}
    {error && <div className="lab-alert lab-alert-error" role="alert"><strong>That step did not complete.</strong><span>{error}</span></div>}
    {notices.map((item, index) => <div className="lab-alert lab-alert-warn" role="status" key={`${index}-${item}`}>{item}</div>)}
    {busy && <div className="lab-busy" role="status"><span className="lab-busy-mark" aria-hidden="true" /><div><strong>Looking through this door</strong><span>Your saved branches remain unchanged while this exploration runs.</span></div><button className="secondary-btn" type="button" onClick={lab.cancel}>Cancel exploration</button></div>}

    {!current && <section className="lab-start form-panel" aria-labelledby="start-title">
      <div className="lab-welcome-guide"><div>
        <div className="form-heading"><div><span className="eyebrow">Begin with what you love</span><h2 id="start-title">Set down a few anchors.</h2></div><span className="step-label">A new demo journey</span></div>
        <p className="lab-start-copy">A person, place, sound, story, or practice is enough. Your saved checkpoints and branches stay available below.</p>
      </div><MascotArt scene="coffee" /></div>
      <div className="field full"><label htmlFor="lab-anchor">Cultural interest</label><div className="anchor-input-row"><input id="lab-anchor" value={anchorDraft} onChange={event => setAnchorDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addAnchor(); } }} placeholder="For example, experimental jazz" /><button className="text-button" type="button" onClick={addAnchor}>Add anchor</button></div>
        {!!anchors.length && <div className="anchor-pills">{anchors.map(anchor => <span className="anchor-pill" key={anchor}>{anchor}<button type="button" aria-label={`Remove ${anchor}`} onClick={() => setAnchors(items => items.filter(item => item !== anchor))}>×</button></span>)}</div>}
      </div>
      <div className="field lab-start-location"><label htmlFor="lab-location">Place (optional)</label><input id="lab-location" value={location} onChange={event => setLocation(event.target.value)} placeholder="City, neighborhood, or leave blank" /></div>
      <ScenarioFields value={scenario} onChange={setScenario} disabled={!!loadError} />
      <div className="lab-start-footer"><span className="helper">This starts in Demo mode. No live request is made by this form.</span><button type="button" className="primary-btn" data-sound="start" onClick={startDemo} disabled={!anchors.length || !!loadError}>Start exploring <span aria-hidden="true">→</span></button></div>
    </section>}

    {current && <div className="lab-workspace">
      <section className="lab-current">
        <div className="lab-current-top">
          <div><span className="eyebrow">Your current page</span><h2>{activeBranch?.name || current.selected?.title || "The starting point"}</h2><p>{activeBranch ? `${STRATEGIES.find(item => item.id === activeBranch.strategy)?.purpose || "An independent path."}` : "A shared snapshot is ready. Save it as a checkpoint before choosing a direction."}</p></div>
          <div className="lab-current-actions">
            <button type="button" className="secondary-btn" onClick={saveCheckpoint}>Save checkpoint</button>
            <button type="button" className="secondary-btn" onClick={() => { if (window.confirm("Start a fresh exploration? Saved checkpoints and branches will remain available.")) lab.fresh(); }}>Fresh journey</button>
            {activeBranch && <button type="button" className="quiet-btn" onClick={() => rename("branch", activeBranch.id, activeBranch.name)}>Rename branch</button>}
          </div>
        </div>
        <div className="lab-anchor-ribbon"><span>Starting point</span><strong>{valuesText(current.originalAnchors)}</strong>{current.selected && <span className="lab-ribbon-selected">Selected · {current.selected.title}</span>}</div>
        {!activeBranch && <p className="lab-inline-hint">Working on a current unbranched snapshot: <strong>Save checkpoint then choose branch.</strong> This also preserves its settings.</p>}
        {activeBranch && <p className="lab-inline-hint">Branch started from <strong>{activeCheckpoint?.name || "a saved checkpoint"}</strong>. Branching from a saved checkpoint restores that checkpoint’s settings.</p>}
      </section>

      <section className="lab-settings" aria-labelledby="settings-title">
        <div className="module-heading"><div><span className="eyebrow">Your field conditions</span><h3 id="settings-title">Set the conditions</h3></div><p>These choices shape the next Explore action only. Changing them never regenerates results by itself.</p></div>
        <ScenarioFields value={current.settings} onChange={lab.settings} disabled={busy} />
        <div className="lab-settings-grid">
          <label className="field"><span>Adventure</span><select value={current.settings.adventure} onChange={event => updateSetting("adventure", event.target.value as Settings["adventure"])}>{optionSets.adventure.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
          <label className="field"><span>Time available</span><select value={current.settings.time} onChange={event => updateSetting("time", event.target.value as Settings["time"])}>{optionSets.time.map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="field"><span>Mood</span><select value={current.settings.mood} onChange={event => updateSetting("mood", event.target.value as Settings["mood"])}>{optionSets.mood.map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="field"><span>Domain</span><select value={current.settings.domain} onChange={event => updateSetting("domain", event.target.value as Settings["domain"])}>{optionSets.domain.map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="field"><span>Occasion</span><select value={current.settings.occasion} onChange={event => updateSetting("occasion", event.target.value as Settings["occasion"])}>{optionSets.occasion.map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="field"><span>Location</span><input value={current.settings.location} onChange={event => updateSetting("location", event.target.value)} placeholder="Optional" /></label>
          <label className="field"><span>Budget</span><input value={current.settings.budget} onChange={event => updateSetting("budget", event.target.value)} placeholder="Optional" /></label>
          <label className="field"><span>Movement or access</span><input value={current.settings.movement} onChange={event => updateSetting("movement", event.target.value)} placeholder="Optional" /></label>
          <label className="field"><span>Conditions</span><input value={current.settings.conditions} onChange={event => updateSetting("conditions", event.target.value)} placeholder="Optional" /></label>
          <label className="field"><span>Group interests</span><input value={current.settings.groupInterests} onChange={event => updateSetting("groupInterests", event.target.value)} placeholder="Optional" /></label>
        </div>
        {activeBranch && <div className="lab-explore-row"><span>Current path: <strong>{activeBranch.name}</strong></span><button type="button" className="primary-btn" onClick={() => void lab.explore()} disabled={busy}>Explore this path <span aria-hidden="true">→</span></button></div>}
      </section>

      <section className="lab-doors" aria-labelledby="directions-title">
        <div className="module-heading"><div><span className="eyebrow">Six ways through</span><h3 id="directions-title">Choose a direction</h3></div><p>Each door changes the purpose of the next exploration, not just its label.</p></div>
        {!checkpoints.length && <div className="lab-empty-inline"><strong>No checkpoint yet</strong><span>Save this snapshot to create independent directions from a shared starting point.</span></div>}
        <div className="lab-direction-layout">
          <div className="lab-door-list" role="list" aria-label="Discovery directions">
            {STRATEGIES.map((strategy, index) => {
              const DirectionIcon = strategyIcons[strategy.id];
              return <button type="button" key={strategy.id} data-strategy={strategy.id} className={`lab-direction ${selectedStrategy === strategy.id ? "is-selected" : ""}`} onClick={() => setSelectedStrategy(strategy.id)} aria-pressed={selectedStrategy === strategy.id} disabled={!checkpoints.length || busy}>
                <span className="lab-direction-num"><DirectionIcon size={18} aria-hidden="true" /><small>0{index + 1}</small></span><span className="lab-direction-copy"><strong>{strategy.name}</strong><small>{strategy.purpose}</small></span><span className="lab-direction-arrow" aria-hidden="true">↗</span>
              </button>;
            })}
          </div>
          <div className="lab-door-detail">
            <span className="eyebrow">Door {String(STRATEGIES.findIndex(item => item.id === selectedStrategy) + 1).padStart(2, "0")}</span>
            <h4>{STRATEGIES.find(item => item.id === selectedStrategy)?.name}</h4>
            <p>{strategyNotes[selectedStrategy]}</p>
            {selectedStrategy === "cross" && <label className="field"><span>Destination domain</span><select value={destination} onChange={event => { setDestination(event.target.value); updateSetting("domain", event.target.value as Settings["domain"]); }}>{DOMAINS.map(value => <option key={value}>{value}</option>)}</select></label>}
            {selectedStrategy === "people" && <p className="lab-follow-choice">Choose an occasion and add group interests in Field conditions above. The branch will carry both into its first exploration.</p>}
            {selectedStrategy === "real" && <p className="lab-follow-choice">Add location, available time, budget, and movement needs above. Leave anything private or unknown blank.</p>}
            {selectedStrategy === "wild" && <p className="lab-follow-choice">The provider's explanation and evidence stay visible with each result. No unsupported connection is added here.</p>}
            {!checkpoints.length ? <button className="primary-btn" type="button" onClick={saveCheckpoint}>Save checkpoint first</button> : <button className="primary-btn" type="button" onClick={() => void lab.branch(selectedStrategy, state.activeCheckpointId || undefined, { ...current.settings, adventure: STRATEGIES.find(strategy => strategy.id === selectedStrategy)!.adventure, ...(selectedStrategy === "cross" ? { domain: destination as Settings["domain"] } : {}) })} disabled={busy}>Open this door <span aria-hidden="true">→</span></button>}
            <small className="lab-branch-note">The saved snapshot stays unchanged. This new branch uses your edited conditions, starts at its direction’s default adventure level, and can be adjusted afterward.</small>
          </div>
        </div>
      </section>

      <section className="lab-results" aria-labelledby="results-title">
        <div className="module-heading"><div><span className="eyebrow">The discoveries</span><h3 id="results-title">What this path found</h3></div>{activeBranch && <span className="lab-result-count">{current.candidates.length} in this batch</span>}</div>
        {!activeBranch && <div className="lab-empty-inline"><strong>No branch is open</strong><span>Choose one of the six directions after saving a checkpoint.</span></div>}
        {activeBranch && current.candidates.length === 0 && <div className="lab-empty-inline"><strong>No discoveries in this batch</strong><span>Adjust your field conditions or try Explore this path again. Your history is still saved.</span><button type="button" className="secondary-btn" onClick={() => void lab.explore()} disabled={busy}>Explore again</button></div>}
        {activeBranch && current.candidates.length > 0 && <div className="lab-discovery-list">{current.candidates.map((discovery, index) => {
          const feedback = current.feedback[discovery.id];
          const detailOpen = expanded.includes(discovery.id);
          return <article className="lab-discovery" key={discovery.id}>
            <div className="lab-discovery-number">0{index + 1}</div><div className="lab-discovery-content">
              <div className="lab-discovery-meta"><span>{discovery.domain}</span><span>{discovery.mode === "demo" ? "Illustrative demo" : "Historical live record"}</span></div>
              <h4>{discovery.title}</h4><p>{discovery.description}</p>
              <div className="lab-connection"><strong>Connection</strong><p>{discovery.connection}</p></div>
              {discovery.plan?.length ? <ol className="lab-plan">{discovery.plan.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{item}</li>)}</ol> : null}
              {detailOpen && <div className="lab-more-details">
                <div><strong>Original connection</strong><p>{discovery.originalConnection || "Not provided."}</p></div>
                <div><strong>Evidence</strong><p>{discovery.evidence || "No evidence supplied for this discovery."}</p></div>
                <div><strong>Source</strong><p>{discovery.source || "Source not recorded."}</p></div>
                <div><strong>Selection</strong><p>{discovery.selection || "Selection details not recorded."}</p></div>
                {discovery.constraints.length > 0 && <div className="lab-compat"><strong>Constraint compatibility</strong>{discovery.constraints.map((constraint, ci) => <p key={`${constraint.constraint}-${ci}`}><b>{constraint.constraint} · {constraint.value}</b><span>{constraint.status} — {constraint.detail}</span></p>)}</div>}
              </div>}
              <div className="lab-feedback-row"><span>Does this belong in your field notes?</span><button type="button" className={`feedback-chip ${feedback?.action === "keep" ? "selected" : ""}`} onClick={() => markFeedback(discovery, "keep")} aria-pressed={feedback?.action === "keep"}>Keep</button>
                <label className="visually-hidden" htmlFor={`reason-${discovery.id}`}>Reason this is not for me: {discovery.title}</label><select id={`reason-${discovery.id}`} value={reason[discovery.id] || rejectReasons[0]} onChange={event => setReason(items => ({ ...items, [discovery.id]: event.target.value }))}>{rejectReasons.map(item => <option key={item}>{item}</option>)}</select>
                <button type="button" className={`feedback-chip ${feedback?.action === "reject" ? "selected" : ""}`} onClick={() => markFeedback(discovery, "reject")} aria-pressed={feedback?.action === "reject"}>Not for me</button>
                {feedback && <small className="lab-feedback-recorded">{feedback.action === "keep" ? "Kept" : `Noted · ${feedback.reason}`}</small>}
              </div>
              <div className="lab-discovery-actions"><button className="text-button" type="button" onClick={() => toggleExpanded(discovery.id)} aria-expanded={detailOpen}>{detailOpen ? "Show less" : "Tell me more"}</button><button className="secondary-btn" type="button" onClick={() => runFork(discovery)} disabled={busy}>Branch from here</button><button className="primary-btn" type="button" onClick={() => runNext(discovery)} disabled={busy}>Open the next door <span aria-hidden="true">→</span></button></div>
            </div>
          </article>;
        })}</div>}
        {activeBranch && current.history.length > 0 && <section className="lab-history-revisit" aria-labelledby="revisit-title">
          <div className="lab-history-heading"><span className="eyebrow">Earlier pages</span><h4 id="revisit-title">Return to a past discovery</h4><p>Continue this branch from an earlier result, or start a separate branch from it.</p></div>
          <div className="lab-history-cards">{current.history.flatMap((step, stepIndex) => step.discoveries.map(discovery => ({ step, stepIndex, discovery }))).map(({ step, stepIndex, discovery }) => <article className="lab-history-card" key={`${step.id}-${discovery.id}`}>
            <span className="lab-map-kind">Step {stepIndex + 1} · {STRATEGIES.find(item => item.id === step.strategy)?.name}</span>
            <h5>{discovery.title}</h5><p>{discovery.domain} · {discovery.connection || discovery.description}</p>
            <div><button type="button" className="secondary-btn" onClick={() => runFork(discovery)} disabled={busy}>Branch from here</button><button type="button" className="text-button" onClick={() => runNext(discovery)} disabled={busy}>Open next door</button></div>
          </article>)}</div>
        </section>}
      </section>

    </div>}

      <section className="lab-map" aria-labelledby="map-title">
        <div className="module-heading"><div><span className="eyebrow">Your field map</span><h3 id="map-title">Checkpoints & paths</h3></div><p>Each branch keeps its own history. Restore a checkpoint to return to the shared starting place.</p></div>
        {checkpoints.length === 0 && <div className="lab-empty-inline"><strong>No saved checkpoints</strong><span>Save a snapshot anywhere there is a current journey. Your map will grow from there.</span></div>}
        <div className="lab-checkpoint-list">{checkpoints.map(checkpoint => {
          const children = state.branches.filter(branch => branch.checkpointId === checkpoint.id);
          return <article className={`lab-checkpoint ${checkpoint.id === state.activeCheckpointId ? "is-active" : ""}`} key={checkpoint.id}>
            <div className="lab-checkpoint-stem" aria-hidden="true" />
            <div className="lab-checkpoint-head"><span className="lab-checkpoint-symbol" aria-hidden="true" /><div><span className="lab-map-kind">Checkpoint · {dateLabel(checkpoint.createdAt)}</span><h4>{checkpoint.name}</h4><p>{valuesText(checkpoint.snapshot.anchors)}{checkpoint.parentBranchId ? " · continued from a branch" : ""}</p></div>
              <div className="lab-map-actions"><button className="secondary-btn" type="button" onClick={() => lab.restore(checkpoint.id)}>Return here</button><button className="quiet-btn" type="button" onClick={() => rename("checkpoint", checkpoint.id, checkpoint.name)}>Rename</button></div>
            </div>
            <div className="lab-branch-children">{children.length === 0 ? <p className="lab-no-branches">No paths have opened from this checkpoint.</p> : children.map(branch => {
              const isFavorite = state.favorites[checkpoint.id] === branch.id;
              return <div className={`lab-branch-row ${branch.id === state.activeBranchId ? "is-active" : ""}`} key={branch.id}>
                <span className="lab-branch-line" aria-hidden="true" /><span className="lab-branch-door" aria-hidden="true" />
                <div className="lab-branch-copy"><span className="lab-map-kind">{STRATEGIES.find(item => item.id === branch.strategy)?.name} · {branch.snapshot.history.length} {branch.snapshot.history.length === 1 ? "exploration" : "explorations"}</span><strong>{branch.name}</strong><small>{branch.snapshot.candidates.length ? branch.snapshot.candidates.map(item => item.title).join(" · ") : "No current results"}{branch.updatedAt ? ` · updated ${dateLabel(branch.updatedAt)}` : ""}</small></div>
                <div className="lab-map-actions"><button className="secondary-btn" type="button" onClick={() => lab.resume(branch.id)}>Resume</button><button className={`quiet-btn ${isFavorite ? "is-favorite" : ""}`} type="button" aria-pressed={isFavorite} onClick={() => lab.favorite(branch.id)}>{isFavorite ? "Favorite" : "Mark favorite"}</button><button className="quiet-btn" type="button" onClick={() => rename("branch", branch.id, branch.name)}>Rename</button><button className="quiet-btn lab-remove" type="button" onClick={() => removeBranch(branch.id, branch.name)}>Remove</button></div>
                {branch.snapshot.history.length > 0 && <details className="lab-branch-history"><summary>Branch history · {branch.snapshot.history.length} {branch.snapshot.history.length === 1 ? "step" : "steps"}</summary><ol>{branch.snapshot.history.map(step => <li key={step.id}><span>{STRATEGIES.find(item => item.id === step.strategy)?.name} · {dateLabel(step.createdAt)}</span><strong>{valuesText(step.anchors)}</strong><small>{step.discoveries.length ? step.discoveries.map(item => `${item.title} (${item.domain})`).join(" · ") : "No discoveries returned in this batch."}</small></li>)}</ol></details>}
              </div>;
            })}</div>
          </article>;
        })}</div>
      </section>
    <section className="lab-compare" aria-labelledby="compare-title">
      <div className="module-heading"><div><span className="eyebrow">Look across the paths</span><h3 id="compare-title">Compare branches</h3></div><p>Only siblings from one checkpoint can be compared. Select at least two to see their real discoveries side by side.</p></div>
      {checkpoints.length > 0 && <label className="field lab-compare-select"><span>Shared checkpoint</span><select value={compareCheckpoint} onChange={event => setComparisonCheckpoint(event.target.value)}><option value="">Choose a checkpoint</option>{checkpoints.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {!checkpoints.length && <div className="lab-empty-inline"><strong>No checkpoint to compare</strong><span>Save a checkpoint and create sibling branches to begin.</span></div>}
      {compareCheckpoint && compareCheckpointBranches.length < 2 && <div className="lab-empty-inline"><strong>Comparison needs two siblings</strong><span>This checkpoint has {compareCheckpointBranches.length} branch{compareCheckpointBranches.length === 1 ? "" : "es"}. Open another direction from the same checkpoint.</span></div>}
      {compareCheckpoint && compareCheckpointBranches.length >= 2 && <div className="lab-compare-body">
        <fieldset className="lab-compare-picker"><legend>Choose at least two sibling branches</legend>{compareCheckpointBranches.map(branch => <label key={branch.id}><input type="checkbox" checked={compareIds.includes(branch.id)} onChange={() => toggleCompare(branch.id)} /><span><strong>{branch.name}</strong><small>{STRATEGIES.find(item => item.id === branch.strategy)?.name}</small></span></label>)}</fieldset>
        {selectedCompareBranches.length < 2 ? <p className="lab-compare-prompt" role="status">Select {2 - selectedCompareBranches.length} more branch{2 - selectedCompareBranches.length === 1 ? "" : "es"} to compare.</p> : <div className="lab-compare-columns">{selectedCompareBranches.map(branch => {
          const branchDiscoveries = allDiscoveries(branch);
          const favorite = state.favorites[branch.checkpointId] === branch.id;
          return <article className="lab-compare-branch" key={branch.id}><header><div><span className="lab-map-kind">{STRATEGIES.find(item => item.id === branch.strategy)?.name}</span><h4>{branch.name}</h4><p>From {checkpoints.find(item => item.id === branch.checkpointId)?.name}</p></div><button type="button" className={`quiet-btn ${favorite ? "is-favorite" : ""}`} aria-pressed={favorite} onClick={() => lab.favorite(branch.id)}>{favorite ? "Unfavorite branch" : "Favorite branch"}</button></header>
            <div className="lab-compare-controls"><button className="secondary-btn" type="button" onClick={() => lab.resume(branch.id)}>Resume this branch</button></div>
            {!branchDiscoveries.length && <p className="lab-compare-empty">This branch has no discoveries to compare yet.</p>}
            {branchDiscoveries.map(discovery => {
              const fb = branch.snapshot.feedback[discovery.id];
              return <div className="lab-compare-discovery" key={discovery.id}><span className="lab-domain-tag">{discovery.domain}</span><h5>{discovery.title}</h5><p>{discovery.description}</p><dl><div><dt>Connection</dt><dd>{discovery.connection || "Not provided."}</dd></div><div><dt>Original connection</dt><dd>{discovery.originalConnection || "Not provided."}</dd></div><div><dt>Evidence</dt><dd>{discovery.evidence || "No evidence supplied."}</dd></div><div><dt>Source & selection</dt><dd>{discovery.source || "Not recorded."} · {discovery.selection || "Not recorded."}</dd></div><div><dt>Provenance</dt><dd>{discovery.mode === "demo" ? "Illustrative demo; not live." : "Historical live record; current connection not implied."}</dd></div>{discovery.constraints.length > 0 && <div><dt>Constraint compatibility</dt><dd>{discovery.constraints.map(item => `${item.constraint}: ${item.value} · ${item.status} — ${item.detail}`).join(" / ")}</dd></div>}<div><dt>Branch feedback</dt><dd>{fb ? `${fb.action === "keep" ? "Kept" : "Not for me"} · ${fb.reason}` : "No feedback recorded"}</dd></div></dl><div className="lab-compare-discovery-actions"><button type="button" className="text-button" onClick={() => runFork(discovery, branch.id)}>Fork from this discovery</button><button type="button" className="text-button" onClick={() => runNext(discovery, branch.id)}>Continue from this discovery</button></div></div>;
            })}
          </article>;
        })}</div>}
      </div>}
    </section>

    <footer className="lab-footer"><span>Open Door keeps this Lab in browser storage.</span><div><button className="quiet-btn" type="button" onClick={lab.exportData}>Export Lab data</button><button className="quiet-btn lab-remove" type="button" onClick={clearLab}>Clear all Lab data</button></div></footer>
  </div>;
}
