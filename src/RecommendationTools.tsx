import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, MapPin, Printer, Download, CalendarDays, Check, Clock3 } from "lucide-react";
import { MascotArt } from "./MascotArt";

export type Recommendation = {
  id: string;
  title: string;
  kind: string;
  category: string;
  tier: string;
  source: string;
  why: string;
  now: string;
  evidence: string;
  entityType?: string;
};

type Props = {
  recommendations: Recommendation[];
  city: string;
  mode: "demo" | "live";
};

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);

export function mapsSearch(category: string, location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`nearby ${category} ${location}`.trim())}`;
}

function standaloneHtml(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f2ea;color:#263b35;font:16px/1.6 Georgia,serif}.page{max-width:780px;margin:0 auto;padding:42px 24px}h1{font-size:42px;line-height:1.05;font-weight:500;margin:10px 0}h2{font-size:25px;margin:0 0 8px}h3{font:600 12px/1.4 monospace;letter-spacing:.08em;text-transform:uppercase;color:#35675a;margin:22px 0 5px}.eyebrow{font:11px monospace;letter-spacing:.12em;text-transform:uppercase;color:#b9674f}.meta,.fine{font:13px/1.65 Arial,sans-serif;color:#626c62}.item{margin:18px 0;padding:20px;background:#fffefa;border:1px solid #d9ded4}.source{padding:12px 14px;background:#eee8dc;border-left:3px solid #c89e4d;font:13px/1.6 Arial,sans-serif}.map{color:#35675a;font:13px Arial,sans-serif}.foot{margin-top:28px;padding-top:16px;border-top:1px solid #d9ded4;font:12px/1.6 Arial,sans-serif;color:#626c62}
</style></head><body><main class="page">${body}</main></body></html>`;
}

