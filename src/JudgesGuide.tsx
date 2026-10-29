import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, Copy, Info } from "lucide-react";
import type { AgentStatus } from "./agentApi";
import "./JudgesGuide.css";
import FEATURES from "./judges-features.json";

const STEPS = [
  {
    title: "Begin with personal interests",
    time: "0:00–0:45",
    actions: [
      "Open the app in a separate tab and choose “Open the door.” Select Demo to use the shared Qloo API connection, or Connect your own to validate your Qloo hackathon key. Try prepared examples is a separate, authored sample path.",
      "Enter a place and two cultural interests, assigning the appropriate categories. Specific musicians, films, or books are a clearer starting point than a broad phrase such as “good music.”",
      "Choose your intention and exploration depth, then select “Explore with Qloo.”",
    ],
    notice: "Open Door starts with interests the user explicitly supplies. It does not require an account or infer a cultural identity.",
  },
  {
    title: "Inspect Qloo’s contribution",
    time: "0:45–1:30",
    actions: [
      "Wait for the completed journey to display “Live Qloo · response received.” Selecting Live or configuring a key alone is not proof of a successful request.",
      "Review the Familiar, Adjacent, and Unexpected directions, where sufficient results are available. Open a discovery and inspect its explanation and source details.",
      "Select “Under the Door” in the journey toolbar to inspect the completed journey’s evidence.",
    ],
    notice: "Qloo Search resolves the named interests; Insights retrieves cultural connections. Open Door organizes returned results into directions. The route labels are not Qloo confidence scores, and cultural entities are not verified venue listings or bookings.",
  },
  {
    title: "Make discovery useful",
    time: "1:30–2:15",
    actions: [
      "Open a door in place: see Your starting interest, Your discovery, and Why it connects. Try Uncover a hidden gem, save a door, or Add to Build My Day; print or download a Word document.",
      "Use “Explore more ideas” to continue from the selected Qloo entity. Maps opens returned coordinates when available; planner category searches are labeled separately. Supplied websites appear only when available.",
    ],
    notice: "This is a stateful discovery workflow, not a one-shot recommendation page. A returned entity ID becomes an input to the next retrieval step instead of being discarded and re-searched as plain text.",
  },
  {
    title: "Find a Taste Bridge",
    time: "2:15–3:15",
    actions: [
      "Under “01 — Explore for yourself,” choose Taste Bridge. Enter Nina Simone / Music for one person and Spirited Away / Film for another. You can edit, add, or remove people within the two-to-five-person limit.",
      "Choose Find our bridge. Review Shared Ground, The Bridge, and The Wild Card where supported results are available. Inspect which resolved interests contributed, then save or explore a result.",
    ],
    notice: "These are real Qloo requests using the selected shared or personal connection. Combined interests condition retrieval; they do not prove pairwise affinity or that everyone will like the result. Participant names stay in this browser session.",
  },
  {
    title: "Ask What If?",
    time: "3:15–4:15",
    actions: [
      "Under “01 — Explore for yourself,” open What If? Explorer. Start with the current discovery, a saved item, or new interests.",
      "Describe a change, review the recognized conditions, and apply or edit them. Try a different exploration depth or city, then generate alternatives.",
      "Compare original and alternative discoveries. Change the scenario again, save an alternative, or return to the original without overwriting your preferences.",
    ],
    notice: "Scenario interpretation uses disclosed rules, not an external language model. Budget, time, and movement guide local planning; they do not verify prices, availability, accessibility, or suitability. Identical results remain explicitly identical.",
  },
  {
    title: "Challenge a recommendation",
    time: "4:15–5:15",
    actions: [
      "Under “01 — Explore for yourself,” open Discovery Debate and select a current or saved recommendation, or generate one from named interests.",
      "Ask what evidence supports it, challenge the connection, then request something more unexpected. Follow up on the newly selected result.",
      "Inspect the conversation’s source references. Save a revised discovery or continue into the existing discovery experience.",
    ],
    notice: "Evidence replies use the actual result and available metadata. This is a rule-based discovery conversation, not unrestricted AI chat. Alternative requests retrieve from Qloo, retain supported feedback, and exclude previously returned entities.",
  },
  {
    title: "Explore two possible futures in Discovery Lab",
    time: "5:15–6:30",
    actions: [
      "Choose “Explore in Discovery Lab” from the live journey to continue that journey.",
      "For a fresh Lab start, the form defaults to the selected shared or personal Qloo connection. Prepared examples are a separate authored sample path.",
      "Open a branch such as “Follow the Thread.” Its starting checkpoint is created automatically on first open; then open a door, review the results, and mark one Keep.",
      "Return to the starting checkpoint, open a second branch such as “Take the Wild Door,” and open a door there too.",
    ],
    notice: "Confirm both branches share the same starting checkpoint. The second path does not overwrite the first path’s discoveries or feedback. Strategies change retrieval direction; they do not manufacture a novelty score or guarantee disjoint results.",
  },
  {
    title: "Compare, choose, and return",
    time: "6:30–7:15",
    actions: [
      "Find “Compare branches.” Select the automatically created starting checkpoint under “Shared checkpoint,” then select both sibling branches.",
      "Compare discoveries, explanations, source information, conditions, and feedback. Favorite a branch and resume the path you prefer.",
      "Reload the page to confirm the saved exploration remains available.",
    ],
    notice: "Discovery is reversible: an unexpected direction does not erase the familiar path. Histories are browser-local. Reloading restores completed work; it does not present a stored response as a newly executed live request.",
  },
  {
    title: "See the product behind the workflow",
    time: "7:15–7:30",
    actions: [
      "Visit How it works for the architecture and evidence boundaries, or Trust for privacy and browser-data controls.",
      "Try the optional header sound control or a narrow screen. The existing animated mascots accompany the new experiences; reduced-motion preferences use still artwork.",
    ],
    notice: "The responsive interface, supplied mascot artwork, optional audio, and accessible controls support a complete product experience—not just an API demonstration. Sound is muted by default.",
  },
];

