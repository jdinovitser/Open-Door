import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { ProductHeader } from "../ProductHeader";
import { COMPANY_PROFILES, type CompanyType } from "./profiles";
import { inquiryIntentFromSearch } from "./inquiryIntent";
import CommercialNav from "./CommercialNav";
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
  const { isSignedIn } = useUser();
  const initialSearch = typeof window === "undefined" ? "" : window.location.search;
  const initialParams = new URLSearchParams(initialSearch);
  const inquiryIntent = inquiryIntentFromSearch(initialSearch);
  const initialType = COMPANY_PROFILES.some(profile => profile.id === initialParams.get("type"))
    ? initialParams.get("type") as CompanyType : inquiryIntent?.id === "investment" ? "other" : "hospitality";
  let storedOtherDescription = "";
  if (initialType === "other" && typeof window !== "undefined") {
    try { storedOtherDescription = sessionStorage.getItem("opendoor.company.other.description") || ""; } catch { /* Optional browser-session convenience. */ }
  }
  const freshForm: InquiryForm = {
    ...blankForm,
    details: inquiryIntent?.details || "",
    typeDescription: inquiryIntent?.typeDescription || storedOtherDescription,
  };
  const [companyType, setCompanyType] = useState<CompanyType>(initialType);
  const [form, setForm] = useState<InquiryForm>(freshForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Talk to us | Open Door";
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    if (window.location.hash !== "#inquiry") return;
    const frame = requestAnimationFrame(() => document.getElementById("inquiry")?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [inquiryIntent?.id]);

  function update<K extends keyof InquiryForm>(key: K, value: InquiryForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setError("");
  }

  function changeCompanyType(value: string) {
    const nextType = COMPANY_PROFILES.some(profile => profile.id === value) ? value as CompanyType : "hospitality";
    setCompanyType(nextType);
    if (nextType === "other" && !form.typeDescription) {
      try {
        const description = sessionStorage.getItem("opendoor.company.other.description") || "";
        if (description) setForm(current => ({ ...current, typeDescription: description }));
      } catch { /* The inquiry remains usable without browser storage. */ }
    }
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
      setForm(freshForm);
      requestIdRef.current = null;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="company-portal">
    <ProductHeader view="companies" signedIn={Boolean(isSignedIn)} />
    <CommercialNav active="contact" />
    <main className="company-main company-shell">
      <header className="company-contact-intro">
        <span className="company-eyebrow">Open Door · conversations</span>
        <h1>Talk to us</h1>
        <p>Partnerships, guest experiences, customization ideas and investor conversations all start here. Tell us what you have in mind; there is no booking or commitment on this form.</p>
      </header>

      <section className="company-inquiry-section" id="inquiry" aria-labelledby="company-inquiry-title">
        <form className="company-inquiry-form" onSubmit={submitInquiry}>
          <div className="company-inquiry-heading">
            <div><span className="company-eyebrow">A note to Open Door</span><h2 id="company-inquiry-title">{inquiryIntent?.heading || "Tell us what you’re imagining."}</h2><p>{inquiryIntent?.intro || "Share the audience, the occasion and what a useful discovery experience might look like. We’ll review the request and follow up using the contact details you provide."}</p></div>
            <span className="company-eyebrow">{inquiryIntent ? `${inquiryIntent.id === "investment" ? "Investment" : "Partnership"} conversation` : "Customization inquiry"}</span>
          </div>
          <div className="company-form-grid">
            <label className="company-form-control">
              <span>Company use case <b aria-hidden="true">*</b></span>
              <select value={companyType} onChange={event => changeCompanyType(event.target.value)} required>
                {COMPANY_PROFILES.map(profile => <option value={profile.id} key={profile.id}>{profile.name}</option>)}
              </select>
            </label>
            {companyType === "other" && <label className="company-form-control">
              <span>Explain the use case <b aria-hidden="true">*</b></span>
              <input value={form.typeDescription} onChange={event => update("typeDescription", event.target.value.slice(0, 200))} maxLength={200} required placeholder="Up to 200 characters" />
            </label>}
            <label className="company-form-control"><span>{inquiryIntent?.id === "investment" ? "Company, fund or independent investor" : "Company or organization"} <b aria-hidden="true">*</b></span><input value={form.company} onChange={event => update("company", event.target.value)} maxLength={160} required autoComplete="organization" /></label>
            <label className="company-form-control"><span>Your name <b aria-hidden="true">*</b></span><input value={form.name} onChange={event => update("name", event.target.value)} maxLength={120} required autoComplete="name" /></label>
            <label className="company-form-control"><span>{inquiryIntent?.id === "investment" ? "Email" : "Work email"} <b aria-hidden="true">*</b></span><input type="email" value={form.email} onChange={event => update("email", event.target.value)} maxLength={254} required autoComplete="email" /></label>
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
      <div className="company-shell company-footer-inner"><p>Open Door · Cultural discovery, led by individual taste.</p><Link href="/partners">Business Model and Partnerships</Link><Link href="/companies/admin">Administrator access</Link></div>
    </footer>
  </div>;
}
