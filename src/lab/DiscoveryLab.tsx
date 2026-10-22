import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, GitBranch, MoveUpRight, Users, Sparkles, Map as MapIcon } from "lucide-react";
import { MascotArt } from "../MascotArt";
import { CompanyMascot } from "../company/CompanyMascot";
import QlooConnectionPanel from "../QlooConnectionPanel";
import type { AgentStatus } from "../agentApi";
import { allDiscoveries, compareBranches } from "./engine.ts";
import { DOMAINS, STRATEGIES, type Discovery, type LabSeed, type Settings, type Strategy } from "./model.ts";
import { SCENARIOS } from "./scenarios.ts";
import type { LabController } from "./useDiscoveryLab.ts";
import "./lab.css";
import { ScenarioFields } from "./ScenarioFields.tsx";
import type { CompanyProfile } from "../company/profiles";
import type { CompanyDraftChange } from "../company/experienceContext";

type QlooConnectionSource = "shared" | "personal";
type Connection = {
  status: AgentStatus | null;
  mode: "demo" | "live";
  source: QlooConnectionSource;
  disabled: boolean;
  onSelect: (mode: "demo" | "live", source: QlooConnectionSource) => void;
};
type Props = { lab: LabController; qlooConfigured: boolean; connection: Connection; companyProfile?: CompanyProfile; onCompanyContextChange?: (draft: CompanyDraftChange) => void };

const strategyNotes: Record<Strategy, string> = {
  stay: "Keep close to your starting taste; look for a neighboring expression inside the same world.",
  thread: "Carry one creative thread into a neighboring domain and follow how it changes form.",
  cross: "Choose a destination domain before opening this door. Your starting point stays visible.",
  people: "Set the occasion and shared interests first; use them to shape the next discovery.",
  wild: "Invite an unusual connection, with its explanation kept alongside the result.",
  real: "Shape a practical plan using only the time, place, budget, and access details you provide.",
};
const strategyIcons = { stay: AudioLines, thread: GitBranch, cross: MoveUpRight, people: Users, wild: Sparkles, real: MapIcon };

const optionSets = {
  adventure: ["familiar", "adjacent", "unexpected"],
  time: ["Quick discovery", "Afternoon", "Full day", "Weekend"],
  mood: ["Creative", "Cozy", "Social", "Adventurous", "Unusual"],
  domain: ["Any", ...DOMAINS],
  occasion: ["Solo outing", "Date", "Family activity", "Social gathering"],
} as const;
const anchorCategoryOptions = ["Other", ...DOMAINS] as const;
const rejectReasons = ["Not my taste", "Too far from my interests", "Not practical right now", "I have already explored this"];

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved journey" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function valuesText(items: string[]) { return items.length ? items.join(" · ") : "No anchors recorded"; }
function discoveryIdentity(discovery: Discovery) {
  if (discovery.entityId) return `entity:${discovery.entityId}`;
  const domain = discovery.domain.normalize("NFKC").trim().toLocaleLowerCase();
  const title = discovery.title.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return `title:${domain}|${title}`;
}

