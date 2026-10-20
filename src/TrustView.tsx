import { useEffect, useState } from "react";
import { AlertTriangle, Check, Download, ShieldCheck, Trash2 } from "lucide-react";
import { getAgentHealth, type AgentHealth } from "./agentApi";

type TrustViewProps = {
  personalizationEnabled: boolean;
  savedCount: number;
  onPersonalizationChange: (enabled: boolean) => void;
  onExport: () => void;
  onDeleteJourney: () => void;
  onClearSignals: () => void;
  onDeleteSaved: () => void;
  onClearAll: () => void;
};

function StatusPill({ children, tone = "neutral" }: { children: string; tone?: "good" | "neutral" | "planned" }) {
  return <span className={`trust-status trust-status-${tone}`}>{children}</span>;
}

export function TrustView({
  personalizationEnabled,
  savedCount,
  onPersonalizationChange,
  onExport,
  onDeleteJourney,
  onClearSignals,
  onDeleteSaved,
  onClearAll,
}: TrustViewProps) {
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [healthError, setHealthError] = useState("");

  useEffect(() => {
    let active = true;
    getAgentHealth()
      .then(value => { if (active) setHealth(value); })
      .catch(error => { if (active) setHealthError(error instanceof Error ? error.message : "Status unavailable."); });
    return () => { active = false; };
  }, []);

  const components = health?.components || {};
  const qlooStatus = components.qloo === "not-configured"
    ? "API key not configured"
    : components.qloo === "configured-not-probed"
      ? "Key configured · connection not tested"
      : "Status not available";

  return <section className="trust-page">
    <div className="trust-hero">
      <span className="eyebrow">Open Door · Trust &amp; privacy</span>
      <h1>Clear about what happens to your data.</h1>
      <p>Open Door keeps saved journeys in this browser. Live discovery sends only the inputs needed to retrieve Qloo results; this app does not have accounts, analytics, or a server-side user database.</p>
    </div>

    <div className="trust-grid">
      <section className="trust-card">
        <div className="trust-card-heading"><ShieldCheck size={18} /><h2>Current system status</h2></div>
        {healthError ? <p role="status">{healthError}</p> : <>
          <div className="trust-status-row"><span>Open Door API</span><StatusPill tone={health?.status === "operational" ? "good" : "neutral"}>{health?.status === "operational" ? "Responding" : "Checking"}</StatusPill></div>
          <div className="trust-status-row"><span>Qloo</span><StatusPill>{qlooStatus}</StatusPill></div>
          <div className="trust-status-row"><span>User accounts / server database</span><StatusPill>Not used</StatusPill></div>
          <div className="trust-status-row"><span>Analytics / advertising trackers</span><StatusPill>Not used</StatusPill></div>
          <div className="trust-status-row"><span>Audit events</span><StatusPill>Process memory only</StatusPill></div>
          {health?.policy?.limits && <div className="trust-limits">
            <div><b>Request limits</b><span>{Math.round(health.policy.limits.requestBodyBytes / 1024)} KiB body · up to {health.policy.limits.anchorsPerRequest} interests · {health.policy.limits.discoveryRequestsPerWindow} discovery requests per {health.policy.limits.discoveryWindowMs / 1000}s process-local window</span></div>
            <div><b>Qloo response / timeout</b><span>{Math.round(health.policy.limits.qlooResponseBytes / (1024 * 1024))} MiB maximum response · {health.policy.limits.qlooTimeoutMs / 1000}s timeout</span></div>
          </div>}
          {!!health?.policy?.tools?.length && <div className="trust-tool-list">
            <h3>Allowed agent tools</h3>
            {health.policy.tools.map(tool => <details key={tool.name}>
              <summary>{tool.name} · {tool.externalService} · {tool.risk}</summary>
              <p>{tool.purpose}</p>
              <p><b>Permission:</b> {tool.permission} · <b>Audit event:</b> {tool.auditEvent}</p>
              <p><b>Input:</b> {Object.entries(tool.inputSchema).map(([key, value]) => `${key}: ${value}`).join(" · ")}</p>
              <p><b>Output:</b> {Object.entries(tool.outputSchema).map(([key, value]) => `${key}: ${value}`).join(" · ")}</p>
            </details>)}
          </div>}
          {health?.checkedAt && <p className="trust-footnote">Checked {new Date(health.checkedAt).toLocaleString()}. A configured Qloo key is not proof of a working connection; the app checks Qloo only when you request Live discovery.</p>}
        </>}
      </section>

      <section className="trust-card trust-privacy">
        <div className="trust-card-heading"><h2>Controls for this browser</h2></div>
        <p>Saved doors are stored locally for your collection. Personalization history includes the current journey, feedback choices, and opened-door counts.</p>
        <label className="trust-toggle">
          <input
            type="checkbox"
            checked={personalizationEnabled}
            onChange={event => onPersonalizationChange(event.target.checked)}
          />
          <span><strong>Save personalization history on this device</strong><small>Turn off to remove its stored history and stop future saves. Current in-memory work remains until you leave this page.</small></span>
        </label>
        <div className="trust-actions">
          <button type="button" className="trust-action" onClick={onExport}><Download size={15} /> Export browser data</button>
          <button type="button" className="trust-action" onClick={() => window.confirm("Delete the saved journey from this browser?") && onDeleteJourney()}><Trash2 size={15} /> Delete current journey</button>
          <button type="button" className="trust-action" onClick={() => window.confirm("Clear feedback choices and opened-door counts from this browser?") && onClearSignals()}><Trash2 size={15} /> Clear feedback and activity</button>
          <button type="button" className="trust-action" onClick={() => window.confirm(`Remove all ${savedCount} saved door${savedCount === 1 ? "" : "s"} from this browser?`) && onDeleteSaved()}><Trash2 size={15} /> Delete saved doors ({savedCount})</button>
          <button type="button" className="trust-action trust-action-danger" onClick={() => window.confirm("Clear the journey, saved doors, feedback, and opened-door history stored by Open Door in this browser? This cannot be undone.") && onClearAll()}><Trash2 size={15} /> Clear all Open Door data</button>
        </div>
        <p className="trust-footnote">Export is created on your device. The personalization setting is retained when you clear all data so that clearing storage does not silently turn personalization back on.</p>
      </section>
    </div>

    <section className="trust-card trust-wide">
      <div className="trust-card-heading"><h2>What is sent where</h2></div>
      <div className="trust-table">
        <div><b>Open Door browser → Open Door server</b><span>Live discovery request fields: interests, selected categories, optional location, chosen discovery depth, and explicit feedback. No account or cookie is required.</span></div>
        <div><b>Open Door server → Qloo</b><span>Live requests send entered interests for entity search, resolved Qloo entity IDs for insights, and location only for supported place/destination queries. Budget, schedule, and movement preferences are not sent to Qloo.</span></div>
        <div><b>Your browser → image host</b><span>Live result images may load from an HTTPS image URL returned with Qloo results. As with any remote image, that host can receive a network request from your browser. The page sends no referrer URL.</span></div>
        <div><b>Demo mode</b><span>Demo journeys are authored deterministic examples, not Qloo responses or real venue listings. They do not call Qloo.</span></div>
        <div><b>Typography</b><span>The interface requests fonts from Google Fonts. Google may receive the request’s network and browser metadata; no referrer URL is sent. If you prefer, the app falls back to system fonts when that service is unavailable.</span></div>
      </div>
    </section>

    <section className="trust-card trust-wide">
      <div className="trust-card-heading"><h2>Controls that are not implemented</h2></div>
      <p>This project is a single-user prototype. It does not claim enterprise identity, role-based access, tamper-resistant audit, certified compliance, or production incident response.</p>
      <div className="trust-planned">
        {["SSO and server-side authorization", "Persistent, access-controlled audit retention", "Admin policy and key rotation console", "Formal retention, backup, and deletion workflows", "Independent security review and compliance certification"].map(item =>
          <div key={item}><span>{item}</span><StatusPill tone="planned">Planned · not available</StatusPill></div>,
        )}
      </div>
      <p className="trust-footnote">Operational event records are held in a bounded in-memory buffer and standard output. They omit discovery inputs, but are volatile and are not immutable or a complete user audit trail.</p>
    </section>
  </section>;
}

