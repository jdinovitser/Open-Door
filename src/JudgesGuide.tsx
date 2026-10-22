import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, Copy, Info } from "lucide-react";
import type { AgentStatus } from "./agentApi";
import "./JudgesGuide.css";

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
    notice: "Qloo Search resolves the supplied interests; multiple Insights requests retrieve connected candidates. Open Door organizes the results into directions. The route labels are not Qloo confidence scores, and cultural entities are not verified venue listings or bookings.",
  },
  {
    title: "Turn a result into another exploration",
    time: "1:30–2:15",
    actions: [
      "Open a returned door to read its recommendation in place, then optionally choose “Explore this thread.”",
      "The selected Qloo entity becomes the next anchor for another live exploration. Inspect the new journey’s evidence.",
    ],
    notice: "This is a stateful discovery workflow, not a one-shot recommendation page. A returned entity ID becomes an input to the next retrieval step instead of being discarded and re-searched as plain text.",
  },
  {
    title: "Explore two possible futures",
    time: "2:15–3:45",
    actions: [
      "Choose “Explore in Discovery Lab” from the live journey. This preserves its source mode; the Lab’s fresh-start form instead begins a clearly labeled Demo journey.",
      "Select “Save checkpoint” and name it “My starting point.”",
      "Choose “Follow the Thread,” then “Open this door.” Review the results and mark one Keep.",
      "Restore “My starting point” from the branch map. Choose “Take the Wild Door,” then “Open this door” again.",
    ],
    notice: "Both branches begin from the same saved state. The second path does not overwrite the first path’s discoveries or feedback. Strategies change retrieval direction; they do not manufacture a novelty score or guarantee disjoint results.",
  },
  {
    title: "Compare, choose, and return",
    time: "3:45–4:45",
    actions: [
      "Find “Compare branches.” Select “My starting point” under “Shared checkpoint,” then select both sibling branches.",
      "Compare discoveries, explanations, source information, conditions, and feedback. Favorite a branch and resume the path you prefer.",
      "Reload the page to confirm the saved exploration remains available.",
    ],
    notice: "Discovery is reversible: an unexpected direction does not erase the familiar path. Histories are browser-local. Reloading restores completed work; it does not present a stored response as a newly executed live request.",
  },
  {
    title: "See the product behind the workflow",
    time: "4:45–5:00",
    actions: [
      "Visit How it works for the architecture and evidence boundaries, or Trust for privacy and browser-data controls.",
      "Try the optional header sound control, animation pause buttons, or a narrow screen. Reduced-motion preferences use still artwork.",
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
      <span className="eyebrow">Open Door · five-minute walkthrough</span>
      <h1 id="judges-title">Judge’s Guide</h1>
      <p>Explore unfamiliar places through the culture you already love. Follow this walkthrough to inspect Qloo’s contribution, continue a discovery, and compare independent paths in the Discovery Lab.</p>
      <div className="judge-actions">
        <a className="primary-btn" href="/" target="_blank" rel="noopener noreferrer">Open app in a new tab <ArrowUpRight size={16} /></a>
        <button className="secondary-btn" type="button" onClick={() => void copyLink()}><Copy size={15} /> Copy this guide’s link</button>
      </div>
      <p className="judge-copy-status" role="status">{copyStatus}</p>
    </header>
    <section className={`judge-status ${status?.qlooConfigured ? "configured" : ""}`} aria-label="Qloo configuration status" aria-live="polite">
      <strong><Info size={16} />{status?.qlooConfigured ? "Qloo is configured on this server" : status ? "Live Qloo is not configured on this server" : statusError ? "Qloo configuration status is unavailable" : "Checking Qloo configuration…"}</strong>
      <p>{status?.qlooConfigured
        ? "Configuration is not a completed retrieval. Confirm “Live Qloo · response received” after an actual request. This guide is instructions, not evidence that live requests have passed."
        : status
          ? "The live steps below require Qloo configuration. You can explore the clearly labeled Demo experience, but authored samples are not proof of a live Qloo integration."
          : "The live steps below require a configured server and successful Qloo requests. Do not assume Live is available until its status is confirmed."} No account is required. Saved work stays in this browser.</p>
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
    <section className="judge-takeaway">
      <h2>The key takeaway</h2>
      <p>Qloo supplies the cultural grounding. Open Door turns that grounding into an exploration people can understand, control, and continue.</p>
    </section>
  </article>;
}
