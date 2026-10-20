import { APP_POLICY } from "./policy.js";

export const QLOO_BASE_URL = "https://hackathon.api.qloo.com";
const MAX_UPSTREAM_RESPONSE_BYTES = APP_POLICY.maxQlooResponseBytes;

export class QlooApiError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = "QlooApiError";
    this.code = code;
    this.status = status;
  }
}

function responseEntities(payload) {
  const entities = Array.isArray(payload?.results)
    ? payload.results
    : payload?.results?.entities ?? payload?.entities ?? [];
  return Array.isArray(entities) ? entities.slice(0, 50) : [];
}

async function parseJsonWithinLimit(response) {
  const contentLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPSTREAM_RESPONSE_BYTES) {
    await response.body?.cancel?.().catch?.(() => {});
    throw new QlooApiError("QLOO_RESPONSE_TOO_LARGE", "Qloo returned a response larger than Open Door accepts.");
  }

  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_UPSTREAM_RESPONSE_BYTES) {
          await reader.cancel();
          throw new QlooApiError("QLOO_RESPONSE_TOO_LARGE", "Qloo returned a response larger than Open Door accepts.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new QlooApiError("QLOO_INVALID_RESPONSE", "Qloo returned a response that could not be read.");
    }
  }

  try {
    const payload = await response.json();
    if (Buffer.byteLength(JSON.stringify(payload)) > MAX_UPSTREAM_RESPONSE_BYTES) {
      throw new QlooApiError("QLOO_RESPONSE_TOO_LARGE", "Qloo returned a response larger than Open Door accepts.");
    }
    return payload;
  } catch (error) {
    if (error instanceof QlooApiError) throw error;
    throw new QlooApiError("QLOO_INVALID_RESPONSE", "Qloo returned a response that could not be read.");
  }
}

export function createQlooClient({ apiKey, fetchImpl = globalThis.fetch, timeoutMs = APP_POLICY.qlooTimeoutMs } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required");

  async function get(path, parameters, signal) {
    if (!apiKey) throw new QlooApiError("QLOO_NOT_CONFIGURED", "Live Qloo is not configured.");
    const url = new URL(path, QLOO_BASE_URL);
    for (const [key, value] of parameters) url.searchParams.append(key, String(value));
    const timeout = AbortSignal.timeout(timeoutMs);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json", "X-Api-Key": apiKey },
        signal: requestSignal,
      });
    } catch (error) {
      if (error?.name === "AbortError" || error?.name === "TimeoutError") {
        throw new QlooApiError("QLOO_TIMEOUT", "Qloo did not respond before the request timed out.");
      }
      throw new QlooApiError("QLOO_NETWORK_ERROR", "The Qloo API could not be reached.");
    }

    if (response.status === 404) return null;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new QlooApiError("QLOO_AUTH_ERROR", "Qloo rejected the configured key. Hackathon keys must use the official hackathon API host.", response.status);
      }
      if (response.status === 429) {
        throw new QlooApiError("QLOO_RATE_LIMIT", "Qloo rate-limited this request. Wait briefly and try again.", response.status);
      }
      throw new QlooApiError("QLOO_REQUEST_FAILED", `Qloo returned HTTP ${response.status}.`, response.status);
    }

    return parseJsonWithinLimit(response);
  }

  return {
    async searchEntities(query, entityType, { signal } = {}) {
      const parameters = [
        ["query", query],
        ["types", `urn:entity:${entityType}`],
        ["take", 5],
        ["sort_by", "match"],
      ];
      const payload = await get("/search", parameters, signal);
      return responseEntities(payload);
    },

    async getInsights(entityType, entityIds, location, { signal } = {}) {
      const parameters = [
        ["filter.type", `urn:entity:${entityType}`],
        ...entityIds.map(entityId => ["signal.interests.entities", entityId]),
        ["take", 10],
        ["feature.explainability", "true"],
      ];
      if (location && ["place", "destination"].includes(entityType)) {
        parameters.push(["signal.location.query", location]);
      }
      const payload = await get("/v2/insights/", parameters, signal);
      return {
        entities: responseEntities(payload),
        query: payload?.query ?? payload?.results?.query ?? null,
      };
    },
  };
}
