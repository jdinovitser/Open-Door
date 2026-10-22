import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { COMPANY_PROFILES } from "./profiles";
import "./company.css";

type InquiryStatus = "new" | "reviewing" | "contacted" | "closed";
type FilterStatus = "all" | InquiryStatus;
type Inquiry = {
  id: string;
  companyType: string;
  typeDescription: string;
  company: string;
  name: string;
  email: string;
  website?: string;
  details: string;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
};

type InquiryPage = { inquiries: Inquiry[]; total: number; page: number; pageSize: 25 };
type AccessState = "checking" | "allowed" | "denied" | "error";
const statuses: InquiryStatus[] = ["new", "reviewing", "contacted", "closed"];

function errorText(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error;
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") return payload.message;
  return fallback;
}

function formattedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function profileLabel(id: string) {
  return COMPANY_PROFILES.find(profile => profile.id === id)?.name || id;
}

export default function CompanyAdmin() {
  const { isLoaded, isSignedIn, user } = useUser();
  const userId = user?.id;
  const [accessUserId, setAccessUserId] = useState<string | undefined>();
  const [access, setAccess] = useState<AccessState>("checking");
  const [accessError, setAccessError] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InquiryPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    setData(null);
    setAccessUserId(undefined);
    if (!isSignedIn) {
      setAccess("checking");
      return;
    }
    const controller = new AbortController();
    setAccess("checking");
    setAccessError("");
    fetch("/api/company/admin/access", { credentials: "include", signal: controller.signal })
      .then(async response => {
        const payload: unknown = await response.json().catch(() => null);
        if (response.status === 403) {
          setData(null);
          setAccess("denied");
          return;
        }
        if (!response.ok) throw new Error(errorText(payload, "Could not verify administrator access."));
        setAccessUserId(userId);
        setAccess("allowed");
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setAccess("error");
        setAccessError(error instanceof Error ? error.message : "Could not verify administrator access.");
      });
    return () => controller.abort();
  }, [isLoaded, isSignedIn, userId, refreshKey]);

  useEffect(() => {
    if (access !== "allowed" || !isSignedIn || accessUserId !== userId) return;
    const controller = new AbortController();
    setLoading(true);
    setListError("");
    const query = new URLSearchParams({ status: filter, page: String(page) });
    fetch(`/api/company/admin/inquiries?${query.toString()}`, { credentials: "include", signal: controller.signal })
      .then(async response => {
        const payload: unknown = await response.json().catch(() => null);
        if (response.status === 403) {
          setData(null);
          setAccess("denied");
          throw new Error("Administrator access is no longer available for this session.");
        }
        if (!response.ok) throw new Error(errorText(payload, "The inquiry list could not be loaded."));
        const result = payload as InquiryPage;
        if (!result || !Array.isArray(result.inquiries) || typeof result.total !== "number" || typeof result.page !== "number") {
          throw new Error("The server returned an unexpected inquiry list.");
        }
        setData(result);
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setListError(error instanceof Error ? error.message : "The inquiry list could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [access, accessUserId, userId, isSignedIn, filter, page, refreshKey]);

  function retryAccess() {
    setData(null);
    setRefreshKey(value => value + 1);
  }

  async function changeStatus(inquiry: Inquiry, status: InquiryStatus) {
    if (status === inquiry.status) return;
    setBusyId(inquiry.id);
    setActionError("");
    try {
      const response = await fetch(`/api/company/admin/inquiries/${encodeURIComponent(inquiry.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) { setData(null); setAccess("denied"); }
      if (!response.ok || !payload || typeof payload !== "object" || !("inquiry" in payload)) {
        throw new Error(errorText(payload, "The status was not updated."));
      }
      const updated = payload.inquiry as Inquiry;
      setData(current => current ? { ...current, inquiries: current.inquiries.map(item => item.id === updated.id ? updated : item) } : current);
      if (filter !== "all" && updated.status !== filter) setRefreshKey(value => value + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The status was not updated.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteInquiry(inquiry: Inquiry) {
    if (!window.confirm(`Permanently delete the inquiry from ${inquiry.company}? This cannot be undone.`)) return;
    setBusyId(inquiry.id);
    setActionError("");
    try {
      const response = await fetch(`/api/company/admin/inquiries/${encodeURIComponent(inquiry.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) { setData(null); setAccess("denied"); }
      if (!response.ok || !payload || typeof payload !== "object" || !("deleted" in payload) || payload.deleted !== true) {
        throw new Error(errorText(payload, "The inquiry was not deleted."));
      }
      setData(current => current ? { ...current, inquiries: current.inquiries.filter(item => item.id !== inquiry.id), total: Math.max(0, current.total - 1) } : current);
      if (data && data.inquiries.length === 1 && page > 1) setPage(value => value - 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The inquiry was not deleted.");
    } finally {
      setBusyId(null);
    }
  }

  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent("/companies/admin")}`;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 25)) : 1;

  return <div className="company-admin-page">
    <header className="company-topbar">
      <div className="company-shell company-topbar-inner">
        <Link href="/companies" className="company-brand" aria-label="Open Door companies home">
          <span className="company-brand-mark" aria-hidden="true">O</span>
          <span><span className="company-brand-name">Open Door</span><span className="company-brand-caption">Company experiences</span></span>
        </Link>
        <nav className="company-top-links" aria-label="Administrator navigation"><Link href="/companies">Company portal</Link><Link href="/">Individual experience</Link></nav>
      </div>
    </header>
    <main className="company-shell">
      <section className="company-admin-heading">
        <span className="company-eyebrow">Open Door · Private administration</span>
        <h1>Company inquiries.</h1>
        <p>Review and manage customization requests. Access is verified by the server; signing in alone does not grant administrator privileges.</p>
      </section>
      <div className="company-admin-content">
        {!isLoaded && <div className="company-admin-state" aria-label="Loading sign-in status"><div className="company-admin-skeleton"><div className="company-skeleton-row"><div className="company-skeleton-line short" /><div className="company-skeleton-line" /></div></div></div>}
        {isLoaded && !isSignedIn && <section className="company-admin-state">
          <span className="company-eyebrow">Sign in to continue</span><h2>Administrator access starts with your account.</h2>
          <p>Sign in first. Open Door will then check your role before requesting any private inquiries. A signed-in account is not automatically an administrator.</p>
          <Link className="company-button" href={signInUrl}>Sign in <span aria-hidden="true">→</span></Link>
        </section>}
        {isLoaded && isSignedIn && access === "checking" && <div className="company-admin-skeleton" aria-label="Checking administrator access"><div className="company-skeleton-row"><div className="company-skeleton-line short" /><div className="company-skeleton-line" /></div></div>}
        {isLoaded && isSignedIn && access === "denied" && <section className="company-admin-state" role="status">
          <span className="company-eyebrow">Access not granted</span><h2>This account is not an administrator.</h2>
          <p>Administrator access must be granted by the Open Door owner. No inquiry information has been requested or shown. The first visitor is never made an administrator automatically.</p>
          <Link className="company-button secondary" href="/companies">Return to company portal</Link>
        </section>}
        {isLoaded && isSignedIn && access === "error" && <section className="company-admin-state" role="alert">
          <span className="company-eyebrow">Access check unavailable</span><h2>We couldn’t confirm your access.</h2><p>{accessError} Private inquiry data has not been loaded.</p>
          <button type="button" className="company-button" onClick={retryAccess}>Retry access check</button>
        </section>}
        {isLoaded && isSignedIn && access === "allowed" && accessUserId === userId && <section className="company-admin-card" aria-label="Company inquiry records">
          <div className="company-admin-toolbar">
            <div className="company-admin-filters">
              <label className="company-form-control"><span>Filter by status</span><select value={filter} onChange={event => { setFilter(event.target.value as FilterStatus); setPage(1); }}>
                <option value="all">All statuses</option>{statuses.map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
              </select></label>
              <span className="company-admin-summary">{data ? `${data.total} ${data.total === 1 ? "request" : "requests"}` : "Inquiry records"}</span>
            </div>
            <button className="company-button secondary" type="button" onClick={() => setRefreshKey(value => value + 1)} disabled={loading}>{loading ? "Refreshing…" : "Refresh list"}</button>
          </div>
          {actionError && <div className="company-alert" role="alert">{actionError}</div>}
          {loading && !data && <div className="company-admin-skeleton" aria-label="Loading inquiries">
            {[0, 1, 2].map(item => <div className="company-skeleton-row" key={item}><div className="company-skeleton-line short" /><div className="company-skeleton-line" /></div>)}
          </div>}
          {listError && <section className="company-admin-state" role="alert"><h2>Couldn’t load inquiries.</h2><p>{listError}</p><button type="button" className="company-button" onClick={() => setRefreshKey(value => value + 1)}>Retry list</button></section>}
          {!listError && !loading && data && data.inquiries.length === 0 && <section className="company-admin-state">
            <span className="company-eyebrow">Nothing to review here</span><h2>No inquiries in this view.</h2>
            <p>{data.total === 0 ? "There are no submitted company inquiries yet." : "There are no requests matching this status on this page. Change the filter or move to another page."}</p>
          </section>}
          {!listError && data && data.inquiries.length > 0 && <>
            <div className="company-inquiry-list">
              {data.inquiries.map(inquiry => <article className="company-admin-inquiry" key={inquiry.id}>
                <div className="company-admin-inquiry-top">
                  <div>
                    <h2>{inquiry.company}</h2>
                    <div className="company-admin-inquiry-meta"><span>{inquiry.name}</span><a href={`mailto:${inquiry.email}`}>{inquiry.email}</a>{inquiry.website && <a href={inquiry.website} target="_blank" rel="noreferrer">{inquiry.website}</a>}</div>
                    <div className="company-admin-inquiry-meta" style={{ marginTop: 8 }}><span>{profileLabel(inquiry.companyType)}</span>{inquiry.typeDescription && <span>{inquiry.typeDescription}</span>}</div>
                  </div>
                  <span className="company-status-badge" data-status={inquiry.status}>{inquiry.status}</span>
                </div>
                <p className="company-admin-inquiry-details">{inquiry.details}</p>
                <div className="company-admin-inquiry-submeta">Received {formattedDate(inquiry.createdAt)} · Updated {formattedDate(inquiry.updatedAt)} · Ref {inquiry.id}</div>
                <div className="company-admin-actions">
                  <label className="company-form-control"><span>Status</span><select value={inquiry.status} disabled={busyId === inquiry.id} onChange={event => void changeStatus(inquiry, event.target.value as InquiryStatus)}>
                    {statuses.map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
                  </select></label>
                  <button type="button" className="company-button company-delete-button" onClick={() => void deleteInquiry(inquiry)} disabled={busyId === inquiry.id}>{busyId === inquiry.id ? "Working…" : "Delete inquiry"}</button>
                </div>
              </article>)}
            </div>
            {totalPages > 1 && <nav className="company-admin-pagination" aria-label="Inquiry pages">
              <button className="company-button secondary" type="button" disabled={page <= 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
              <span>Page {data.page} of {totalPages}</span>
              <button className="company-button secondary" type="button" disabled={page >= totalPages || loading} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Next</button>
            </nav>}
          </>}
        </section>}
      </div>
    </main>
    <footer className="company-footer"><div className="company-shell company-footer-inner"><p>Private company inquiry administration · Open Door</p><Link href="/companies">Company portal</Link></div></footer>
  </div>;
}