export default function JudgesGuide({ status, statusError }: { status: AgentStatus | null; statusError: string }) {
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => {
    const previous = document.title;
    document.title = "Judge’s Guide | Open Door";
    return () => { document.title = previous; };
  }, []);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL("/judges", window.location.origin).href);
      setCopyStatus("Guide link copied.");
    } catch {
      setCopyStatus("The link could not be copied. You can share this page’s address from your browser.");
    }
  }
  return <article className="judges-guide" aria-labelledby="judges-title">
    <header className="judge-hero">
      <span className="eyebrow">Open Door · about eight minutes · live responses may take longer</span>
      <h1 id="judges-title">Judge’s Guide</h1>
      <p><strong>One guide, two ways in.</strong> Under <strong>01 — Explore for yourself</strong>, choose Solo Discovery, Taste Bridge, What If? Explorer, or Discovery Debate—four complementary personal discovery experiences. <strong>02 — Help others explore</strong> is the separate group, destination, and occasion-oriented path. Discovery Lab adds checkpoints, independent branches, and comparison.</p>
      <div className="judge-actions">
        <a className="primary-btn" href="/" target="_blank" rel="noopener noreferrer">Open app in a new tab <ArrowUpRight size={16} /></a>
        <a className="secondary-btn" href="/Open-Door-Judges-Guide.pdf" target="_blank" rel="noopener noreferrer">Download Judge’s Guide PDF</a>
        <button className="secondary-btn" type="button" onClick={() => void copyLink()}><Copy size={15} /> Copy this guide’s link</button>
      </div>
      <p className="judge-copy-status" role="status">{copyStatus}</p>
    </header>
    <section aria-labelledby="judge-new-features">
      <h2 id="judge-new-features">Three new ways to make discovery personal</h2>
      <p>These are working discovery features, not just navigation tabs. Each uses the selected shared Demo or personal Qloo connection and connects back to saving and continuing a discovery.</p>
      {FEATURES.map(feature => <section className="judge-step" key={feature.name}>
        <h3>{feature.name}</h3>
        <p>{feature.benefit}</p>
        <p><strong>Try it: </strong>{feature.try}</p>
        <p><strong>Look for: </strong>{feature.lookFor}</p>
        <p className="judge-notice"><strong>Under the hood: </strong>{feature.technical}</p>
        <a className="secondary-btn" href={feature.url}>Try {feature.name} <ArrowUpRight size={14} /></a>
      </section>)}
    </section>
    <section className="judge-company" id="company-walkthrough" aria-labelledby="judge-company-title">
      <details>
      <summary>Optional: helping others explore and the partnership vision</summary>
      <div className="judge-company-heading">
        <span className="eyebrow">Optional extension · help others explore</span>
        <h2 id="judge-company-title">A company occasion, an individual’s taste.</h2>
        <p>For a quick review, follow the numbered product walkthrough below. With extra time, try helping a hotel guest or wedding visitor explore, using the same discovery tools.</p>
      </div>
      <div className="judge-company-links">
        <a href="/companies#company-walkthrough">Open the company showcase <ArrowUpRight size={14} /></a>
        <a href="/companies/discover?type=hospitality">Try hotel guest discovery <ArrowUpRight size={14} /></a>
        <a href="/companies/lab?type=hospitality">Compare in the hospitality Lab <ArrowUpRight size={14} /></a>
        <a href="/companies/discover?type=celebrations">See destination celebrations <ArrowUpRight size={14} /></a>
      </div>
      <ol className="judge-company-steps">
        <li><strong>Meet the guest.</strong> Open hotel guest discovery: New Orleans, a free afternoon before a show, Nina Simone and Amélie. Change the example interests, pace or return-time needs to suit the visitor.</li>
        <li><strong>See Qloo at work.</strong> Use the shared Demo or your own Qloo connection, then select “Explore with Qloo.” Wait for “Live Qloo · response received” and open a result without leaving the page.</li>
        <li><strong>Make it useful.</strong> Uncover a hidden gem, open a category search in Maps, or print/download the recommendations. The day planner and hospitality Lab offer a longer exploration: build a flexible plan or compare branches from the same checkpoint.</li>
      </ol>
      <p className="judge-company-note"><strong>Available today:</strong> editable company examples using the existing Qloo connection and discovery tools. These are not shared company workspaces. External company API, widget and MCP access are <strong>planned—not available yet</strong>; company-branded guest experiences are a potential business model, not existing customer contracts.</p>
      <p className="judge-company-note"><strong>Business model:</strong> free discovery for individuals, with planned company-funded branded experiences, clearly labeled sponsorships and referral partnerships. Advertising, attribution and paid integrations are not live. <a href="/partners">Read the partnership and investor story.</a></p>
      </details>
    </section>
    <section className={`judge-status ${status?.qlooConfigured ? "configured" : ""}`} aria-label="Qloo configuration status" aria-live="polite">
      <strong><Info size={16} />{status?.qlooConfigured ? "Qloo is configured on this server" : status ? "Live Qloo is not configured on this server" : statusError ? "Qloo configuration status is unavailable" : "Checking Qloo configuration…"}</strong>
      <p>{status?.qlooConfigured
        ? "Configuration is not a completed retrieval. Confirm “Live Qloo · response received” after an actual request. This guide is instructions, not evidence that live requests have passed."
        : status
          ? "The live steps below require Qloo configuration. “Try prepared examples” offers a separate authored experience, not proof of live Qloo retrieval."
           : "The live steps below require a configured server and successful Qloo requests. Do not assume Live is available until its status is confirmed."} No account is required to explore. Guest saves and Lab histories stay in this browser; signed-in saved doors can sync across devices.</p>
    </section>
    <ol className="judge-steps">
      {STEPS.map((step, index) => <li className="judge-step" id={`judge-step-${index + 1}`} key={step.title}>
        <div className="judge-step-heading">
          <span className="judge-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <div><span className="judge-time"><Clock3 size={12} /> {step.time}</span><h2>{step.title}</h2></div>
        </div>
        <ol>{step.actions.map(action => <li key={action}>{action}</li>)}</ol>
        <p className="judge-notice"><strong>What to notice: </strong>{step.notice}</p>
      </li>)}
    </ol>
    <nav className="judge-actions" aria-label="Try the new discovery experiences">
      <a className="secondary-btn" href="/?view=taste-bridge">Try Taste Bridge</a>
      <a className="secondary-btn" href="/?view=what-if">Try What If? Explorer</a>
      <a className="secondary-btn" href="/?view=debate">Try Discovery Debate</a>
    </nav>
    <section className="judge-takeaway">
      <h2>The key takeaway</h2>
      <p>Qloo supplies retrieved cultural connections—not just plausible prose. Open Door makes those connections inspectable, organizes them into directions, and lets people choose what to continue.</p>
    </section>
  </article>;
}
