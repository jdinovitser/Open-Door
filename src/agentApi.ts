export type AgentStatus = {
  qlooConfigured: boolean;
  sharedQlooConfigured?: boolean;
  personalQlooConnected?: boolean;
  connectionSource?: "shared" | "personal" | "none";
  connectionExpiresAt?: string | null;
  agent: string;
  demoAvailable: boolean;
  authenticationConfigured?: boolean;
  policy?: PolicyStatus;
};

export type PolicyStatus = {
  version: string;
  features: Record<string, boolean>;
  limits: {
    requestBodyBytes: number;
    anchorsPerRequest: number;
    discoveryRequestsPerWindow: number;
    discoveryWindowMs: number;
    qlooResponseBytes: number;
    qlooTimeoutMs: number;
    inMemoryAuditEvents: number;
  };
  tools: Array<{
    name: string;
    purpose: string;
    inputSchema: Record<string, string>;
    outputSchema: Record<string, string>;
    permission: string;
    risk: string;
    externalService: string;
    auditEvent: string;
  }>;
};

export type AgentHealth = {
  status: string;
  checkedAt: string;
  components: Record<string, string>;
  policy: PolicyStatus;
};

export type ProgressSummary = {
  doorsOpened: number;
  braveDoorsOpened: number;
  categories: string[];
};

export type AgentStageEvent = {
  type: "stage";
  id: string;
  status: "running" | "complete" | "complete-with-warning";
  label: string;
  detail: string;
  provenance: string;
};

export type LiveDoor = {
  id: string;
  entityId: string;
  entityType: string;
  tier: "Familiar" | "Adjacent" | "Unexpected";
  title: string;
  kind: string;
  category: string;
  source: string;
  sourceEntityIds: string[];
  thread: string;
  why: string;
  whyYou: string;
  whyNow: string;
  now: string;
  evidence: string;
  description: string;
  imageUrl: string;
  popularity: number | null;
  explainability: unknown;
  tags: string[];
  coordinates: { latitude: number; longitude: number } | null;
  discoveryDistance: {
    tier: string;
    ordinal: number;
    rationale: string;
    isQlooScore: false;
  };
  queryContext: {
    intent: string;
    depth: string;
    location: string;
    context: Record<string, string>;
  };
};

export type DiscoveryGraphNode = {
  id: string;
  label: string;
  type: string;
  provenance: "USER" | "QLOO";
  category?: string;
  detail: string;
  entityId?: string;
  coordinates?: { latitude: number; longitude: number } | null;
};

export type DiscoveryGraphEdge = {
  id: string;
  from: string;
  to: string;
  type: string;
  provenance: "USER" | "QLOO";
  evidence: string;
  explainability?: unknown;
};

export type LiveJourney = {
  mode: "live";
  city: string;
  occasion: string;
  intent: string;
  depth: string;
  anchors: string[];
  categories: Record<string, string>;
  context: Record<string, string>;
  iteration: number;
  feedbackApplied: string[];
  doors: LiveDoor[];
  graph: { nodes: DiscoveryGraphNode[]; edges: DiscoveryGraphEdge[] };
  resolvedAnchors: Array<{
    label: string;
    category: string;
    entityType: string;
    entityId: string;
    entityName: string;
    exactNameMatch: boolean;
    reusedSeedEntity: boolean;
  }>;
  tools: Array<Record<string, unknown>>;
  notices: string[];
  generatedAt: string;
  methodology: {
    agent: string;
    llmUsed: false;
    qlooBase: string;
    qlooEndpoints: string[];
    discoveryDistance: string;
    candidateOrder: string;
    requestId?: string;
  };
};

export type DiscoveryRequest = {
  location: string;
  occasion: string;
  intent: string;
  depth: string;
  context: Record<string, string>;
  anchors: Array<{ label: string; category: string }>;
  resolvedEntities?: Array<{ label: string; category: string; entityId: string; entityType: string }>;
  excludedEntityIds?: string[];
  feedback?: string[];
  iteration?: number;
};

export type AgentEvent = AgentStageEvent | { type: "complete"; journey: LiveJourney } | {
  type: "error";
  code: string;
  message: string;
  details?: unknown;
};

export class AgentApiError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AgentApiError";
    this.code = code;
    this.details = details;
  }
}

export type QlooConnectionSource = "shared" | "personal";
let connectionSource: QlooConnectionSource = (() => {
  try { return sessionStorage.getItem("opendoor.qloo.source") === "personal" ? "personal" : "shared"; }
  catch { return "shared"; }
})();
export function getQlooConnectionSource(): QlooConnectionSource { return connectionSource; }
export function setQlooConnectionSource(source: QlooConnectionSource) {
  connectionSource = source;
  try { sessionStorage.setItem("opendoor.qloo.source", source); } catch { /* Selection is optional storage, never a credential. */ }
}

export async function getAgentStatus(): Promise<AgentStatus> {
  const response = await fetch("/api/status", { headers: { Accept: "application/json", "X-Qloo-Connection": connectionSource } });
  if (!response.ok) throw new Error("Open Door's status endpoint is unavailable.");
  return response.json() as Promise<AgentStatus>;
}

export async function getAgentHealth(): Promise<AgentHealth> {
  const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Open Door's health endpoint is unavailable.");
  return response.json() as Promise<AgentHealth>;
}

export async function runAgentDiscovery(
  request: DiscoveryRequest,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<LiveJourney> {
  const response = await fetch("/api/agent/discover", {
    method: "POST",
    headers: {
      Accept: "application/x-ndjson",
      "Content-Type": "application/json",
      "X-Qloo-Connection": connectionSource,
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new AgentApiError(
      typeof error.code === "string" ? error.code : "AGENT_REQUEST_FAILED",
      typeof error.message === "string" ? error.message : "Open Door could not start live discovery.",
      error.details,
    );
  }
  if (!response.body) throw new AgentApiError("STREAM_UNAVAILABLE", "The live discovery stream is unavailable.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let result: LiveJourney | undefined;

  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AgentEvent;
    onEvent(event);
    if (event.type === "complete") result = event.journey;
    if (event.type === "error") throw new AgentApiError(event.code, event.message, event.details);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      lines.forEach(consumeLine);
      if (done) break;
    }
    if (pending.trim()) consumeLine(pending);
  } finally {
    reader.releaseLock();
  }

  if (!result) throw new AgentApiError("MISSING_RESULT", "Live discovery ended without a completed journey.");
  return result;
}
