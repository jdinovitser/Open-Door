import { useEffect } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { ProductAvenues, ProductHeader } from "../ProductHeader";
import { CompanyMascot } from "./CompanyMascot";
import "./company.css";
import "./partnerships.css";
import "./partnership-revenue.css";

const partnershipModels = [
  {
    number: "01",
    title: "Branded guest experiences",
    description: "A company could fund a tailored Open Door experience for a guest, traveler, future resident or celebration. The person still chooses which interests and practical needs to share.",
    label: "Potential subscription or paid pilot",
  },
  {
    number: "02",
    title: "Clearly labeled sponsorship",
    description: "A partner could sponsor a defined placement, including cost-per-click sponsorship. Any paid placement would be marked as sponsored and kept distinct from Qloo-grounded recommendations.",
    label: "Potential placement model",
  },
  {
    number: "03",
    title: "Agreed referral arrangements",
    description: "Where a partner and Open Door agree terms, a referral or conversion fee could be considered. A link is not a booking, and no commission is automatic or guaranteed.",
    label: "Potential agreed fee",
  },
];

const sectors = [
  { number: "01", title: "Hotels & hospitality", detail: "A guest’s occasion can set the scene; their own interests shape what they explore." },
  { number: "02", title: "Airlines & travel", detail: "Give a destination or layover a human starting point, without prescribing a single itinerary." },
  { number: "03", title: "Real estate", detail: "Help prospective neighbors discover cultural threads around a place as they consider a move." },
  { number: "04", title: "Weddings & events", detail: "Offer guests a way to find their own kind of discovery around a shared gathering." },
];

const roadmap = [
  "Prove guest value through real, opt-in use.",
  "Recruit paid pilots with carefully scoped partners.",
  "Measure opt-in usage, retention and partner-referred activity—with appropriate permissions and implemented analytics.",
  "Expand through APIs, widgets or MCP only when the experience and operating model are validated.",
];

