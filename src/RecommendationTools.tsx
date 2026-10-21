import { useState } from "react";
import { ArrowDown, ArrowUp, MapPin, Printer, Download, CalendarDays, Check, Clock3 } from "lucide-react";
import { MascotArt } from "./MascotArt";
import { downloadWordDocument, type DocumentSection } from "./documentExport";

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

const mapPlaceType = (category: string) => {
  const placeTypes: Record<string, string> = {
    music: "record shops", art: "art galleries", books: "libraries",
    film: "cinemas", food: "food markets", design: "design museums",
    outdoors: "parks", experiences: "community centers", other: "museums",
  };
  return placeTypes[category.trim().toLowerCase()] || category.trim().toLowerCase();
};

export function mapsSearch(category: string, location: string) {
  const placeType = mapPlaceType(category);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${placeType} near ${location}`.trim())}`;
}

const mapLinkLabel = (category: string, location: string) =>
  `Find ${mapPlaceType(category)} near ${location} on Google Maps`;

function recommendationSections(recommendations: Recommendation[], city: string): DocumentSection[] {
  return recommendations.map(item => ({
    heading: item.title,
    paragraphs: [`${item.tier} · ${item.category} · ${item.kind}`,
      `Why you might like it: ${item.why}`, `Try this: ${item.now}`],
    link: { label: mapLinkLabel(item.category, city), url: mapsSearch(item.category, city) },
  }));
}
const sourceNote = (mode: "demo" | "live") => mode === "live"
  ? "Recommendations use Qloo results; they are not verified places."
  : "Demo recommendations are examples, not live results or real places.";
const verificationNote = "Maps links search by category; they do not confirm a specific place. Check details, prices, hours, availability, accessibility, and travel before you go.";

