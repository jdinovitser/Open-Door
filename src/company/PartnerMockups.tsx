import { useRef, useState, type KeyboardEvent } from "react";
import "./partner-mockups.css";

const scenarios = [
  {
    id: "weddings",
    tab: "Destination weddings",
    title: "A wedding weekend, with space for each guest",
    occasion: "Destination wedding · time between celebrations",
    intro: "The shared occasion gives guests a starting point; they remain free to shape their own time around it.",
    type: "celebrations",
    tryLabel: "Try the wedding discovery example",
    inquiryType: "celebrations",
    sponsors: [
      { id: "dining", name: "YOUR Dining", role: "A meal between events", benefit: "A possible place to plan a relaxed meal around the wedding schedule.", imageDescription: "dining scene" },
      { id: "hotel", name: "YOUR Hotel", role: "A place to stay", benefit: "A lodging option to consider as guests plan their time at the destination.", imageDescription: "hotel interior" },
      { id: "photography", name: "YOUR Photography", role: "A photography service", benefit: "A possible contact for portraits or personal moments during the wedding weekend.", imageDescription: "wedding photography" },
      { id: "hair", name: "YOUR Hair Salon", role: "A getting-ready stop", benefit: "A place guests could consider for hair styling before a celebration.", imageDescription: "hair salon" },
      { id: "makeup", name: "YOUR Makeup Artist", role: "A getting-ready service", benefit: "A possible option for guests preparing for a wedding event.", imageDescription: "makeup station" },
      { id: "limo", name: "YOUR Limo", role: "A transport option", benefit: "A possible way to think about group travel between wedding plans.", imageDescription: "chauffeured car" },
    ],
  },
  {
    id: "neighborhoods",
    tab: "Real estate & neighbors",
    title: "Getting a feel for a possible new neighborhood",
    occasion: "Considering a move · exploring the area",
    intro: "A future neighbor can picture everyday life through a few useful local starting points.",
    type: "real-estate",
    tryLabel: "Try the neighborhood discovery example",
    inquiryType: "real-estate",
    sponsors: [
      { id: "bnb", name: "YOUR Bed and Breakfast", role: "A place to stay", benefit: "A possible overnight base while getting to know the neighborhood in person.", imageDescription: "bed and breakfast room" },
      { id: "dining", name: "YOUR Dining", role: "A local table", benefit: "A place to consider for a meal while exploring the area's everyday rhythms.", imageDescription: "dining scene" },
      { id: "art", name: "YOUR Art Club", role: "A creative gathering", benefit: "A potential way to find an art-minded community and make the area feel more familiar.", imageDescription: "art studio" },
      { id: "skating", name: "YOUR Skating Rink", role: "A recreational stop", benefit: "A local activity to consider when imagining what free time nearby could look like.", imageDescription: "ice skating rink" },
    ],
  },
  {
    id: "hotels",
    tab: "Hotels & venues",
    title: "A destination or business trip, with room to explore",
    occasion: "Destination travel · business visits · time between plans",
    intro: "A guest starts with the practical details, then chooses what kind of local discovery feels right.",
    type: "hospitality",
    tryLabel: "Try the hotel discovery example",
    inquiryType: "hospitality",
    sponsors: [
      { id: "hotel", name: "YOUR Hotel", role: "Featured hotel chain", benefit: "A hotel-chain placement offering a home base for destination or business travel.", imageDescription: "hotel interior" },
      { id: "dining", name: "YOUR Dining", role: "Featured dining chain", benefit: "A restaurant-chain placement for dinner between plans, whether guests are traveling solo, with friends or with colleagues.", imageDescription: "dining scene" },
      { id: "venue", name: "YOUR Venue", role: "A meeting & event space", benefit: "A potential setting to consider for a team gathering or a meeting during the visit.", imageDescription: "event venue" },
    ],
  },
] as const;

type Sponsor = (typeof scenarios)[number]["sponsors"][number];
const imagePath = (key: string) => `/partner-previews/${key}.webp`;