export default function Partnerships() {
  const { isSignedIn } = useUser();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Partnerships & Business Model | Open Door";
    return () => { document.title = previousTitle; };
  }, []);

  return <div className="company-portal partnerships-page">
    <ProductHeader view="companies" signedIn={Boolean(isSignedIn)} />
    <ProductAvenues active="company" />

    <main className="company-shell partnerships-main">
      <nav className="company-local-nav partnerships-local-nav" aria-label="Partnership page sections">
        <a href="#model">Business model</a>
        <a href="#today">Today &amp; next</a>
        <a href="#trust">Trust boundaries</a>
        <a href="#investors">Investor conversations</a>
      </nav>

      <section className="partnerships-hero" aria-labelledby="partnerships-title">
        <div className="partnerships-hero-copy">
          <span className="company-eyebrow">Open Door · Partnerships</span>
          <h1 id="partnerships-title">Free for explorers.<br /><em>Built for company partnerships.</em></h1>
          <p>Open Door is a warm cultural field guide, grounded in Qloo’s taste graph. Companies bring the occasion. People stay in control of what they choose to explore.</p>
          <div className="partnerships-hero-actions">
            <Link className="company-button" href="/?explore=1">Explore for free <span aria-hidden="true">→</span></Link>
            <Link className="company-button secondary" href="/companies?inquiry=partnership#inquiry">Discuss a partnership</Link>
          </div>
          <p className="partnerships-hero-note">Individual discovery is free today. Planned revenue is company-funded—not a charge to explorers.</p>
        </div>
        <div className="partnerships-hero-art">
          <span className="partnerships-art-caption">One guide · two ways in</span>
          <CompanyMascot companyType="hospitality" priority />
          <div className="partnerships-art-footer"><span>01 / Explore for yourself</span><span>02 / Help others explore</span></div>
        </div>
        <div className="partnerships-principle">
          <span className="partnerships-principle-index">THE PRODUCT PRINCIPLE</span>
          <p>Companies supply <strong>context</strong>—a destination, event or welcome. Each person brings their own <strong>tastes and needs</strong>.</p>
        </div>
      </section>

      <section className="partnerships-model" id="model" aria-labelledby="model-title">
        <div className="partnerships-section-heading">
          <div><span className="company-eyebrow">A business model with a clear boundary</span><h2 id="model-title">The company funds the welcome.<br /><em>The explorer owns the journey.</em></h2></div>
          <p>Qloo’s cultural intelligence is the differentiator: named interests can lead to cultural connections through its taste graph. Open Door shapes those connections into a field guide, not a paid ranking.</p>
        </div>
        <div className="partnerships-model-flow" aria-label="How a partnership could work">
          <article className="partnerships-flow-step">
            <span className="partnerships-step-number">01</span>
            <span className="partnerships-step-label">COMPANY CONTEXT</span>
            <h3>Bring the occasion</h3>
            <p>A hotel stay, a trip, a possible new neighborhood or a gathering gives discovery a useful starting point.</p>
          </article>
          <span className="partnerships-flow-connector" aria-hidden="true"><span /></span>
          <article className="partnerships-flow-step is-personal">
            <span className="partnerships-step-number">02</span>
            <span className="partnerships-step-label">PERSONAL CHOICE</span>
            <h3>Let people choose</h3>
            <p>Explorers decide which interests and practical needs to share, then follow their own cultural threads.</p>
          </article>
          <span className="partnerships-flow-connector" aria-hidden="true"><span /></span>
          <article className="partnerships-flow-step is-qloo">
            <span className="partnerships-step-number">03</span>
            <span className="partnerships-step-label">CULTURAL INTELLIGENCE</span>
            <h3>Ground the connections</h3>
            <p>Qloo’s taste graph informs cultural discovery. Open Door turns the results into paths to explore, compare and make your own.</p>
          </article>
        </div>
        <div className="partnerships-revenue-heading"><span className="company-eyebrow">Proposed revenue streams · not live</span><h3>What companies would pay for</h3></div>
        <div className="partnerships-revenue-grid">
          {partnershipModels.map(model => <article key={model.number}>
            <span className="company-eyebrow">{model.number} / {model.label}</span>
            <h4>{model.title}</h4><p>{model.description}</p>
          </article>)}
        </div>
        <p className="partnerships-footnote">A cultural connection is a starting point—not a verification of venue, event, availability or fit for every person.</p>
      </section>

      <section className="partnerships-sectors" aria-labelledby="sectors-title">
        <div className="partnerships-section-heading">
          <div><span className="company-eyebrow">Illustrative partner sectors</span><h2 id="sectors-title">Different occasions.<br /><em>One coherent product.</em></h2></div>
          <p>These are potential partnership contexts, not connected brands, customers or deployments.</p>
        </div>
        <div className="partnerships-sector-list">
          {sectors.map(sector => <article className="partnerships-sector" key={sector.number}>
            <span className="partnerships-sector-number">{sector.number}</span>
            <h3>{sector.title}</h3>
            <p>{sector.detail}</p>
            <span className="partnerships-sector-mark" aria-hidden="true">↗</span>
          </article>)}
        </div>
      </section>

      <section className="partnerships-boundaries" id="today" aria-labelledby="today-title">
        <div className="partnerships-boundary-heading">
          <span className="company-eyebrow">Honest about what exists</span>
          <h2 id="today-title">Working today.<br /><em>Planned for partners.</em></h2>
          <p>The distinction matters: a useful live product can be explored now, while commercial delivery and measurement still need to be built and validated.</p>
          <Link className="company-text-button" href="/companies">See the company experience <span aria-hidden="true">→</span></Link>
        </div>
        <div className="partnerships-state-columns">
          <article className="partnerships-state is-live">
            <div className="partnerships-state-head"><span className="partnerships-state-dot" aria-hidden="true" /><span>WORKING TODAY</span></div>
            <h3>Discovery you can try</h3>
            <ul>
              <li>Free individual cultural discovery.</li>
              <li>Illustrative company occasion examples and shareable guest links.</li>
              <li>Qloo-grounded discovery when connected, with personal choice at the center.</li>
              <li>Actual partnership inquiries through the existing intake.</li>
            </ul>
            <Link className="company-button secondary" href="/companies/discover?type=hospitality">Try the hotel experience <span aria-hidden="true">→</span></Link>
          </article>
          <article className="partnerships-state is-planned">
            <div className="partnerships-state-head"><span className="partnerships-state-dash" aria-hidden="true" /><span>PLANNED COMMERCIAL FEATURES</span></div>
            <h3>Possible—not live yet</h3>
            <ul>
              <li>Company-branded paid experiences or licensing, including scoped pilots.</li>
              <li>Clearly labeled placements and cost-per-click sponsorship.</li>
              <li>Agreed referral or conversion fees, with terms disclosed.</li>
              <li>Partner attribution and reporting, subject to implementation, permissions and measurement design.</li>
              <li>External company API, widget or MCP access.</li>
            </ul>
            <p>There is no checkout, ad delivery, partner integration or conversion measurement on this page.</p>
          </article>
        </div>
      </section>

      <section className="partnerships-trust" id="trust" aria-labelledby="trust-title">
        <div className="partnerships-trust-heading">
          <span className="company-eyebrow">The trust contract</span>
          <h2 id="trust-title">Payment is not<br /><em>proof of cultural fit.</em></h2>
          <p>A partnership can support discovery without deciding what is recommended—or taking ownership of what a person shares.</p>
        </div>
        <div className="partnerships-trust-list">
          <article><span>01</span><div><h3>Keep sponsored distinct</h3><p>Any future sponsored placement must be clearly labeled and separated from Qloo-grounded recommendations. Payment will never be presented as evidence of cultural relevance.</p></div></article>
          <article><span>02</span><div><h3>Keep personal data personal</h3><p>We do not propose selling or sharing private age, health or preference information, or people’s personal saved doors, as a revenue model.</p></div></article>
          <article><span>03</span><div><h3>Make referrals plain</h3><p>Any referral relationship would be disclosed at the link. There is no automatic redirection and no guaranteed commission.</p></div></article>
          <article><span>04</span><div><h3>Make campaign links useful, not intrusive</h3><p>Planned outbound links could use UTM partner and campaign tags to identify referred visits. Tags would not contain a person’s age, health, private preferences or saved doors. A tagged click is not proof of a booking: reporting would require implemented analytics, appropriate permissions and agreed attribution terms.</p></div></article>
        </div>
        <div className="partnerships-privacy-note"><span className="partnerships-privacy-mark" aria-hidden="true">i</span><p><strong>A roadmap, not an ad network.</strong> This page introduces no advertising or referral tracking. Commercial pilots would need agreed partner terms, applicable Qloo usage rights and privacy safeguards.</p></div>
      </section>

      <section className="partnerships-investor" id="investors" aria-labelledby="investor-title">
        <div className="partnerships-investor-topline"><span className="company-eyebrow">For investors &amp; potential collaborators</span><span className="partnerships-investor-note">A practical path to learn</span></div>
        <div className="partnerships-investor-content">
          <div>
            <h2 id="investor-title">Prove the guest value.<br /><em>Build the partnerships.</em></h2>
            <p>Open Door’s next business-model questions should be answered with use, not promises: does this help people explore, and will organizations fund that welcome?</p>
          </div>
          <ol className="partnerships-roadmap">
            {roadmap.map((item, index) => <li key={item}><span>0{index + 1}</span><p>{item}</p></li>)}
          </ol>
        </div>
        <div className="partnerships-investor-footer">
          <p>Investor conversations are welcome; this is not an investment offer. Pilot pricing and commercial terms would be agreed with partners, not presented as existing revenue or projected returns.</p>
          <Link className="company-button" href="/companies?type=other&inquiry=investment#inquiry">Investor conversation <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section className="partnerships-last-call" aria-labelledby="partnerships-next-title">
        <span className="company-eyebrow">Begin with a conversation—or a discovery</span>
        <h2 id="partnerships-next-title">A better welcome starts<br /><em>with room to choose.</em></h2>
        <div className="partnerships-hero-actions">
          <Link className="company-button" href="/?explore=1">Explore for free <span aria-hidden="true">→</span></Link>
          <Link className="company-button secondary" href="/companies?inquiry=partnership#inquiry">Discuss a partnership</Link>
        </div>
      </section>
    </main>

    <footer className="company-footer partnerships-footer">
      <div className="company-shell company-footer-inner">
        <p>Open Door · Cultural discovery, led by individual taste.</p>
        <nav aria-label="Footer links">
          <Link href="/companies">For companies</Link>
          <Link href="/judges">Judge’s Guide</Link>
        </nav>
      </div>
    </footer>
  </div>;
}
