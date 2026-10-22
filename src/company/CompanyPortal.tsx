import { useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { COMPANY_PROFILES, companyUrl, type CompanyType } from "./profiles";
import { CompanyMascot } from "./CompanyMascot";
import CompanyWalkthrough from "./CompanyWalkthrough";
import "./company.css";

type InquiryForm = {
  company: string;
  name: string;
  email: string;
  website: string;
  typeDescription: string;
  details: string;
  consent: boolean;
};

type SubmissionReceipt = { id: string; submittedAt: string };

const blankForm: InquiryForm = {
  company: "",
  name: "",
  email: "",
  website: "",
  typeDescription: "",
  details: "",
  consent: false,
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error;
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") return payload.message;
  return fallback;
}

export default function CompanyPortal() {
  const [companyType, setCompanyType] = useState<CompanyType>("hospitality");
  const [form, setForm] = useState<InquiryForm>(blankForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const selectedProfile = COMPANY_PROFILES.find(profile => profile.id === companyType) || COMPANY_PROFILES[0];

  function update<K extends keyof InquiryForm>(key: K, value: InquiryForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setError("");
  }
  function rememberOtherContext() {
    if (companyType !== "other") return;
    try { sessionStorage.setItem("opendoor.company.other.description", form.typeDescription.trim().slice(0, 200)); }
    catch { /* The selected example remains usable when browser storage is disabled. */ }
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!requestIdRef.current) requestIdRef.current = window.crypto.randomUUID();
    setSubmitting(true);
    const requestId = requestIdRef.current;
    const payload = {
      companyType,
      typeDescription: companyType === "other" ? form.typeDescription.trim() : "",
      company: form.company.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
      ...(form.website.trim() ? { website: form.website.trim() } : {}),
      details: form.details.trim(),
      consent: form.consent,
      requestId,
    };
    try {
      const response = await fetch("/api/company/inquiries", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json().catch(() => null);
      if ((response.status !== 200 && response.status !== 201) || !result || typeof result !== "object" || !("id" in result) || !("submittedAt" in result) || typeof result.id !== "string" || typeof result.submittedAt !== "string") {
        throw new Error(getErrorMessage(result, "Your request was not confirmed. Please review it and try again."));
      }
      setReceipt({ id: result.id, submittedAt: result.submittedAt });
      setForm(blankForm);
      requestIdRef.current = null;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="company-portal">
    <header className="company-topbar">
      <div className="company-shell company-topbar-inner">
        <Link href="/companies" className="company-brand" aria-label="Open Door companies home">
          <span className="company-brand-mark" aria-hidden="true">O</span>
          <span><span className="company-brand-name">Open Door</span><span className="company-brand-caption">Company experiences</span></span>
        </Link>
        <nav className="company-top-links" aria-label="Company navigation">
          <a href="#company-walkthrough">Walkthrough</a>
          <a href="#use-cases">Use cases</a>
          <a href="#inquiry">Talk with us</a>
          <Link href="/companies/admin">Admin access</Link>
        </nav>
      </div>
    </header>

    <main className="company-main company-shell">
      <section className="company-hero" aria-labelledby="company-hero-title">
        <div>
          <span className="company-eyebrow">Open Door for organizations</span>
          <h1 id="company-hero-title">Make room for <em>their kind</em> of discovery.</h1>
          <p className="company-hero-copy">Give wedding guests, future neighbors and travelers a more personal way into a place. Open Door starts with the interests people choose to share—not a one-size-fits-all itinerary.</p>
        </div>
        <div className="company-hero-art"><CompanyMascot companyType={selectedProfile.id} priority /></div>
      </section>

      <CompanyWalkthrough />

      <div className="company-intro-note">
        <span aria-hidden="true">01</span>
        <div><strong>Explore a working example.</strong> Choose the kind of organization you have in mind, then try a dedicated discovery flow or a side-by-side idea lab. Every example is illustrative—not an endorsement, customer story, availability promise, or industry guarantee.</div>
      </div>

      <section aria-labelledby="company-type-title">
        <div className="company-selector-panel">
          <div>
            <span className="company-eyebrow">Choose a starting point</span>
            <h2 id="company-type-title">Who are you helping explore?</h2>
            <p>The company context shapes editable example inputs and copy. Each person's saved doors and discoveries remain theirs, not a shared company workspace.</p>
          </div>
          <div>
            <label className="company-form-control" htmlFor="company-type">
              <span>Company use case</span>
              <select id="company-type" value={companyType} onChange={event => setCompanyType(event.target.value as CompanyType)}>
                {COMPANY_PROFILES.map(profile => <option value={profile.id} key={profile.id}>{profile.name}</option>)}
              </select>
              <small>{selectedProfile.audience}. These are starting points to explore, not a claim about what your organization offers.</small>
            </label>
            {companyType === "other" && <label className="company-form-control company-other-field" htmlFor="company-type-description">
              <span>What kind of company use case do you have in mind?</span>
              <input id="company-type-description" value={form.typeDescription} onChange={event => update("typeDescription", event.target.value.slice(0, 200))} maxLength={200} placeholder="A short explanation (up to 200 characters)" />
              <small>Optional while exploring; required if you send a customization inquiry.</small>
            </label>}
          </div>
        </div>
        <article className="company-profile-spotlight">
          <div>
            <span className="company-eyebrow">Illustrative use case</span>
            <h3>{selectedProfile.example}</h3>
            <p>{selectedProfile.summary}</p>
          </div>
          <div className="company-path-links" aria-label={`Explore ${selectedProfile.name} example`}>
            <Link className="company-button" onClick={rememberOtherContext} href={companyUrl("discover", selectedProfile.id)}>Try discovery <span aria-hidden="true">→</span></Link>
            <Link className="company-button secondary" onClick={rememberOtherContext} href={companyUrl("lab", selectedProfile.id)}>Open the idea lab</Link>
          </div>
        </article>
      </section>

      <section className="company-use-cases" id="use-cases" aria-labelledby="company-use-cases-title">
        <div className="company-section-head">
          <div><span className="company-eyebrow">Made for many kinds of welcome</span><h2 id="company-use-cases-title">One guide. Different reasons to arrive.</h2></div>
          <p>These scenarios show how an organization might introduce cultural discovery. They are illustrative use cases, not endorsements, existing customers, or promises about results.</p>
        </div>
        <div className="company-usecase-list">
          {COMPANY_PROFILES.filter(profile => profile.id !== "other").map((profile, index) => <article className="company-usecase" key={profile.id}>
            <span className="company-usecase-number">0{index + 1}</span>
            <div><h3>{profile.name}</h3><p>{profile.summary}</p></div>
            <p className="company-usecase-example"><strong>For instance</strong>{profile.example}</p>
          </article>)}
        </div>
      </section>

      <section className="company-inquiry-section" id="inquiry" aria-labelledby="company-inquiry-title">
        <form className="company-inquiry-form" onSubmit={submitInquiry}>
          <div className="company-inquiry-heading">
            <div><span className="company-eyebrow">A note to Open Door</span><h2 id="company-inquiry-title">Tell us what you’re imagining.</h2><p>Share the audience, the occasion and what a useful discovery experience might look like. We’ll review the request and follow up using the contact details you provide.</p></div>
            <span className="company-eyebrow">Customization inquiry</span>
          </div>
          <div className="company-form-grid">
            <label className="company-form-control">
              <span>Company use case <b aria-hidden="true">*</b></span>
              <select value={companyType} onChange={event => setCompanyType(event.target.value as CompanyType)} required>
                {COMPANY_PROFILES.map(profile => <option value={profile.id} key={profile.id}>{profile.name}</option>)}
              </select>
            </label>
            {companyType === "other" && <label className="company-form-control">
              <span>Explain the use case <b aria-hidden="true">*</b></span>
              <input value={form.typeDescription} onChange={event => update("typeDescription", event.target.value.slice(0, 200))} maxLength={200} required placeholder="Up to 200 characters" />
            </label>}
            <label className="company-form-control"><span>Company or organization <b aria-hidden="true">*</b></span><input value={form.company} onChange={event => update("company", event.target.value)} maxLength={160} required autoComplete="organization" /></label>
            <label className="company-form-control"><span>Your name <b aria-hidden="true">*</b></span><input value={form.name} onChange={event => update("name", event.target.value)} maxLength={120} required autoComplete="name" /></label>
            <label className="company-form-control"><span>Work email <b aria-hidden="true">*</b></span><input type="email" value={form.email} onChange={event => update("email", event.target.value)} maxLength={254} required autoComplete="email" /></label>
            <label className="company-form-control"><span>Website <small>(optional)</small></span><input type="url" value={form.website} onChange={event => update("website", event.target.value)} maxLength={300} pattern="https?://.+" placeholder="https://example.org" autoComplete="url" /></label>
            <label className="company-form-control full"><span>What would you like to explore together? <b aria-hidden="true">*</b></span><textarea value={form.details} onChange={event => update("details", event.target.value)} minLength={20} maxLength={4000} required placeholder="Tell us about the audience, context, and the kind of experience you have in mind. Please leave out sensitive participant information." /><small>{form.details.length}/4000 characters · at least 20 characters</small></label>
            <label className="company-checkbox full"><input type="checkbox" checked={form.consent} onChange={event => update("consent", event.target.checked)} required /><span>I agree that Open Door may store this inquiry for administrators to review and contact me about it. <b aria-hidden="true">*</b></span></label>
          </div>
          <div className="company-privacy"><span aria-hidden="true">i</span><span><strong>Your inquiry is for Open Door administrators.</strong> It is stored for review and follow-up; it is not sent to Qloo. Please do not include sensitive participant data.</span></div>
          {error && <div className="company-alert" role="alert">{error} Your entries are still here; you can safely retry.</div>}
          {receipt && <div className="company-success" role="status" aria-live="polite">
            <span className="company-success-mark" aria-hidden="true">✓</span>
            <div><h3>Your request is with our team.</h3><p>Open Door confirmed receipt on {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(receipt.submittedAt))}. We’ll use the contact details you shared to follow up.</p><span className="company-reference">Reference {receipt.id}</span></div>
          </div>}
          <div className="company-submit-row">
            <p>Required fields are marked with an asterisk. You can explore examples without sending an inquiry.</p>
            <button className="company-button" type="submit" disabled={submitting}>{submitting ? "Sending request…" : "Send inquiry"} {!submitting && <span aria-hidden="true">→</span>}</button>
          </div>
        </form>
      </section>
    </main>

    <footer className="company-footer">
      <div className="company-shell company-footer-inner"><p>Open Door · Cultural discovery, led by individual taste.</p><Link href="/companies/admin">Administrator access</Link></div>
    </footer>
  </div>;
}
