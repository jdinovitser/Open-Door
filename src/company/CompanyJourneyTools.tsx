import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "wouter";
import { COMPANY_PROFILES, companyProfile, type CompanyProfile, type CompanyType } from "./profiles";
import { companyExperienceUrl, readPublicOccasion } from "./experienceContext";
import CompanyWalkthrough from "./CompanyWalkthrough";
import "./company-journey-tools.css";

type JourneyView = "discover" | "lab";

function initialType(profile: CompanyProfile | undefined): CompanyType {
  if (profile) return profile.id;
  if (typeof window !== "undefined") {
    const candidate = new URLSearchParams(window.location.search).get("type");
    if (COMPANY_PROFILES.some(item => item.id === candidate)) return candidate as CompanyType;
  }
  return "hospitality";
}

function initialExpanded() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("audience") === "company" || window.location.hash === "#company-tools";
}

export default function CompanyJourneyTools({ view, profile }: { view: JourneyView; profile?: CompanyProfile }) {
  useEffect(() => {
    if (window.location.hash !== "#company-tools") return;
    const frame = requestAnimationFrame(() => document.getElementById("company-tools")?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, []);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [companyType, setCompanyType] = useState<CompanyType>(() => initialType(profile));
  const selectedProfile = companyProfile(companyType);
  const initialPublic = typeof window === "undefined" ? {} : readPublicOccasion(window.location.search);
  const [location, setLocation] = useState(initialPublic.location ?? profile?.location ?? selectedProfile.location);
  const [occasion, setOccasion] = useState(initialPublic.occasion ?? profile?.occasion ?? selectedProfile.occasion);
  const [otherDescription, setOtherDescription] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return sessionStorage.getItem("opendoor.company.other.description") || ""; } catch { return ""; }
  });
  const [shareMessage, setShareMessage] = useState("");
  const [manualLink, setManualLink] = useState("");

  function rememberOtherDescription() {
    if (companyType !== "other") return;
    try { sessionStorage.setItem("opendoor.company.other.description", otherDescription.trim().slice(0, 200)); }
    catch { /* Custom context remains optional when browser storage is unavailable. */ }
  }

  function updateType(event: ChangeEvent<HTMLSelectElement>) {
    const nextType = COMPANY_PROFILES.some(item => item.id === event.target.value) ? event.target.value as CompanyType : "hospitality";
    const nextProfile = companyProfile(nextType);
    setCompanyType(nextType);
    setLocation(nextProfile.location);
    setOccasion(nextProfile.occasion);
    setShareMessage("");
    setManualLink("");
  }

  async function copyGuestLink() {
    const relative = companyExperienceUrl("discover", companyType, { location, occasion });
    const absolute = new URL(relative, window.location.origin).toString();
    setManualLink("");
    try {
      await navigator.clipboard.writeText(absolute);
      setShareMessage("Guest link copied. Only the selected use case, public place and occasion are included.");
    } catch {
      setManualLink(absolute);
      setShareMessage("Copy is unavailable here. Select and copy the guest link below.");
    }
  }

  const discoveryUrl = companyExperienceUrl("discover", companyType, { location, occasion });
  const labUrl = companyExperienceUrl("lab", companyType, { location, occasion });

  return <details
    className="company-journey-tools"
    id="company-tools"
    open={expanded}
    onToggle={event => setExpanded(event.currentTarget.open)}
    onKeyDown={event => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
    }}
  >
    <summary>
      <span className="company-tools-summary-copy">
        <span className="company-tools-kicker">Guest &amp; company examples · {view === "lab" ? "Discovery Lab" : "Discover"}</span>
        <strong>Help others explore</strong>
        <span>Shape a guest starting point, then open the real discovery flow or Lab.</span>
      </span>
    </summary>
    <div className="company-tools-content">
      <div className="company-tools-grid">
        <div className="company-tools-fields">
          <label className="company-form-control" htmlFor="company-tools-type">
            <span>Company use case</span>
            <select id="company-tools-type" value={companyType} onChange={updateType}>
              {COMPANY_PROFILES.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            <small>{selectedProfile.audience}. A starting point, not a claim about what an organization offers.</small>
          </label>
          {companyType === "other" && <label className="company-form-control" htmlFor="company-tools-other">
            <span>Optional context for your own preview</span>
            <input id="company-tools-other" value={otherDescription} maxLength={200} onChange={event => setOtherDescription(event.target.value.slice(0, 200))} placeholder="A short description, up to 200 characters" />
            <small>This stays in this browser session and is never added to a shared link.</small>
          </label>}
          <div>
            <p className="company-tools-public-note">Only these public details are included in a guest link. A guest’s tastes and practical needs remain their own.</p>
            <div className="company-tools-fields">
              <label className="company-form-control" htmlFor="company-tools-place">
                <span>Place</span>
                <input id="company-tools-place" value={location} maxLength={120} onChange={event => { setLocation(event.target.value.slice(0, 120)); setShareMessage(""); setManualLink(""); }} placeholder="City, neighborhood or destination" />
              </label>
              <label className="company-form-control" htmlFor="company-tools-occasion">
                <span>Occasion</span>
                <input id="company-tools-occasion" value={occasion} maxLength={200} onChange={event => { setOccasion(event.target.value.slice(0, 200)); setShareMessage(""); setManualLink(""); }} placeholder="A weekend around the celebration" />
              </label>
            </div>
          </div>
        </div>
        <article className="company-tools-summary">
          <span className="company-eyebrow">Illustrative use case</span>
          <h3>{selectedProfile.example}</h3>
          <p>{selectedProfile.summary}</p>
          <div className="company-tools-actions">
            <Link className="company-button" href={discoveryUrl} onClick={rememberOtherDescription}>Try discovery <span aria-hidden="true">→</span></Link>
            <Link className="company-button secondary" href={labUrl} onClick={rememberOtherDescription}>Open the Lab</Link>
            <button className="company-button secondary" type="button" onClick={() => void copyGuestLink()}>Copy guest link</button>
          </div>
          {shareMessage && <div className="company-tools-share">
            <p className="company-tools-share-message" role="status">{shareMessage}</p>
            {manualLink && <div className="company-tools-share-fallback">
              <label htmlFor="company-tools-manual-link">Guest link — select and copy</label>
              <input id="company-tools-manual-link" value={manualLink} readOnly onFocus={event => event.currentTarget.select()} />
            </div>}
          </div>}
        </article>
      </div>
      <details className="company-tools-walkthrough">
        <summary>Guest walkthrough · how the experience works</summary>
        <CompanyWalkthrough />
      </details>
    </div>
  </details>;
}