export function RecommendationTools({ recommendations, city, mode }: Props) {
  const [notice, setNotice] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  async function download() {
    setDownloading(true); setDownloadError(""); setNotice("");
    try {
      await downloadWordDocument({
        filename: "open-door-recommendations.docx", title: "Your recommendations",
         subtitle: `${city} · ${recommendations.length} ideas`,
        sections: recommendationSections(recommendations, city),
        footnote: `${sourceNote(mode)} ${verificationNote}`,
      });
      setNotice("Your Word document has been downloaded.");
    } catch {
      setDownloadError("The Word document could not be created. Please retry, or use Print recommendations to save a PDF.");
    } finally { setDownloading(false); }
  }

  return <>
    <div className="recommendation-tools" aria-label="Recommendation actions">
      <button className="secondary-btn" type="button" onClick={() => { document.documentElement.dataset.printTarget = "recommendations"; window.print(); setNotice("Recommendation sheet sent to your browser’s print dialog."); }}><Printer size={14} /> Print recommendations</button>
      <button className="secondary-btn" type="button" disabled={downloading} onClick={() => void download()}><Download size={14} /> {downloading ? "Creating document…" : "Download Word document"}</button>
       <button className="secondary-btn" type="button" onClick={() => document.getElementById("day-plan")?.scrollIntoView({ behavior: "smooth", block: "start" })}><CalendarDays size={14} /> Plan these ideas</button>
      {notice && <span className="visually-hidden" role="status">{notice}</span>}
      {downloadError && <p role="alert">{downloadError}</p>}
    </div>
    <section className="print-area recommendations-print" aria-label="Printable Open Door recommendations">
      <div className="print-header"><span className="eyebrow">Open Door · {mode === "live" ? "Live recommendations" : "Demo"}</span><h1>Your recommendations</h1><p>Ideas for {city}. {sourceNote(mode)}</p></div>
      {recommendations.map(item => <article className="print-recommendation" key={item.id}>
        <span className="eyebrow">{item.tier} · {item.category}</span><h2>{item.title}</h2><p>{item.kind}</p>
        <h3>Why you might like it</h3><p>{item.why}</p><h3>Try this</h3><p>{item.now}</p>
        <a href={mapsSearch(item.category, city)} target="_blank" rel="noopener noreferrer">{mapLinkLabel(item.category, city)}</a>
      </article>)}
      <p className="print-disclaimer">{verificationNote}</p>
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
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
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
      setError("Allow at least 45 minutes for a suggested activity, or add an idea and choose a shorter duration.");
      return;
    }
    adjust(candidates.slice(0, length).map(door => ({ id: door.id, duration: 45, checked: false })));
  }
  const exportPlan = async () => {
    if (!fits) { setError(validWindow ? "Shorten the plan so everything fits the time window before exporting." : "Choose an end time later than the start time."); return; }
    setExporting(true); setError(""); setExportNotice("");
    try {
      await downloadWordDocument({
       filename: "open-door-day-plan.docx", title: "A flexible day plan",
         subtitle: `${start}–${end} · ${location} · ${budget}`,
        sections: [
           { heading: "Time and breaks", paragraphs: [`${scheduled.length} activities · ${buffer} minute break between activities. Travel time is not included.`] },
          ...scheduled.map(({ item, door, begins, ends }, index) => ({
            heading: `${index + 1}. ${door.title}`,
            paragraphs: [`${timeLabel(begins)}–${timeLabel(ends)} · ${item.duration} minutes${item.checked ? " · completed" : ""}`,
               `Why you might like it: ${door.why}`, `Try this: ${door.now}`],
             link: { label: mapLinkLabel(door.category, location), url: mapsSearch(door.category, location) },
          })),
        ],
         footnote: `${sourceNote(props.mode)} ${verificationNote}`,
      });
      setExportNotice("Your day plan Word document has been downloaded.");
    } catch {
      setError("The Word document could not be created. Retry, or use Print day plan to save a PDF.");
    } finally { setExporting(false); }
  };

  return <section className="plan-panel" id="day-plan">
    <div className="module-heading"><div><span className="eyebrow">Plan your day</span><h3>Make room for what interests you.</h3></div><p>Arrange a few ideas into a flexible plan. Check place details, prices, availability, accessibility, and travel before you go.</p></div>
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
      <button className="primary-btn" type="button" onClick={() => props.onRefresh({ startTime: start, endTime: end, location, budget, novelty })} disabled={props.refreshDisabled}>{props.refreshing ? "Updating ideas…" : props.mode === "live" ? "Refresh ideas" : "Refresh demo ideas"}</button>
    </div>
    <div className="plan-toggle"><button className={`secondary-btn ${props.oneHour ? "selected" : ""}`} type="button" aria-pressed={props.oneHour} onClick={() => props.setOneHour(!props.oneHour)}><Clock3 size={14} /> {props.oneHour ? "Show all ideas" : "I have one hour"}</button><span className="helper">{props.oneHour ? "Showing one idea, based on your selected order." : "Choose from all the ideas above."}</span></div>
    <p className="helper">{props.mode === "live" ? "Refresh gets new suggestions. Changes to this plan stay here." : "Demo ideas are examples. Refresh changes the sample suggestions; your plan edits stay here."}</p>
    {!validWindow
      ? <p className="planner-error" role="alert">End time must be later than start time on the same day.</p>
      : (error || (displayed.length > 0 && !fits))
        ? <p className="planner-error" role="alert">{error || "This does not fit your available window. Shorten, remove, or reorder items, or adjust your window."}</p>
        : null}
    {validWindow && <p className="planner-summary" aria-live="polite">{displayed.length} blocks · {total} minutes including buffers · {endMin - startMin - total} minutes unassigned</p>}
    <div className="planner-picks"><h4>Add an idea</h4>
      {!displayed.length && <button className="secondary-btn" type="button" disabled={!validWindow || !candidates.length} onClick={addSuggestedPlan}>Suggest a plan that fits</button>}
      {!candidates.length ? <p>No ideas to add right now.</p> : candidates.map(door => <button type="button" className="planner-pick" key={door.id} disabled={plan.some(item => item.id === door.id)} onClick={() => add(door)}>{door.title} <span>{door.category} · {door.tier}</span>{plan.some(item => item.id === door.id) ? <Check size={15} /> : <span aria-hidden="true">Add</span>}</button>)}
    </div>
    {!!scheduled.length && <ol className="planner-schedule" aria-label="Editable day schedule">{scheduled.map(({ item, door, begins, ends }, index) => <li className="planner-item" key={door.id}>
      <div className="planner-item-time">{fits ? `${timeLabel(begins)}–${timeLabel(ends)}` : "Needs more room"}<small>Activity block · no travel estimate</small></div>
      <div className="planner-item-content"><label className="planner-check"><input type="checkbox" checked={item.checked} onChange={event => setPlan(current => current.map(row => row.id === item.id ? { ...row, checked: event.target.checked } : row))} /><span>{door.title}</span></label><p>{door.now}</p><a href={mapsSearch(door.category, location)} target="_blank" rel="noopener noreferrer"><MapPin size={14} /> {mapLinkLabel(door.category, location)}</a>
        <div className="planner-item-actions"><label>Duration <select aria-label={`Duration for ${door.title}`} value={item.duration} onChange={event => adjust(plan.map(row => row.id === item.id ? { ...row, duration: Number(event.target.value) } : row))}><option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option><option value={90}>90 min</option><option value={120}>120 min</option></select></label>
          <button type="button" className="text-button" aria-label={`Move ${door.title} earlier`} disabled={index === 0} onClick={() => move(door.id, -1)}><ArrowUp size={14} /> Earlier</button>
          <button type="button" className="text-button" aria-label={`Move ${door.title} later`} disabled={index === displayed.length - 1} onClick={() => move(door.id, 1)}><ArrowDown size={14} /> Later</button>
          <button type="button" className="text-button" onClick={() => adjust(plan.filter(row => row.id !== door.id))}>Remove</button>
        </div>
      </div>
    </li>)}</ol>}
    <div className="story-actions">
      <button className="secondary-btn" type="button" disabled={!scheduled.length || !fits} onClick={() => { document.documentElement.dataset.printTarget = "day-plan"; window.print(); }}><Printer size={14} /> Print day plan</button>
      <button className="secondary-btn" type="button" disabled={!scheduled.length || !fits || exporting} onClick={() => void exportPlan()}><Download size={14} /> {exporting ? "Creating document…" : "Download day plan"}</button><span className="helper">Download an editable Word document, or choose “Save as PDF” in your browser’s print dialog.</span>
      {exportNotice && <span role="status">{exportNotice}</span>}
    </div>
    <section className="print-area day-plan-print" aria-label="Printable Open Door day plan">
      <div className="print-header"><span className="eyebrow">Open Door · {props.mode === "live" ? "Live suggestions" : "Demo"}</span><h1>Your flexible day plan</h1><p>{start}–{end} · {location} · {budget}</p></div>
      {scheduled.map(({ item, door, begins, ends }, index) => <article className="print-recommendation" key={door.id}>
        <span className="eyebrow">{index + 1} · {timeLabel(begins)}–{timeLabel(ends)} · {item.duration} minutes {item.checked ? "· completed" : ""}</span>
        <h2>{door.title}</h2><p>{door.why}</p><h3>Try this</h3><p>{door.now}</p>
        <a href={mapsSearch(door.category, location)}>{mapLinkLabel(door.category, location)}</a>
        {index < scheduled.length - 1 && <p>Break: {buffer} minutes. Travel time is not included.</p>}
      </article>)}
      <p className="print-disclaimer">{sourceNote(props.mode)} This is a flexible plan, not a booking. {verificationNote}</p>
    </section>
  </section>;
}