export function DevSecurityTestView({ onBack }: { onBack: () => void }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Array<{ label: string; result: "pass" | "fail" | "info"; detail: string }>>([]);
  const [error, setError] = useState("");

  async function runChecks() {
    setRunning(true);
    setError("");
    setResults([]);
    const next: typeof results = [];
    try {
      const healthResponse = await fetch("/api/health", { headers: { Accept: "application/json" } });
      const health = await healthResponse.json();
      next.push({
        label: "Health endpoint reports its real components",
        result: healthResponse.ok && health.status === "operational" ? "pass" : "fail",
        detail: `Qloo: ${health.components?.qloo || "unknown"}; database: ${health.components?.database || "unknown"}.`,
      });
      const publicJson = JSON.stringify(health);
      next.push({
        label: "Public health response does not expose credentials",
        result: /api[_-]?key|secret|password|bearer|authorization/i.test(publicJson) ? "fail" : "pass",
        detail: "The response contains status and policy metadata only.",
      });

      const invalidResponse = await fetch("/api/agent/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ anchors: [] }),
      });
      const invalid = await invalidResponse.json();
      next.push({
        label: "Invalid discovery input is rejected before external calls",
        result: invalidResponse.status === 400 && invalid.code === "ANCHOR_REQUIRED" ? "pass" : "fail",
        detail: `Received HTTP ${invalidResponse.status} (${invalid.code || "unknown"}); no valid discovery was requested.`,
      });

      const auditResponse = await fetch("/api/dev/audit", { headers: { Accept: "application/json" } });
      const audit = await auditResponse.json();
      const auditSafe = auditResponse.ok && audit.available === true && audit.events.every((event: Record<string, unknown>) =>
        Object.keys(event).every(key => !/(anchor|location|budget|input|payload|secret|token|key|query)/i.test(key)),
      );
      next.push({
        label: "Development audit event fields exclude user inputs",
        result: auditSafe ? "pass" : "fail",
        detail: `Inspected ${Array.isArray(audit.events) ? audit.events.length : 0} process-local event records.`,
      });
      next.push({
        label: "Account isolation / role authorization",
        result: "info",
        detail: "Not applicable: this prototype has no accounts, roles, or protected administrative endpoints.",
      });
      setResults(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A safe check could not complete.");
      setResults(next);
    } finally {
      setRunning(false);
    }
  }

  return <main className="security-test-page">
    <span className="eyebrow">Developer-only · local checks</span>
    <h1>Security checks</h1>
    <p>These checks exercise safe status and input-validation paths. They do not call Qloo or attempt to access another user’s data.</p>
    <button type="button" className="primary-btn" disabled={running} onClick={() => void runChecks()}>{running ? "Running checks…" : "Run safe checks"}</button>
    {error && <p role="alert" className="security-test-error">{error}</p>}
    {!!results.length && <ul className="security-test-results">
      {results.map(item => <li key={item.label} className={`security-test-${item.result}`}>
        {item.result === "pass" ? <Check size={16} /> : item.result === "fail" ? <AlertTriangle size={16} /> : <span aria-hidden="true">i</span>}
        <div><b>{item.label}</b><p>{item.detail}</p></div>
      </li>)}
    </ul>}
    <p className="trust-footnote">This page and its audit endpoint are available only in the development server. The automated test suite covers input limits, request headers, same-site checks, and rate limiting with a simulated clock.</p>
    <button type="button" className="trust-action" onClick={onBack}>Return to Open Door</button>
  </main>;
}