function downloadHtml(filename: string, html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RecommendationTools({ recommendations, city, mode }: Props) {
  const [notice, setNotice] = useState("");
  const markup = useMemo(() => standaloneHtml("Open Door recommendations", `
    <div class="eyebrow">Open Door · ${mode === "live" ? "Live Qloo response" : "Authored demo"}</div>
    <h1>Your recommendations</h1><p class="meta">For ${esc(city)} · ${recommendations.length} returned candidates</p>
    ${recommendations.map(item => `<article class="item"><div class="eyebrow">${esc(item.tier)} · ${esc(item.category)}</div><h2>${esc(item.title)}</h2><p>${esc(item.kind)}</p><h3>Why this fits</h3><p>${esc(item.why)}</p><h3>A practical first step</h3><p>${esc(item.now)}</p><p class="source"><strong>Source and provenance</strong><br>${esc(item.evidence)}<br>${mode === "live" ? "Returned Qloo entity; not a verified venue, event, schedule, price, or availability." : "Authored deterministic demo content; not Qloo output or a real listing."}</p><a class="map" href="${esc(mapsSearch(item.category, city))}" target="_blank" rel="noopener noreferrer">Search nearby ${esc(item.category)} in Google Maps</a></article>`).join("")}
    <p class="foot">Maps links search for nearby categories; they do not confirm that a specific recommendation is a venue. Confirm details directly. No prices, travel times, schedules, or availability are verified.</p>`), [recommendations, city, mode]);

  return <>
    <div className="recommendation-tools" aria-label="Recommendation actions">
      <button className="secondary-btn" type="button" onClick={() => { document.documentElement.dataset.printTarget = "recommendations"; window.print(); setNotice("Recommendation sheet sent to your browser’s print dialog."); }}><Printer size={14} /> Print recommendations</button>
      <button className="secondary-btn" type="button" onClick={() => { downloadHtml("open-door-recommendations.html", markup); setNotice("Readable HTML recommendations downloaded."); }}><Download size={14} /> Download HTML</button>
      <button className="secondary-btn" type="button" onClick={() => document.getElementById("day-plan")?.scrollIntoView({ behavior: "smooth", block: "start" })}><CalendarDays size={14} /> Plan these candidates</button>
      {notice && <span className="visually-hidden" role="status">{notice}</span>}
    </div>
    <section className="print-area recommendations-print" aria-label="Printable Open Door recommendations">
      <div className="print-header"><span className="eyebrow">Open Door · {mode === "live" ? "Live Qloo response" : "Authored demo"}</span><h1>Your recommendations</h1><p>For {city} · returned candidates only</p></div>
      {recommendations.map(item => <article className="print-recommendation" key={item.id}>
        <span className="eyebrow">{item.tier} · {item.category}</span><h2>{item.title}</h2><p>{item.kind}</p>
        <h3>Why this fits</h3><p>{item.why}</p><h3>A practical first step</h3><p>{item.now}</p>
        <p className="print-provenance"><strong>Provenance:</strong> {item.evidence} {mode === "live" ? "Qloo returned entity, not a verified venue." : "Authored demo; not Qloo output or a real listing."}</p>
        <a href={mapsSearch(item.category, city)} target="_blank" rel="noopener noreferrer">Nearby {item.category} search in Google Maps</a>
      </article>)}
      <p className="print-disclaimer">Maps links search a nearby category and do not verify any recommendation as a venue. Confirm prices, schedules, availability, accessibility, and travel directly.</p>
    </section>
  </>;
}

type PlannerProps = {
  recommendations: Recommendation[];
  city: string;
  mode: "demo" | "live";
  startTime: string;
  endTime: string;
  location: string;
  budget: string;
  novelty: string;
  onRefresh: (values: { startTime: string; endTime: string; location: string; budget: string; novelty: string }) => void;
  refreshDisabled: boolean;
  refreshing: boolean;
  oneHour: boolean;
  setOneHour: (value: boolean) => void;
};
type PlanItem = { id: string; duration: number; checked: boolean };
const toMinutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
const timeLabel = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function DayPlanner(props: PlannerProps) {
  const [start, setStart] = useState(props.startTime || "10:00");
  const [end, setEnd] = useState(props.endTime || "14:00");
  const [location, setLocation] = useState(props.location || props.city);
  const [budget, setBudget] = useState(props.budget);
  const [novelty, setNovelty] = useState(props.novelty);
  const [buffer, setBuffer] = useState(15);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [error, setError] = useState("");
  const orderedRecommendations = [...props.recommendations].sort((a, b) => {
    const order: Record<string, number> = novelty === "Familiar first"
      ? { Familiar: 0, Adjacent: 1, Unexpected: 2 }
      : novelty === "Unexpected first" ? { Unexpected: 0, Adjacent: 1, Familiar: 2 }
        : { Adjacent: 0, Familiar: 1, Unexpected: 2 };
    return (order[a.tier] ?? 9) - (order[b.tier] ?? 9);
  });
  const candidates = props.oneHour ? orderedRecommendations.slice(0, 1) : orderedRecommendations;
  const availableIds = candidates.map(item => item.id);
  const planIds = plan.map(item => item.id).filter(id => availableIds.includes(id));
  const displayed = planIds.map(id => ({ plan: plan.find(item => item.id === id)!, door: candidates.find(item => item.id === id)! }));
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  const total = displayed.reduce((sum, item) => sum + item.plan.duration, 0) + Math.max(0, displayed.length - 1) * buffer;
  const validWindow = Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin;
  const fits = validWindow && total <= endMin - startMin;
  let cursor = startMin;
  const scheduled = displayed.map(({ plan: item, door }) => {
    const block = { item, door, begins: cursor, ends: cursor + item.duration };
    cursor = block.ends + buffer;
    return block;
  });
  const adjust = (next: PlanItem[]) => {
    setPlan(next);
    const mins = next.reduce((sum, item) => sum + item.duration, 0) + Math.max(0, next.length - 1) * buffer;
    if (validWindow && mins > endMin - startMin) setError("This does not fit your available window. Shorten, remove, or reorder blocks, or adjust your window.");
    else setError("");
  };
  const add = (door: Recommendation) => {
    if (plan.some(item => item.id === door.id)) return;
    adjust([...plan, { id: door.id, duration: 45, checked: false }]);
  };
  function move(id: string, offset: number) {
    const visibleIndex = planIds.indexOf(id);
    const otherId = planIds[visibleIndex + offset];
    if (!otherId) return;
    const from = plan.findIndex(item => item.id === id);
    const to = plan.findIndex(item => item.id === otherId);
    const next = [...plan];
    [next[from], next[to]] = [next[to], next[from]];
    adjust(next);
  }
  function addSuggestedPlan() {
    if (!validWindow) return;
    const available = endMin - startMin;
    const length = Math.min(candidates.length, Math.floor((available + buffer) / (45 + buffer)));
    if (!length) {
      setError("Allow at least 45 minutes for a suggested block, or add one candidate and choose a shorter duration.");
      return;
    }
    adjust(candidates.slice(0, length).map(door => ({ id: door.id, duration: 45, checked: false })));
  }
  const exportHtml = () => {
    if (!fits) { setError(validWindow ? "Shorten the plan so everything fits the time window before exporting." : "Choose an end time later than the start time."); return; }
    const schedule = scheduled.map(({ item, door, begins, ends }, index) => `<article class="item"><div class="eyebrow">${index + 1} · ${timeLabel(begins)}–${timeLabel(ends)} · ${item.duration} minutes${item.checked ? " · completed" : ""}</div><h2>${esc(door.title)}</h2><p>${esc(door.kind)} · ${esc(door.category)} · ${esc(door.tier)}</p><h3>Why this fits</h3><p>${esc(door.why)}</p><h3>First step</h3><p>${esc(door.now)}</p><a class="map" target="_blank" rel="noopener noreferrer" href="${esc(mapsSearch(door.category, location))}">Nearby ${esc(door.category)} search in Google Maps</a></article>`).join("");
    const recs = candidates.map(door => `<p><strong>${esc(door.title)}</strong> · ${esc(door.category)} — ${esc(door.evidence)}</p>`).join("");
    downloadHtml("open-door-day-plan.html", standaloneHtml("Open Door day plan", `<div class="eyebrow">Open Door · ${props.mode === "live" ? "Live Qloo response" : "Authored demo"}</div><h1>A flexible day plan</h1><p class="meta">${esc(start)}–${esc(end)} · ${esc(location)} · ${esc(budget)}</p><p class="fine">${scheduled.length} activity blocks · ${buffer} minute rest/buffer between blocks. Sequence only; travel time is not estimated.</p>${schedule}<h2>All returned recommendations · source notes</h2>${recs}<p class="foot">Source mode: ${props.mode === "live" ? "Qloo-backed returned entities, not venue listings." : "Deterministic authored demo, not Qloo output or real listings."} No venue, price, schedule, availability, or travel duration is confirmed. Google Maps links are category searches only. Confirm all details directly.</p>`));
  };

  return <section className="plan-panel" id="day-plan">
    <div className="module-heading"><div><span className="eyebrow">Build My Day · returned candidates only</span><h3>Make room for what interests you.</h3></div><p>Arrange possibilities, not a confirmed itinerary. Times, venue details, prices, availability, and travel are not verified.</p></div>
    <div className="planner-welcome"><MascotArt scene="coffee" /><div><h4>A little curiosity. A little breathing room.</h4><p>Start with one idea or let us arrange a few. You can change your mind, take a break, and make this day your own.</p></div></div>
    <div className="planner-fields">
      <div className="field"><label htmlFor="planner-start">Start</label><input id="planner-start" type="time" value={start} onChange={event => { setStart(event.target.value); setError(""); }} /></div>
      <div className="field"><label htmlFor="planner-end">End</label><input id="planner-end" type="time" value={end} onChange={event => { setEnd(event.target.value); setError(""); }} /></div>
      <div className="field"><label htmlFor="planner-location">Planning location</label><input id="planner-location" value={location} onChange={event => setLocation(event.target.value)} /></div>
      <div className="field"><label htmlFor="planner-buffer">Rest / buffer between blocks</label><select id="planner-buffer" value={buffer} onChange={event => { const value = Number(event.target.value); setBuffer(value); const mins = displayed.reduce((sum, row) => sum + row.plan.duration, 0) + Math.max(0, displayed.length - 1) * value; setError(validWindow && mins > endMin - startMin ? "This does not fit your available window." : ""); }}><option value={0}>No buffer</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option></select></div>
    </div>
    <div className="planner-controls">
      <div className="field"><label htmlFor="planner-budget">Budget preference</label><select id="planner-budget" value={budget} onChange={event => setBudget(event.target.value)}><option>Flexible</option><option>Free or low-cost</option><option>Moderate</option><option>Open to a splurge</option></select></div>
      <div className="field"><label htmlFor="planner-novelty">Order of discovery</label><select id="planner-novelty" value={novelty} onChange={event => setNovelty(event.target.value)}><option>Familiar first</option><option>Balanced</option><option>Unexpected first</option></select></div>
      <button className="primary-btn" type="button" onClick={() => props.onRefresh({ startTime: start, endTime: end, location, budget, novelty })} disabled={props.refreshDisabled}>{props.refreshing ? "Updating returned candidates…" : props.mode === "live" ? "Refresh with these preferences" : "Build my sample day"}</button>
    </div>
    <div className="plan-toggle"><button className={`secondary-btn ${props.oneHour ? "selected" : ""}`} type="button" aria-pressed={props.oneHour} onClick={() => props.setOneHour(!props.oneHour)}><Clock3 size={14} /> {props.oneHour ? "Show all candidates" : "I have one hour"}</button><span className="helper">{props.oneHour ? "Showing one actual candidate, ordered by your selection." : "Plan with the complete set of returned candidates."}</span></div>
    <p className="helper">Refresh retains its original behavior: Live mode requests new Qloo candidates; Demo mode reshapes authored sample paths. Local planning below never refreshes results.</p>
    {!validWindow
      ? <p className="planner-error" role="alert">End time must be later than start time on the same day.</p>
      : (error || (displayed.length > 0 && !fits))
        ? <p className="planner-error" role="alert">{error || "This does not fit your available window. Shorten, remove, or reorder items, or adjust your window."}</p>
        : null}
    {validWindow && <p className="planner-summary" aria-live="polite">{displayed.length} blocks · {total} minutes including buffers · {endMin - startMin - total} minutes unassigned</p>}
    <div className="planner-picks"><h4>Add a returned candidate</h4>
      {!displayed.length && <button className="secondary-btn" type="button" disabled={!validWindow || !candidates.length} onClick={addSuggestedPlan}>Suggest a plan that fits</button>}
      {!candidates.length ? <p>No returned candidates are available to sequence.</p> : candidates.map(door => <button type="button" className="planner-pick" key={door.id} disabled={plan.some(item => item.id === door.id)} onClick={() => add(door)}>{door.title} <span>{door.category} · {door.tier}</span>{plan.some(item => item.id === door.id) ? <Check size={15} /> : <span aria-hidden="true">Add</span>}</button>)}
    </div>
    {!!scheduled.length && <ol className="planner-schedule" aria-label="Editable day schedule">{scheduled.map(({ item, door, begins, ends }, index) => <li className="planner-item" key={door.id}>
      <div className="planner-item-time">{fits ? `${timeLabel(begins)}–${timeLabel(ends)}` : "Needs more room"}<small>Activity block · no travel estimate</small></div>
      <div className="planner-item-content"><label className="planner-check"><input type="checkbox" checked={item.checked} onChange={event => setPlan(current => current.map(row => row.id === item.id ? { ...row, checked: event.target.checked } : row))} /><span>{door.title}</span></label><p>{door.now}</p><a href={mapsSearch(door.category, location)} target="_blank" rel="noopener noreferrer"><MapPin size={14} /> Nearby {door.category} search in Google Maps</a>
        <div className="planner-item-actions"><label>Duration <select aria-label={`Duration for ${door.title}`} value={item.duration} onChange={event => adjust(plan.map(row => row.id === item.id ? { ...row, duration: Number(event.target.value) } : row))}><option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option><option value={90}>90 min</option><option value={120}>120 min</option></select></label>
          <button type="button" className="text-button" aria-label={`Move ${door.title} earlier`} disabled={index === 0} onClick={() => move(door.id, -1)}><ArrowUp size={14} /> Earlier</button>
          <button type="button" className="text-button" aria-label={`Move ${door.title} later`} disabled={index === displayed.length - 1} onClick={() => move(door.id, 1)}><ArrowDown size={14} /> Later</button>
          <button type="button" className="text-button" onClick={() => adjust(plan.filter(row => row.id !== door.id))}>Remove</button>
        </div>
      </div>
    </li>)}</ol>}
    <div className="story-actions">
      <button className="secondary-btn" type="button" disabled={!scheduled.length || !fits} onClick={() => { document.documentElement.dataset.printTarget = "day-plan"; window.print(); }}><Printer size={14} /> Print day plan</button>
      <button className="secondary-btn" type="button" disabled={!scheduled.length || !fits} onClick={exportHtml}><Download size={14} /> Download day plan</button><span className="helper">Take a readable HTML copy, or choose “Save as PDF” in your browser’s print dialog.</span>
    </div>
    <section className="print-area day-plan-print" aria-label="Printable Open Door day plan">
      <div className="print-header"><span className="eyebrow">Open Door · {props.mode === "live" ? "Live Qloo response" : "Authored demo"}</span><h1>Your flexible day plan</h1><p>{start}–{end} · {location} · {budget}</p></div>
      {scheduled.map(({ item, door, begins, ends }, index) => <article className="print-recommendation" key={door.id}>
        <span className="eyebrow">{index + 1} · {timeLabel(begins)}–{timeLabel(ends)} · {item.duration} minutes {item.checked ? "· completed" : ""}</span>
        <h2>{door.title}</h2><p>{door.why}</p><h3>A practical first step</h3><p>{door.now}</p>
        <a href={mapsSearch(door.category, location)}>Search nearby {door.category} in Google Maps</a>
        <p className="print-provenance">{door.evidence}</p>
        {index < scheduled.length - 1 && <p>Rest / buffer: {buffer} minutes. Travel is not estimated.</p>}
      </article>)}
      <p className="print-disclaimer">A flexible sequence, not a booking or verified itinerary. Confirm hours, cost, accessibility and travel directly. Maps links are category searches. {props.mode === "demo" && "Authored demo content, not Qloo output or real listings."}</p>
    </section>
  </section>;
}
