import { useEffect, useState, type FormEvent } from "react";
import type { AgentStatus } from "./agentApi";
import "./qloo-connection.css";

type QlooMode = "demo" | "live";
type QlooSource = "shared" | "personal";

type QlooConnectionPanelProps = {
  status: AgentStatus | null;
  mode: QlooMode;
  source: QlooSource;
  disabled: boolean;
  onSelect: (mode: QlooMode, source: QlooSource) => void;
};

type ConnectionResponse = {
  connected?: boolean;
  expiresAt?: string;
  message?: string;
  error?: string;
};

const CONNECTION_URL = "/api/qloo/connection";

async function readResponse(response: Response): Promise<ConnectionResponse> {
  try {
    return (await response.json()) as ConnectionResponse;
  } catch {
    return {};
  }
}

function expiryDescription(expiresAt?: string | null): string | null {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(expiry);
}

export default function QlooConnectionPanel({
  status,
  mode,
  source,
  disabled,
  onSelect,
}: QlooConnectionPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const busy = disabled || isSubmitting;
  const sharedConfigured =
    status?.sharedQlooConfigured ?? status?.qlooConfigured ?? false;
  const personalConnected = status?.personalQlooConnected === true;
  const expiresAt = expiryDescription(status?.connectionExpiresAt);
  useEffect(() => {
    if (mode !== "live" || source !== "personal" || !status?.personalQlooConnected || !status.connectionExpiresAt) return;
    const remaining = new Date(status.connectionExpiresAt).getTime() - Date.now();
    if (!Number.isFinite(remaining)) return;
    const timer = window.setTimeout(() => onSelect("live", "personal"), Math.max(0, remaining) + 100);
    return () => window.clearTimeout(timer);
  }, [mode, source, status?.personalQlooConnected, status?.connectionExpiresAt, onSelect]);

  const chooseShared = () => {
    setError("");
    setApiKey("");
    onSelect("live", "shared");
  };

  const choosePersonal = () => {
    setError("");
    onSelect("live", "personal");
  };

  const choosePreparedExamples = () => {
    setError("");
    setApiKey("");
    onSelect("demo", "shared");
  };

  const submitKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedKey = apiKey;
    setApiKey("");
    if (!submittedKey.trim() || busy) return;

    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(CONNECTION_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: submittedKey }),
      });
      const result = await readResponse(response);
      if (!response.ok || result.connected !== true) {
        setError(
          result.message ||
            result.error ||
            "We couldn’t verify that key. Check it and try again.",
        );
        return;
      }
      onSelect("live", "personal");
    } catch {
      setError("We couldn’t reach the connection service. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const disconnect = async () => {
    if (busy) return;
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(CONNECTION_URL, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const result = await readResponse(response);
      if (!response.ok || result.connected !== false) {
        setError(
          result.message ||
            result.error ||
            "We couldn’t disconnect this key. Please try again.",
        );
        return;
      }
      onSelect("live", "personal");
    } catch {
      setError("We couldn’t reach the connection service. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className="mode-panel qloo-connection-panel"
      aria-label="Qloo connection"
    >
      <div className="qloo-panel-intro">
        <span className="eyebrow">Choose your discovery source</span>
        <h2>Explore with Qloo, or try prepared examples.</h2>
        <p>
          Shared recommendations use this project’s Qloo quota. Connect your
          own key to use your Qloo quota instead.
        </p>
      </div>

      <div className="qloo-controls">
        <div className="mode-switch qloo-source-switch" role="group" aria-label="Choose a live Qloo connection">
          <button
            type="button"
            className={mode === "live" && source === "shared" ? "selected" : ""}
            aria-pressed={mode === "live" && source === "shared"}
            disabled={busy || !sharedConfigured}
            onClick={chooseShared}
          >
            Demo
          </button>
          <button
            type="button"
            className={mode === "live" && source === "personal" ? "selected" : ""}
            aria-pressed={mode === "live" && source === "personal"}
            disabled={busy}
            onClick={choosePersonal}
          >
            Connect your own
          </button>
        </div>
        <p className="helper">Demo uses our shared Qloo API connection for real recommendations. Connect your own uses your API key.</p>

        <div className="qloo-example-choice">
          <button
            type="button"
            className="secondary-btn"
            aria-pressed={mode === "demo"}
            disabled={busy}
            onClick={choosePreparedExamples}
          >
            Try prepared examples
          </button>
          <span className="helper">
            Authored examples, not live Qloo API results.
          </span>
        </div>

        {!status && (
          <p className="qloo-inline-note" role="status">
            Checking Qloo connection status…
          </p>
        )}
        {status && !sharedConfigured && (
          <p className="qloo-inline-note" role="status">
            Shared live recommendations aren’t available right now.
          </p>
        )}

        {mode === "live" && source === "personal" && personalConnected && (
          <div className="qloo-connected" role="status">
            <div>
              <strong>Your Qloo key is connected.</strong>
              <p>
                Recommendations use your own Qloo quota. The temporary connection expires automatically
                {expiresAt ? ` on ${expiresAt}` : " within one hour"}.
              </p>
            </div>
            <button
              type="button"
              className="secondary-btn"
              disabled={busy}
              onClick={disconnect}
            >
              {isSubmitting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        )}

        {mode === "live" && source === "personal" && !personalConnected && (
          <form className="qloo-key-form" onSubmit={submitKey}>
            <div className="field qloo-key-field">
              <label htmlFor="qloo-api-key">Your Qloo API key</label>
              <input
                id="qloo-api-key"
                type="password"
                name="qloo-api-key"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={busy}
                aria-describedby="qloo-key-help"
                placeholder="Paste your key to connect"
              />
              <span id="qloo-key-help" className="helper">
                Use a key compatible with Qloo’s hackathon API. Held temporarily
                on this server for up to one hour, not in browser storage.
              </span>
            </div>
            <button
              type="submit"
              className="primary-btn"
              disabled={busy || !apiKey.trim()}
            >
              {isSubmitting ? "Checking key…" : "Connect key"}
            </button>
          </form>
        )}

        {disabled && (
          <p className="qloo-loading" role="status" aria-live="polite">
            Discovery is running. Connection choices are temporarily paused.
          </p>
        )}
        {isSubmitting && !disabled && (
          <p className="qloo-loading" role="status" aria-live="polite">
            {personalConnected ? "Disconnecting your key…" : "Checking your key…"}
          </p>
        )}
        {error && (
          <p className="qloo-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
