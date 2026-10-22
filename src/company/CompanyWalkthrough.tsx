import { Link } from "wouter";
import { companyUrl } from "./profiles";

const hospitalityDiscovery = companyUrl("discover", "hospitality");
const hospitalityLab = companyUrl("lab", "hospitality");
const celebrationDiscovery = companyUrl("discover", "celebrations");

export default function CompanyWalkthrough() {
  return <section className="company-walkthrough" id="company-walkthrough" aria-labelledby="company-walkthrough-title">
    <div className="company-walkthrough-heading">
      <div>
        <span className="company-eyebrow">Featured company walkthrough · about 90 seconds</span>
        <h2 id="company-walkthrough-title">A free afternoon before the show.</h2>
      </div>
      <p>A hotel guest has a few hours in New Orleans before an evening performance. They choose the interests; Qloo retrieves cultural connections; Open Door shapes them into a starting point—not a prewritten popularity list.</p>
    </div>

    <div className="company-walkthrough-story">
      <div className="company-walkthrough-origin">
        <span className="company-walkthrough-marker" aria-hidden="true">01</span>
        <div>
          <span className="company-walkthrough-kicker">The company supplies the occasion</span>
          <h3>Short stay. Evening plans. Time to explore.</h3>
          <p>The hotel context suggests a place and a useful time window. The guest chooses which interests, access needs, pace and other preferences to share.</p>
        </div>
      </div>
      <div className="company-walkthrough-divider" aria-hidden="true"><span /></div>
      <div className="company-walkthrough-origin guest">
        <span className="company-walkthrough-marker" aria-hidden="true">02</span>
        <div>
          <span className="company-walkthrough-kicker">The person chooses the interests</span>
          <h3>Follow their own cultural thread.</h3>
          <p>Open the hospitality discovery flow. Adjust the example tastes, time and access context, then explore with the shared Demo Qloo API connection or your own Qloo connection. Prepared examples are a separate authored sample.</p>
        </div>
      </div>
    </div>

    <div className="company-walkthrough-actions">
      <Link className="company-button" href={hospitalityDiscovery}>Try hotel guest discovery <span aria-hidden="true">→</span></Link>
      <Link className="company-button secondary" href={hospitalityLab}>Compare ideas in the Lab</Link>
      <Link className="company-text-button" href={celebrationDiscovery}>See the destination celebration example</Link>
    </div>

    <div className="company-walkthrough-details">
      <article className="company-walkthrough-detail">
        <span className="company-walkthrough-detail-index">IN DISCOVERY</span>
        <h3>From a result to a real next step</h3>
        <p>Qloo supplies cultural entities, not verified venues. Open a result without leaving the page, uncover a hidden gem activity, search Maps by category, or shape a flexible day plan. Print or download a Word document. Save in this browser, or sign in to sync saved doors across devices.</p>
      </article>
      <article className="company-walkthrough-detail">
        <span className="company-walkthrough-detail-index">IN THE LAB</span>
        <h3>Fork a thought, then compare</h3>
        <p>Use a checkpoint to branch from a shared starting point and compare what differs across the paths. It is a way to examine ideas—not a promise that results will be distinct or successful.</p>
      </article>
    </div>

    <p className="company-walkthrough-boundary">
      Results are cultural entities and ideas, not verified nearby venues, event listings, bookings or availability. Maps opens a category search; independently check location, hours, access, travel and availability.
    </p>
    <div className="company-roadmap">
      <div>
        <span className="company-roadmap-label">Planned—not available yet</span>
        <p>The shared or personal Qloo API connection works today. Next, companies could bring Open Door into their own websites through an API or embedded widget, or let a compatible AI concierge call its tools through MCP. These external company connections are not available yet.</p>
      </div>
      <p>A possible business model: company-branded guest experiences, with visitors in control of their own preferences. Today’s themed examples are not shared company workspaces or existing customer deployments.</p>
    </div>
  </section>;
}