export default function PartnerMockups() {
  const [activeId, setActiveId] = useState<string>(scenarios[0].id);
  const [selectedSponsorId, setSelectedSponsorId] = useState<string>(scenarios[0].sponsors[0].id);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = scenarios.find(scenario => scenario.id === activeId) ?? scenarios[0];
  const selectedSponsor = active.sponsors.find(sponsor => sponsor.id === selectedSponsorId) ?? active.sponsors[0];

  function chooseScenario(index: number) {
    const scenario = scenarios[index];
    setActiveId(scenario.id);
    setSelectedSponsorId(scenario.sponsors[0].id);
    setDetailsOpen(false);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % scenarios.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + scenarios.length) % scenarios.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = scenarios.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    chooseScenario(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  }

  function chooseSponsor(sponsor: Sponsor) {
    setSelectedSponsorId(sponsor.id);
    setDetailsOpen(false);
  }

  return <section className="partner-mockups" id="partner-mockups" aria-labelledby="partner-mockups-title">
    <div className="partner-mockups-heading">
      <div>
        <span className="company-eyebrow">A possible place for partnership</span>
        <h2 id="partner-mockups-title">Imagine your company in the experience</h2>
      </div>
      <p>Open Door is one product for individual explorers and company guests. Individual discovery is free; planned revenue is company-funded. See how a clearly labeled partner could have a visible place in the guest experience.</p>
    </div>

    <div className="partner-mockups-tabs" role="tablist" aria-label="Company guest experience examples">
      {scenarios.map((scenario, index) => <button
        key={scenario.id}
        ref={element => { tabRefs.current[index] = element; }}
        className="partner-mockups-tab"
        id={`partner-tab-${scenario.id}`}
        type="button"
        role="tab"
        aria-selected={active.id === scenario.id}
        aria-controls="partner-experience-panel"
        tabIndex={active.id === scenario.id ? 0 : -1}
        onClick={() => chooseScenario(index)}
        onKeyDown={event => handleTabKeyDown(event, index)}
      >{scenario.tab}</button>)}
    </div>

    <div className="partner-mockups-preview">
      <div
        className="partner-mockups-panel"
        id="partner-experience-panel"
        role="tabpanel"
        aria-labelledby={`partner-tab-${active.id}`}
        tabIndex={0}
      >
        <div className="partner-mockups-experience">
          <div className="partner-mockups-experience-top">
            <span className="partner-mockups-product">Open Door <span aria-hidden="true">/</span> Guest guide</span>
            <span className="partner-mockups-demo">Illustrative preview</span>
          </div>
          <div className="partner-mockups-occasion">
            <span className="partner-mockups-overline">Your occasion</span>
            <h3>{active.title}</h3>
            <p>{active.occasion}</p>
            <span className="partner-mockups-context">{active.intro}</span>
          </div>

          <section className="partner-mockups-featured" data-guest-featured aria-label="Guest-facing partner preview">
            <div className="partner-mockups-featured-heading">
              <span className="partner-mockups-featured-kicker">Featured partner for your plans</span>
              <span className="partner-mockups-fictional">Fictional mockup</span>
            </div>
            <figure className="partner-mockups-featured-image">
              <img
                src={imagePath(selectedSponsor.id)}
                alt={`Illustrative stock photo of a ${selectedSponsor.imageDescription}; it does not depict ${selectedSponsor.name}.`}
              />
              <figcaption>Illustrative photo · fictional business and placement</figcaption>
            </figure>
            <div className="partner-mockups-featured-copy">
              <span className="partner-mockups-sponsor-tag">Sponsored · mockup</span>
              <h4>{selectedSponsor.name}</h4>
              <span className="partner-mockups-sponsor-role">{selectedSponsor.role}</span>
              <p>{selectedSponsor.benefit}</p>
              <div className="partner-mockups-featured-callout">
                <span className="partner-mockups-callout-mark" aria-hidden="true" />
                <span>Try our partner</span>
                <span className="partner-mockups-callout-detail">A visible, company-funded option within the guest guide.</span>
              </div>
              <button
                className="partner-mockups-detail-toggle"
                type="button"
                aria-expanded={detailsOpen}
                aria-controls="partner-sponsor-details"
                onClick={() => setDetailsOpen(open => !open)}
              >{detailsOpen ? "Hide partner details" : "See partner details"}</button>
            </div>
            <div className="partner-mockups-detail-panel" id="partner-sponsor-details" role="region" aria-label={`${selectedSponsor.name} example details`} hidden={!detailsOpen}>
              <strong>A useful starting point</strong>
              <p>{selectedSponsor.benefit} A live placement could link to your chosen partner page; no business is linked in this preview.</p>
            </div>
          </section>

          <div className="partner-mockups-discovery">
            <div className="partner-mockups-discovery-mark" aria-hidden="true"><span /><span /><span /></div>
            <div>
              <span className="partner-mockups-overline">Independent cultural discovery</span>
              <h4>Follow what feels like you.</h4>
              <p>In a live experience, Qloo-informed cultural recommendations would remain independent from sponsored placements. No Qloo results are shown in this mockup.</p>
            </div>
          </div>

          <div className="partner-mockups-sponsors">
            <div className="partner-mockups-sponsors-heading">
              <div><span className="partner-mockups-overline">Choose your path</span><h4>Partner options for this occasion</h4></div>
              <span className="partner-mockups-fictional">Fictional mockups</span>
            </div>
            <div className="partner-mockups-sponsor-list">
              {active.sponsors.map((sponsor, index) => <article
                className={`partner-mockups-sponsor${selectedSponsor.id === sponsor.id ? " is-selected" : ""}`}
                data-sponsor={sponsor.name}
                key={sponsor.name}
              >
                <button
                  className="partner-mockups-sponsor-select"
                  type="button"
                  aria-pressed={selectedSponsor.id === sponsor.id}
                  aria-label={`${sponsor.name}, ${sponsor.role}. ${sponsor.benefit}`}
                  onClick={() => chooseSponsor(sponsor)}
                >
                  <img className="partner-mockups-sponsor-thumb" src={imagePath(sponsor.id)} alt="" loading="lazy" />
                  <span className="partner-mockups-sponsor-copy">
                    <span className="partner-mockups-sponsor-order" aria-hidden="true">0{index + 1} <span>·</span> {sponsor.role}</span>
                    <span className="partner-mockups-sponsor-title">{sponsor.name}</span>
                    <span className="partner-mockups-sponsor-tag">Sponsored · mockup</span>
                    <span className="partner-mockups-sponsor-benefit">{sponsor.benefit}</span>
                  </span>
                  <span className="partner-mockups-sponsor-status" aria-hidden="true">{selectedSponsor.id === sponsor.id ? "Selected" : "View option"}</span>
                </button>
              </article>)}
            </div>
            <p className="partner-mockups-photo-note">Photos are illustrative; businesses and placements are fictional. <a href="/partner-previews/CREDITS.txt">Photo credits</a>.</p>
          </div>
        </div>
      </div>
      <aside className="partner-mockups-side-note" aria-label="About this preview">
        <span className="partner-mockups-note-index">A clear line</span>
        <h3>Sponsored is not a recommendation.</h3>
        <p>Every example name and placement here is fictional—not a current partner, live ad, Qloo result, or endorsement. Explorers choose which partner option to preview; this selection does not affect independent cultural discovery.</p>
        <div className="partner-mockups-line-key"><span className="partner-mockups-key-swatch sponsored" />Clearly labeled company placement</div>
        <div className="partner-mockups-line-key"><span className="partner-mockups-key-swatch discovery" />Independent cultural discovery</div>
        <p className="partner-mockups-commercial-note">A branded placement could offer a visible introduction and, in a future live experience, an optional link to the partner’s own page. No partner link or campaign measurement is active here.</p>
      </aside>
    </div>

    <div className="partner-mockups-actions">
      <p>These discovery links open the real example flow; they do not include these fictional sponsors.</p>
      <div className="partner-mockups-action-links">
        <a className="company-button" href={`/?explore=1&audience=company&type=${active.type}#company-tools`}>{active.tryLabel} <span aria-hidden="true">→</span></a>
        <a className="company-button secondary" href={`/contact?type=${active.inquiryType}&inquiry=partnership#inquiry`}>Discuss this partnership</a>
      </div>
    </div>
    <p className="partner-mockups-footnote">Company-funded placements are a planned partnership model. Open Door remains free for individual explorers.</p>
  </section>;
}
