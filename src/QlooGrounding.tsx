import { Network, ArrowRight } from "lucide-react";
import "./qloo-grounding.css";

type Props = {
  mode?: "demo" | "live";
  configured?: boolean;
  received?: boolean;
  compact?: boolean;
};

/** Explains the existing provider boundary; never treats configuration as retrieval. */
export function QlooGrounding({ mode, configured, received = false, compact = false }: Props) {
  const state = mode === "demo" ? "sample" : received ? "received" : mode === undefined
    ? "overview" : configured === true ? "ready" : configured === false ? "unavailable" : "checking";
  const labels = {
    overview: "Cultural intelligence, powered by Qloo",
    sample: "Prepared examples · not Qloo results",
    received: "Qloo response received · source details available",
    ready: "Qloo connection available · explore to retrieve results",
    unavailable: "A Qloo connection is needed for live discovery",
    checking: "Checking Qloo connection availability",
  };
  return <section className={`qloo-grounding${compact ? " is-compact" : ""}`} data-qloo-grounding={state} aria-label="How Qloo grounds discovery">
    <div className="qloo-grounding-title">
      <span className="qloo-grounding-mark"><Network size={19} aria-hidden="true" /><strong>Qloo</strong><span>Cultural intelligence</span></span>
      <span className="qloo-grounding-state">{labels[state]}</span>
    </div>
    <h2>{mode === "demo" ? "Try the journey. Discover the difference with Qloo." : "Your taste starts it. Qloo grounds it."}</h2>
    <p>{mode === "demo"
      ? "This sample illustrates Open Door’s tools. Switch to a Qloo connection to retrieve cultural relationships through its taste graph—prepared activities are not evidence of those relationships."
      : "In live discovery, Qloo Search identifies the cultural interests you name. Qloo Insights retrieves connected recommendations from its taste graph. Open Door turns those results into paths you can explore, compare and make your own."}</p>
    {!compact && <ol className="qloo-grounding-flow">
      <li><span>01</span><div><strong>You name what you love</strong><small>Explicit interests, not an assumed identity.</small></div></li>
      <li><ArrowRight size={16} aria-hidden="true" /><div><strong>Qloo finds cultural connections</strong><small>Search + Insights ground live discovery.</small></div></li>
      <li><ArrowRight size={16} aria-hidden="true" /><div><strong>Open Door helps you act</strong><small>Explore, compare, plan and save.</small></div></li>
    </ol>}
  </section>;
}