export default function DiscoveryLab({ lab, connection, companyProfile, onCompanyContextChange }: Props) {
  const { state, busy, error, loadError, storageWarning, notices } = lab;
  const current = state.current;
  const [anchors, setAnchors] = useState<string[]>(() => companyProfile ? [...companyProfile.anchors] : []);
  const [anchorCategories, setAnchorCategories] = useState<Record<string, string>>(() => companyProfile ? Object.fromEntries(Object.entries(companyProfile.categories).map(([anchor, category]) => [anchor, category === "Design" ? "Architecture" : category])) : {});
  const [anchorDraft, setAnchorDraft] = useState("");
  const [location, setLocation] = useState<string>(companyProfile?.location || "");
  const [scenario, setScenario] = useState<Pick<Settings, "scenario" | "scenarioCategory">>(() => companyProfile ? { scenario: companyProfile.context.scenario, scenarioCategory: companyProfile.context.scenarioCategory } : {});
  useEffect(() => {
    if (!onCompanyContextChange) return;
    const categories: CompanyDraftChange["categories"] = {};
    for (const anchor of anchors) {
      const category = anchorCategories[anchor] || "Other";
      categories[anchor] = (category === "Architecture" ? "Design" : category) as CompanyDraftChange["categories"][string];
    }
    onCompanyContextChange({
      location, anchors, categories,
      scenario: scenario.scenario || "", scenarioCategory: scenario.scenarioCategory || "custom",
    });
  }, [location, anchors, anchorCategories, scenario, onCompanyContextChange]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>("stay");
  const [destination, setDestination] = useState<string>("Art");
  const [compareCheckpoint, setCompareCheckpoint] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareTouched, setCompareTouched] = useState(false);
  const [compareContextCheckpoint, setCompareContextCheckpoint] = useState(state.activeCheckpointId);
  const [branchNameDrafts, setBranchNameDrafts] = useState<Record<string, string>>({});
  const lastActiveCheckpointId = useRef(state.activeCheckpointId);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const resultsHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const pendingResumeRevealRef = useRef(false);
  const checkpoints = state.checkpoints;
  const activeCheckpoint = checkpoints.find(item => item.id === state.activeCheckpointId);
  const activeBranch = state.branches.find(item => item.id === state.activeBranchId);
  const automaticCompareCheckpoint = activeCheckpoint?.id
    || checkpoints.find(item => state.branches.filter(branch => branch.checkpointId === item.id).length >= 2)?.id
    || checkpoints[0]?.id || "";
  const comparisonContextIsCurrent = compareContextCheckpoint === state.activeCheckpointId;
  const effectiveCompareCheckpoint = comparisonContextIsCurrent && compareCheckpoint ? compareCheckpoint : automaticCompareCheckpoint;
  const compareCheckpointBranches = state.branches.filter(item => item.checkpointId === effectiveCompareCheckpoint);
  const effectiveCompareIds = compareTouched && comparisonContextIsCurrent
    ? compareIds
    : compareCheckpointBranches.slice(0, 2).map(branch => branch.id);
  const selectedCompareBranches = useMemo(
    () => effectiveCompareCheckpoint ? compareBranches(state, effectiveCompareCheckpoint, effectiveCompareIds) : [],
    [state, effectiveCompareCheckpoint, effectiveCompareIds],
  );
  const compareDiscoveryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    selectedCompareBranches.forEach(branch => {
      const seen = new Set<string>();
      allDiscoveries(branch, checkpoints.find(item => item.id === branch.checkpointId)).forEach(discovery => {
        const key = discoveryIdentity(discovery);
        if (!seen.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
        seen.add(key);
      });
    });
    return counts;
  }, [selectedCompareBranches]);

  useEffect(() => {
    if (lastActiveCheckpointId.current === state.activeCheckpointId) return;
    lastActiveCheckpointId.current = state.activeCheckpointId;
    setCompareCheckpoint("");
    setCompareIds([]);
    setCompareTouched(false);
    setCompareContextCheckpoint(state.activeCheckpointId);
  }, [state.activeCheckpointId]);

  useEffect(() => {
    if (!pendingResumeRevealRef.current || !state.current) return;
    pendingResumeRevealRef.current = false;
    revealResults();
  }, [state.current, state.activeBranchId]);

  function revealResults() {
    const heading = resultsHeadingRef.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    heading.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }
  async function afterOperation(operation: () => Promise<unknown>) {
    try { await operation(); }
    finally { revealResults(); }
  }
  function resumeToResults(branchId: string) {
    pendingResumeRevealRef.current = true;
    lab.resume(branchId);
  }
  function openDirection(checkpointId = state.activeCheckpointId || undefined) {
    if (!current) return Promise.resolve();
    const strategy = STRATEGIES.find(item => item.id === selectedStrategy)!;
    return afterOperation(() => lab.branch(strategy.id, checkpointId, {
      ...current.settings,
      adventure: strategy.adventure,
      ...(selectedStrategy === "cross" ? { domain: destination as Settings["domain"] } : {}),
    }));
  }
  function retryCurrentPath() {
    if (activeBranch) return afterOperation(() => lab.explore());
    if (current) return openDirection();
    return startExploring(connection.mode);
  }

  function addAnchor() {
    const value = anchorDraft.trim();
    if (value && !anchors.some(item => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setAnchors(items => [...items, value]);
      setAnchorCategories(items => ({ ...items, [value]: "Other" }));
    }
    setAnchorDraft("");
  }
  function makeSeed(mode: "demo" | "live"): LabSeed {
    const categories = Object.fromEntries(anchors.map(anchor => [anchor, anchorCategories[anchor] || "Other"]));
    return { anchors, categories, location: location.trim(), context: {
      ...(companyProfile ? { ...companyProfile.context, groupInterests: anchors.join(", ") } : {}),
      ...(scenario.scenario ? { scenario: scenario.scenario } : {}),
      ...(scenario.scenarioCategory ? { scenarioCategory: scenario.scenarioCategory } : {}),
    }, mode, discoveries: [], feedback: {} };
  }
  function startExploring(mode: "demo" | "live" = connection.mode) {
    if (!anchors.length) return;
    void afterOperation(() => lab.startAndExplore(makeSeed(mode), selectedStrategy));
  }
  function startFromOriginalInterests() {
    if (!current?.originalAnchors.length) return;
    const seed: LabSeed = {
      anchors: [...current.originalAnchors],
      categories: { ...current.categories },
      location: current.settings.location,
      context: { ...current.originalContext },
      mode: connection.mode,
      discoveries: [],
      feedback: {},
    };
    void afterOperation(() => lab.startAndExplore(seed, selectedStrategy));
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
    const selected = compareTouched && comparisonContextIsCurrent
      ? compareIds
      : compareCheckpointBranches.slice(0, 2).map(branch => branch.id);
    setCompareTouched(true);
    setCompareIds(selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id]);
  }
  function saveBranchName(id: string, fallback: string) {
    const name = (branchNameDrafts[id] ?? fallback).trim();
    if (name && name !== fallback) lab.rename("branch", id, name);
    setBranchNameDrafts(items => { const next = { ...items }; delete next[id]; return next; });
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
    return afterOperation(() => lab.next(discovery));
  }
  async function runFork(discovery: Discovery, branchId?: string) {
    if (branchId) lab.resume(branchId);
    await afterOperation(() => lab.fork(discovery));
  }
  const setComparisonCheckpoint = (id: string) => {
    setCompareCheckpoint(id);
    setCompareIds([]);
    setCompareTouched(false);
    setCompareContextCheckpoint(state.activeCheckpointId);
  };

  return <div className="discovery-lab" aria-labelledby="lab-title">
    <header className="lab-heading">
      <div>
        <span className="eyebrow">Open Door · Discovery Lab{companyProfile ? " · your occasion" : ""}</span>
        <h1 id="lab-title">{companyProfile ? companyProfile.labTitle : <>A few ways <em>forward.</em></>}</h1>
        <p>{companyProfile?.labCopy || "Keep one discovery close. Save a place to return to, then open different doors from the same point."}</p>
      </div>
      <div className="lab-heading-mark" aria-hidden="true"><span className="lab-door"><i /></span><span>FIELD<br />NOTES</span></div>
    </header>

    <QlooConnectionPanel status={connection.status} mode={connection.mode} source={connection.source} disabled={connection.disabled || busy} onSelect={connection.onSelect} />
    {current && <div className={`lab-mode-note ${current.mode === "live" ? "lab-mode-historical" : ""}`} role="status">
      <span className="lab-mode-dot" aria-hidden="true" />
      <strong>{current.mode === "demo" ? "Prepared examples · authored demo content." : "Qloo discoveries · saved in this browser."}</strong>
      <span>{current.mode === "demo" ? "It stays separate from Qloo evidence." : "Saved provenance is shown as recorded, not as a claim about your current connection."}</span>
    </div>}
    {current && current.mode !== connection.mode && <section className="lab-source-switch-note" role="status">
      <div><span className="eyebrow">Keep this path intact</span><strong>This saved path uses {current.mode === "demo" ? "prepared examples" : "live Qloo results"}; your selected source is {connection.mode === "demo" ? "prepared examples" : "live Qloo"}.</strong><p>Starting anew uses the original interests and selected source. Existing checkpoints and branches remain unchanged.</p></div>
      <button type="button" className="primary-btn" onClick={startFromOriginalInterests} disabled={busy || !!loadError || connection.disabled || !current.originalAnchors.length}>Start new from original interests <span aria-hidden="true">→</span></button>
    </section>}
    {loadError && <section className="lab-alert lab-alert-error" role="alert">
      <div><strong>Saved Lab data could not be read.</strong><p>{loadError} Export the original browser-local file or explicitly clear it to begin again.</p></div>
      <div className="lab-alert-actions"><button className="secondary-btn" type="button" onClick={lab.exportData}>Export saved data</button><button className="danger-btn" type="button" onClick={clearLab}>Clear Lab data</button></div>
    </section>}
    {storageWarning && <div className="lab-alert lab-alert-warn" role="status">{storageWarning}</div>}
    {error && !current && <div className="lab-alert lab-alert-error" role="alert"><strong>That step did not complete.</strong><span>{error}</span></div>}
    {notices.map((item, index) => <div className="lab-alert lab-alert-warn" role="status" key={`${index}-${item}`}>{item}</div>)}
    {busy && !current && <div className="lab-busy" role="status" aria-live="polite"><span className="lab-busy-mark" aria-hidden="true" /><div><strong>Opening this path</strong><span>Your saved history stays available while this exploration runs.</span></div><button className="secondary-btn" type="button" onClick={lab.cancel}>Cancel exploration</button></div>}
    {!!error && !busy && !current && <div className="lab-retry-note" role="status"><span>Nothing in your saved map was changed.</span><button type="button" className="secondary-btn" onClick={() => startExploring(connection.mode)}>Try again</button></div>}

    {!current && <section className="lab-start form-panel" aria-labelledby="start-title">
      <div className="lab-welcome-guide"><div>
        <div className="form-heading"><div><span className="eyebrow">Begin with what you love</span><h2 id="start-title">Set down a few anchors.</h2></div><span className="step-label">{connection.mode === "demo" ? "Prepared examples" : "Live Qloo"}</span></div>
        <p className="lab-start-copy">A person, place, sound, story, or practice is enough. Your saved checkpoints and branches stay available below.</p>
      </div>{companyProfile
        ? <CompanyMascot companyType={companyProfile.id} />
        : <MascotArt scene="coffee" />}</div>
      <div className="field full"><label htmlFor="lab-anchor">Cultural interest</label><div className="anchor-input-row"><input id="lab-anchor" value={anchorDraft} onChange={event => setAnchorDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addAnchor(); } }} placeholder="For example, experimental jazz" /><button className="text-button" type="button" onClick={addAnchor}>Add anchor</button></div>
        <p className="lab-category-help">Choose a category for each interest. New interests start as Other; no category is inferred from your words.</p>
        {!!anchors.length && <div className="lab-anchor-list">{anchors.map((anchor, index) => <div className="lab-anchor-edit" key={anchor}>
          <span className="lab-anchor-index">0{index + 1}</span><strong>{anchor}</strong>
          <label><span className="visually-hidden">Category for {anchor}</span><select value={anchorCategories[anchor] || "Other"} onChange={event => setAnchorCategories(items => ({ ...items, [anchor]: event.target.value }))}>{anchorCategoryOptions.map(category => <option key={category}>{category}</option>)}</select></label>
          <button type="button" className="lab-anchor-remove" aria-label={`Remove ${anchor}`} onClick={() => { setAnchors(items => items.filter(item => item !== anchor)); setAnchorCategories(items => { const next = { ...items }; delete next[anchor]; return next; }); }}>Remove</button>
        </div>)}</div>}
      </div>
      <div className="field lab-start-location"><label htmlFor="lab-location">Place (optional)</label><input id="lab-location" value={location} onChange={event => setLocation(event.target.value)} placeholder="City, neighborhood, or leave blank" /></div>
      <ScenarioFields value={scenario} onChange={setScenario} disabled={!!loadError} />
      <label className="field lab-start-strategy"><span>First direction</span><select value={selectedStrategy} onChange={event => setSelectedStrategy(event.target.value as Strategy)}>{STRATEGIES.map(item => <option value={item.id} key={item.id}>{item.name} — {item.purpose}</option>)}</select></label>
      <div className="lab-start-footer"><span className="helper">{connection.mode === "demo" ? "Prepared examples are authored, not live Qloo evidence." : "Your first path will use the selected Qloo connection."} A checkpoint is saved as this first path opens.</span><button type="button" className="primary-btn" data-sound="start" onClick={() => startExploring()} disabled={!anchors.length || !!loadError || busy || connection.disabled}>Start exploring <span aria-hidden="true">→</span></button></div>
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
        {!activeBranch && <p className="lab-inline-hint">Working from an unbranched snapshot. <strong>Opening a direction saves this as a checkpoint automatically</strong> and carries these settings into the new path.</p>}
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
        {activeBranch && <div className="lab-explore-row"><span>Current path: <strong>{activeBranch.name}</strong></span><button type="button" className="primary-btn" onClick={() => void afterOperation(() => lab.explore())} disabled={busy}>Explore this path <span aria-hidden="true">→</span></button></div>}
      </section>

      <section className="lab-doors" aria-labelledby="directions-title">
        <div className="module-heading"><div><span className="eyebrow">Six ways through</span><h3 id="directions-title">Choose a direction</h3></div><p>Each door changes the purpose of the next exploration, not just its label.</p></div>
        {!checkpoints.length && <div className="lab-empty-inline"><strong>Your first checkpoint is ready to be made</strong><span>Choose any door; opening it will save this snapshot automatically.</span></div>}
        <div className="lab-direction-layout">
          <div className="lab-door-list" role="list" aria-label="Discovery directions">
            {STRATEGIES.map((strategy, index) => {
              const DirectionIcon = strategyIcons[strategy.id];
              return <button type="button" key={strategy.id} data-strategy={strategy.id} className={`lab-direction ${selectedStrategy === strategy.id ? "is-selected" : ""}`} onClick={() => setSelectedStrategy(strategy.id)} aria-pressed={selectedStrategy === strategy.id} disabled={busy}>
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
            <button className="primary-btn" type="button" onClick={() => void openDirection()} disabled={busy}>Open this door <span aria-hidden="true">→</span></button>
            <small className="lab-branch-note">The saved snapshot stays unchanged. This new branch uses your edited conditions, starts at its direction’s default adventure level, and can be adjusted afterward.</small>
          </div>
        </div>
      </section>

      <section className="lab-results" aria-labelledby="results-title">
        <div className="module-heading"><div><span className="eyebrow">The discoveries</span><h3 id="results-title" ref={resultsHeadingRef} tabIndex={-1}>What this path found</h3></div>{activeBranch && <span className="lab-result-count">{current.candidates.length} in this batch</span>}</div>
        {busy && <div className="lab-results-request lab-results-progress" role="status" aria-live="polite"><span className="lab-busy-mark" aria-hidden="true" /><div><strong>Opening this path</strong><span>Your saved history stays available while this exploration runs.</span></div><button className="secondary-btn" type="button" onClick={lab.cancel}>Cancel exploration</button></div>}
        {error && !busy && <div className="lab-results-request lab-results-error" role="alert"><div><strong>That step did not complete.</strong><p>{error}</p><small>Your checkpoint and other branches remain available.</small></div><button className="secondary-btn" type="button" onClick={() => void retryCurrentPath()}>Try again</button></div>}
        {!activeBranch && <div className="lab-empty-inline"><strong>No branch is open</strong><span>Choose one of the six directions; the first one automatically saves this snapshot as a checkpoint.</span></div>}
        {activeBranch && current.candidates.length === 0 && <div className="lab-empty-inline"><strong>{error ? "This path has no results from the failed request" : "No discoveries in this batch"}</strong><span>Adjust your field conditions or try this path again. Its saved history remains intact.</span>{!error && <button type="button" className="secondary-btn" onClick={() => void afterOperation(() => lab.explore())} disabled={busy}>Explore again</button>}</div>}
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
                {discovery.constraints.length > 0 && <div className="lab-compat"><strong>Practical limits · unverified</strong>{discovery.constraints.map((constraint, ci) => <p key={`${constraint.constraint}-${ci}`}><b>{constraint.constraint} · {constraint.value}</b><span>{constraint.status} — {constraint.detail}</span></p>)}</div>}
              </div>}
              <div className="lab-feedback-row"><span>Does this belong in your field notes?</span><button type="button" className={`feedback-chip ${feedback?.action === "keep" ? "selected" : ""}`} onClick={() => markFeedback(discovery, "keep")} aria-pressed={feedback?.action === "keep"}>Keep</button>
                <label className="visually-hidden" htmlFor={`reason-${discovery.id}`}>Reason this is not for me: {discovery.title}</label><select id={`reason-${discovery.id}`} value={reason[discovery.id] || rejectReasons[0]} onChange={event => setReason(items => ({ ...items, [discovery.id]: event.target.value }))}>{rejectReasons.map(item => <option key={item}>{item}</option>)}</select>
                <button type="button" className={`feedback-chip ${feedback?.action === "reject" ? "selected" : ""}`} onClick={() => markFeedback(discovery, "reject")} aria-pressed={feedback?.action === "reject"}>Not for me</button>
                {feedback && <small className="lab-feedback-recorded">{feedback.action === "keep" ? "Kept" : `Noted · ${feedback.reason}`}</small>}
              </div>
              <div className="lab-discovery-actions"><button className="text-button" type="button" onClick={() => toggleExpanded(discovery.id)} aria-expanded={detailOpen}>{detailOpen ? "Show less" : "Tell me more"}</button><button className="secondary-btn" type="button" onClick={() => void runFork(discovery)} disabled={busy}>Branch from here</button><button className="primary-btn" type="button" onClick={() => runNext(discovery)} disabled={busy}>Open the next door <span aria-hidden="true">→</span></button></div>
            </div>
          </article>;
        })}</div>}
        {activeBranch && current.history.length > 0 && <section className="lab-history-revisit" aria-labelledby="revisit-title">
          <div className="lab-history-heading"><span className="eyebrow">Earlier pages</span><h4 id="revisit-title">Return to a past discovery</h4><p>Continue this branch from an earlier result, or start a separate branch from it.</p></div>
          <div className="lab-history-cards">{current.history.flatMap((step, stepIndex) => step.discoveries.map(discovery => ({ step, stepIndex, discovery }))).map(({ step, stepIndex, discovery }) => <article className="lab-history-card" key={`${step.id}-${discovery.id}`}>
            <span className="lab-map-kind">Step {stepIndex + 1} · {STRATEGIES.find(item => item.id === step.strategy)?.name}</span>
            <h5>{discovery.title}</h5><p>{discovery.domain} · {discovery.connection || discovery.description}</p>
            <div><button type="button" className="secondary-btn" onClick={() => void runFork(discovery)} disabled={busy}>Branch from here</button><button type="button" className="text-button" onClick={() => runNext(discovery)} disabled={busy}>Open next door</button></div>
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
                <div className="lab-branch-copy"><span className="lab-map-kind">{STRATEGIES.find(item => item.id === branch.strategy)?.name} · {branch.snapshot.mode === "demo" ? "Prepared examples" : "Historical live Qloo"} · {branch.snapshot.history.length} {branch.snapshot.history.length === 1 ? "exploration" : "explorations"}</span><strong>{branch.name}</strong><small>{branch.snapshot.candidates.length ? branch.snapshot.candidates.map(item => item.title).join(" · ") : "No current results"}{branch.updatedAt ? ` · updated ${dateLabel(branch.updatedAt)}` : ""}</small></div>
                <div className="lab-map-actions"><button className="secondary-btn" type="button" onClick={() => resumeToResults(branch.id)}>Resume</button><button className={`quiet-btn ${isFavorite ? "is-favorite" : ""}`} type="button" aria-pressed={isFavorite} onClick={() => lab.favorite(branch.id)}>{isFavorite ? "Favorite" : "Mark favorite"}</button><button className="quiet-btn" type="button" onClick={() => rename("branch", branch.id, branch.name)}>Rename</button><button className="quiet-btn lab-remove" type="button" onClick={() => removeBranch(branch.id, branch.name)}>Remove</button></div>
                {branch.snapshot.history.length > 0 && <details className="lab-branch-history"><summary>Branch history · {branch.snapshot.history.length} {branch.snapshot.history.length === 1 ? "step" : "steps"}</summary><ol>{branch.snapshot.history.map(step => <li key={step.id}><span>{STRATEGIES.find(item => item.id === step.strategy)?.name} · {dateLabel(step.createdAt)}</span><strong>{valuesText(step.anchors)}</strong><small>{step.discoveries.length ? step.discoveries.map(item => `${item.title} (${item.domain})`).join(" · ") : "No discoveries returned in this batch."}</small></li>)}</ol></details>}
              </div>;
            })}</div>
          </article>;
        })}</div>
      </section>
    <section className="lab-compare" aria-labelledby="compare-title">
      <div className="module-heading"><div><span className="eyebrow">Look across the paths</span><h3 id="compare-title">Compare branches</h3></div><p>Sibling paths from one checkpoint, side by side. Compare discoveries, recorded conditions, evidence, and your feedback.</p></div>
      {checkpoints.length > 0 && <label className="field lab-compare-select"><span>Shared checkpoint</span><select value={effectiveCompareCheckpoint} onChange={event => setComparisonCheckpoint(event.target.value)}><option value="">Choose a checkpoint</option>{checkpoints.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {!checkpoints.length && <div className="lab-empty-inline"><strong>No checkpoint to compare</strong><span>Save a checkpoint and create sibling branches to begin.</span></div>}
      {effectiveCompareCheckpoint && compareCheckpointBranches.length < 2 && <div className="lab-empty-inline"><strong>One more sibling opens a comparison</strong><span>This checkpoint has {compareCheckpointBranches.length} path{compareCheckpointBranches.length === 1 ? "" : "s"}. Open another direction from this exact starting point.</span>
        {checkpoints.length > 0 && <button type="button" className="secondary-btn" onClick={() => current ? void openDirection(effectiveCompareCheckpoint) : lab.restore(effectiveCompareCheckpoint)} disabled={busy}>{current ? `Open ${STRATEGIES.find(item => item.id === selectedStrategy)?.name}` : "Return to this checkpoint"}</button>}
      </div>}
      {effectiveCompareCheckpoint && compareCheckpointBranches.length > 0 && <div className="lab-compare-body">
        <div className="lab-sibling-grid" aria-label="Sibling paths from the selected checkpoint">
          {compareCheckpointBranches.map((branch, index) => {
            const branchCheckpoint = checkpoints.find(item => item.id === branch.checkpointId);
            const branchDiscoveries = allDiscoveries(branch, branchCheckpoint);
            const postHistory = branch.snapshot.history.slice(branchCheckpoint?.snapshot.history.length || 0);
            const chosen = effectiveCompareIds.includes(branch.id);
            const draftName = branchNameDrafts[branch.id] ?? branch.name;
            return <article className={`lab-sibling-card tone-${index % 3} ${chosen ? "is-compared" : ""}`} key={branch.id}>
              <header className="lab-sibling-card-head"><label className="lab-compare-toggle"><input type="checkbox" aria-label={`Compare ${branch.name}`} checked={chosen} onChange={() => toggleCompare(branch.id)} /><span>Compare</span></label>
                <input aria-label={`Name for ${branch.name}`} className="lab-branch-name-input" value={draftName} disabled={busy} onChange={event => setBranchNameDrafts(items => ({ ...items, [branch.id]: event.target.value }))} onBlur={() => saveBranchName(branch.id, branch.name)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} />
              </header>
              <div className="lab-sibling-card-body"><span className="lab-map-kind">{STRATEGIES.find(item => item.id === branch.strategy)?.name} · {branch.snapshot.mode === "demo" ? "Prepared examples" : "Historical live Qloo"}</span>
                <strong className="lab-sibling-subtitle">{branch.name}: independent path</strong>
                <p>{postHistory.length} {postHistory.length === 1 ? "exploration" : "explorations"} after the checkpoint · {branchDiscoveries.length} distinct discoveries · updated {dateLabel(branch.updatedAt)}.</p>
                {!postHistory.length && <div className="lab-sibling-empty">Branch opened; no post-checkpoint exploration has been recorded yet.</div>}
              </div>
              <footer className="lab-sibling-card-actions"><button type="button" className="secondary-btn" onClick={() => resumeToResults(branch.id)} disabled={busy}>Resume this path</button><button type="button" className="text-button" onClick={() => { if (lab.resume(branch.id)) void afterOperation(() => lab.explore()); }} disabled={busy}>Explore this path</button></footer>
            </article>;
          })}
        </div>
        {compareCheckpointBranches.length >= 2 && selectedCompareBranches.length < 2 && <p className="lab-compare-prompt" role="status">Select {2 - selectedCompareBranches.length} more branch{selectedCompareBranches.length === 1 ? "" : "es"} to compare.</p>}
        {selectedCompareBranches.length >= 2 && <details className="lab-detailed-comparison"><summary>Detailed discoveries &amp; evidence</summary><div className="lab-compare-columns">{selectedCompareBranches.map(branch => {
          const branchDiscoveries = allDiscoveries(branch, checkpoints.find(item => item.id === branch.checkpointId));
          const favorite = state.favorites[branch.checkpointId] === branch.id;
          return <article className="lab-compare-branch" key={branch.id}><header><div><span className="lab-map-kind">{STRATEGIES.find(item => item.id === branch.strategy)?.name} · {branch.snapshot.mode === "demo" ? "Prepared examples" : "Historical live Qloo"}</span><h4>{branch.name}</h4><p>From {checkpoints.find(item => item.id === branch.checkpointId)?.name}</p></div><button type="button" className={`quiet-btn ${favorite ? "is-favorite" : ""}`} aria-pressed={favorite} onClick={() => lab.favorite(branch.id)}>{favorite ? "Unfavorite branch" : "Favorite branch"}</button></header>
            <div className="lab-compare-controls"><button className="secondary-btn" type="button" onClick={() => resumeToResults(branch.id)}>Resume this branch</button></div>
              <details className="lab-compare-context"><summary>Conditions & full path record</summary>
               <div className="lab-compare-settings"><strong>Recorded conditions</strong><p>{[
                 `Adventure: ${branch.snapshot.settings.adventure}`,
                 `Time: ${branch.snapshot.settings.time}`,
                 `Mood: ${branch.snapshot.settings.mood}`,
                 `Domain: ${branch.snapshot.settings.domain}`,
                 `Occasion: ${branch.snapshot.settings.occasion}`,
                 branch.snapshot.settings.location && `Place: ${branch.snapshot.settings.location}`,
                 branch.snapshot.settings.budget && `Budget: ${branch.snapshot.settings.budget}`,
                 branch.snapshot.settings.movement && `Movement/access: ${branch.snapshot.settings.movement}`,
                 branch.snapshot.settings.conditions && `Conditions: ${branch.snapshot.settings.conditions}`,
                 branch.snapshot.settings.groupInterests && `Group interests: ${branch.snapshot.settings.groupInterests}`,
                 branch.snapshot.settings.scenario && `Scenario: ${branch.snapshot.settings.scenario}`,
               ].filter(Boolean).join(" · ")}</p></div>
               {branch.snapshot.history.length ? <ol className="lab-compare-history">{branch.snapshot.history.map((step, stepIndex) => <li key={step.id}><span>Step {stepIndex + 1} · {STRATEGIES.find(item => item.id === step.strategy)?.name} · {dateLabel(step.createdAt)}</span><strong>{step.discoveries.length ? step.discoveries.map(item => item.title).join(" · ") : "No discoveries returned"}</strong><small>Anchors: {valuesText(step.anchors)} · {step.settings.adventure} · {step.settings.time} · {step.settings.mood}</small></li>)}</ol> : <p className="lab-compare-empty">No exploration history recorded for this branch yet.</p>}
             </details>
            {!branchDiscoveries.length && <p className="lab-compare-empty">This branch has no discoveries to compare yet.</p>}
            {branchDiscoveries.map(discovery => {
              const fb = branch.snapshot.feedback[discovery.id];
                const common = (compareDiscoveryCounts.get(discoveryIdentity(discovery)) || 0) > 1;
               return <div className="lab-compare-discovery" key={discovery.id}><span className={`lab-domain-tag ${common ? "is-shared" : "is-path-only"}`}>{common ? "Also found on another selected path" : "Only in this selected path"} · {discovery.domain}</span><h5>{discovery.title}</h5><p>{discovery.description}</p><details className="lab-compare-evidence"><summary>Evidence, sources &amp; practical checks</summary><dl><div><dt>Connection</dt><dd>{discovery.connection || "Not provided."}</dd></div><div><dt>Original connection</dt><dd>{discovery.originalConnection || "Not provided."}</dd></div><div><dt>Evidence</dt><dd>{discovery.evidence || "No evidence supplied."}</dd></div><div><dt>Source &amp; selection</dt><dd>{discovery.source || "Not recorded."} · {discovery.selection || "Not recorded."}</dd></div><div><dt>Provenance</dt><dd>{discovery.mode === "demo" ? "Prepared example; not live Qloo evidence." : "Historical live record; current connection not implied."}</dd></div>{discovery.constraints.length > 0 && <div><dt>Practical limits · unverified</dt><dd>{discovery.constraints.map(item => `${item.constraint}: ${item.value} · ${item.status} — ${item.detail}`).join(" / ")}</dd></div>}<div><dt>Branch feedback</dt><dd>{fb ? `${fb.action === "keep" ? "Kept" : "Not for me"} · ${fb.reason}` : "No feedback recorded"}</dd></div></dl></details><div className="lab-compare-discovery-actions"><button type="button" className="text-button" onClick={() => void runFork(discovery, branch.id)}>Fork from this discovery</button><button type="button" className="text-button" onClick={() => runNext(discovery, branch.id)}>Continue from this discovery</button></div></div>;
            })}
          </article>;
        })}</div></details>}
        {selectedCompareBranches.length >= 2 && (() => {
          const checkpoint = checkpoints.find(item => item.id === effectiveCompareCheckpoint);
          if (!checkpoint) return null;
          const branches = selectedCompareBranches;
          const branchItems = branches.map(branch => ({
            branch,
            discoveries: allDiscoveries(branch, checkpoint),
            postHistory: branch.snapshot.history.slice(checkpoint.snapshot.history.length),
          }));
          const keyOf = (discovery: Discovery) => discoveryIdentity(discovery);
          const discoveryCounts = new Map<string, number>();
          branchItems.forEach(item => item.discoveries.forEach(discovery => discoveryCounts.set(keyOf(discovery), (discoveryCounts.get(keyOf(discovery)) || 0) + 1)));
          const distinctDiscoveries = new Map<string, Discovery>();
          branchItems.forEach(item => item.discoveries.forEach(discovery => distinctDiscoveries.set(keyOf(discovery), discovery)));
          const comparableSettings: Array<[string, keyof Settings]> = [
            ["Adventure", "adventure"], ["Time available", "time"], ["Mood", "mood"],
            ["Domain", "domain"], ["Occasion", "occasion"], ["Place", "location"],
            ["Budget", "budget"], ["Movement / access", "movement"], ["Conditions", "conditions"],
            ["Group interests", "groupInterests"], ["Scenario", "scenario"], ["Scenario category", "scenarioCategory"],
          ];
          const differingSettings = comparableSettings.filter(([, key]) => new Set(branches.map(branch => String(branch.snapshot.settings[key] || "Not recorded"))).size > 1);
          const sharedCount = [...discoveryCounts.values()].filter(count => count > 1).length;
          return <section className="lab-compare-findings" aria-label="Branch comparison findings">
            <section className="lab-shared-checkpoint" aria-labelledby="shared-checkpoint-title">
              <div><span className="eyebrow">Shared starting point · unchanged</span><h4 id="shared-checkpoint-title">{checkpoint.name}</h4><p>{valuesText(checkpoint.snapshot.anchors)}{checkpoint.snapshot.selected ? ` · selected discovery: ${checkpoint.snapshot.selected.title}` : ""}</p></div>
              <div className="lab-shared-checkpoint-facts"><span>{checkpoint.snapshot.settings.domain} domain</span><span>{checkpoint.snapshot.settings.time}</span><span>{checkpoint.snapshot.settings.occasion}</span></div>
            </section>
            <section className="lab-takeaway" aria-labelledby="takeaway-title">
              <span className="eyebrow">A factual read of these saved paths</span><h4 id="takeaway-title">What differs after the checkpoint</h4>
              <p>{sharedCount} discovery {sharedCount === 1 ? "title appears" : "titles appear"} on more than one selected path. {distinctDiscoveries.size - sharedCount} {distinctDiscoveries.size - sharedCount === 1 ? "title appears" : "titles appear"} on only one selected path. {differingSettings.length ? `Recorded conditions differ in ${differingSettings.map(([label]) => label.toLowerCase()).join(", ")}.` : "The recorded conditions shown here match across selected paths."}</p>
              <small>This describes saved records and settings only; it does not rank paths or imply suitability.</small>
            </section>
            <section className="lab-next-experiment" aria-label="A useful next experiment">
              <div><span className="eyebrow">A useful next experiment</span><p>Return to this shared point, open a new sibling path, and change one recorded condition at a time{differingSettings.length ? ` — such as ${differingSettings[0][0].toLowerCase()}` : " — for example, the time available"}. The resulting records can then be compared without treating the change as a score.</p></div>
              <button type="button" className="secondary-btn" onClick={() => lab.restore(checkpoint.id)} disabled={busy}>Return to shared checkpoint</button>
            </section>
            <section className="lab-post-history" aria-labelledby="post-history-title">
              <div className="lab-history-heading"><span className="eyebrow">Separate histories</span><h4 id="post-history-title">After the shared checkpoint</h4><p>Each path continued independently. The checkpoint’s earlier history is not repeated here.</p></div>
              <div className="lab-post-history-grid">{branchItems.map(({ branch, postHistory }) => <article className="lab-post-history-column" key={branch.id}>
                <h5>{branch.name}</h5>
                {!postHistory.length ? <p className="lab-compare-empty">No exploration steps saved after this checkpoint.</p> : <ol>{postHistory.map((step, stepIndex) => <li key={step.id}><span>Step {stepIndex + 1} · {STRATEGIES.find(item => item.id === step.strategy)?.name} · {dateLabel(step.createdAt)}</span><strong>{step.discoveries.length ? step.discoveries.map(item => item.title).join(" · ") : "No discoveries returned"}</strong><small>Anchors: {valuesText(step.anchors)} · {step.settings.domain} · {step.settings.time}</small></li>)}</ol>}
              </article>)}</div>
            </section>
            <section className="lab-difference-section" aria-labelledby="observable-title">
              <span className="eyebrow">Recorded details, not ratings</span><h4 id="observable-title">Observable differences</h4>
              <div className="lab-difference-scroll" role="region" aria-label="Horizontally scrollable observable differences table" tabIndex={0}>
                <table className="lab-difference-table"><thead><tr><th scope="col">Recorded cue</th>{branches.map(branch => <th scope="col" key={branch.id}>{branch.name}</th>)}</tr></thead>
                  <tbody>
                    {differingSettings.map(([label, key]) => <tr key={String(key)}><th scope="row">{label}</th>{branches.map(branch => {
                      const value = branch.snapshot.settings[key];
                      const scenarioLabel = key === "scenarioCategory" ? SCENARIOS.find(item => item.id === value)?.label : undefined;
                      return <td key={branch.id}>{scenarioLabel || String(value || "Not recorded")}</td>;
                    })}</tr>)}
                    {[...distinctDiscoveries.entries()].map(([key, discovery]) => <tr key={key}><th scope="row">Discovery · {discovery.domain}</th>{branchItems.map(({ branch, discoveries }) => <td key={branch.id}>{discoveries.some(item => keyOf(item) === key) ? discovery.title : "Not recorded on this path"}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            </section>
          </section>;
        })()}
      </div>}
    </section>

    <footer className="lab-footer"><span>Open Door keeps this Lab in browser storage.</span><div><button className="quiet-btn" type="button" onClick={lab.exportData}>Export Lab data</button><button className="quiet-btn lab-remove" type="button" onClick={clearLab}>Clear all Lab data</button></div></footer>
  </div>;
}
