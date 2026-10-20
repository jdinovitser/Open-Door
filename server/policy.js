export const APP_POLICY = Object.freeze({
  version: "open-door-policy-v1",
  maxRequestBytes: 24 * 1024,
  maxAnchors: 5,
  maxQlooResponseBytes: 2 * 1024 * 1024,
  qlooTimeoutMs: 12_000,
  discoveryRateLimit: Object.freeze({ windowMs: 60_000, maxRequests: 20 }),
  auditBufferSize: 500,
  features: Object.freeze({
    deterministicDemo: true,
    liveQloo: true,
    browserLocalStorage: true,
    authentication: true,
    accountSavedDoors: true,
    accountProgress: true,
    roleBasedAccess: false,
    persistentAuditLog: false,
    analytics: false,
    enterpriseAdminConsole: false,
  }),
  tools: Object.freeze([
    Object.freeze({
      name: "qlooSearch",
      purpose: "Resolve user-entered cultural entities",
      inputSchema: Object.freeze({
        query: "string, normalized and limited to 120 characters",
        entityType: "fixed supported Qloo entity type",
      }),
      outputSchema: Object.freeze({
        entities: "up to 50 Qloo entities; display fields are normalized and bounded",
      }),
      permission: "public-discovery",
      risk: "external-read",
      externalService: "Qloo",
      auditEvent: "tool_call",
    }),
    Object.freeze({
      name: "qlooInsights",
      purpose: "Retrieve cross-domain cultural entities",
      inputSchema: Object.freeze({
        entityIds: "up to five resolved Qloo entity IDs",
        resultType: "fixed type selected by Open Door routing rules",
        location: "optional; sent only for supported place/destination types",
      }),
      outputSchema: Object.freeze({
        entities: "up to 50 Qloo entities; explainability is bounded before display",
      }),
      permission: "public-discovery",
      risk: "external-read",
      externalService: "Qloo",
      auditEvent: "tool_call",
    }),
  ]),
});

export function publicPolicy() {
  return {
    version: APP_POLICY.version,
    features: { ...APP_POLICY.features },
    limits: {
      requestBodyBytes: APP_POLICY.maxRequestBytes,
      anchorsPerRequest: APP_POLICY.maxAnchors,
      discoveryRequestsPerWindow: APP_POLICY.discoveryRateLimit.maxRequests,
      discoveryWindowMs: APP_POLICY.discoveryRateLimit.windowMs,
      qlooResponseBytes: APP_POLICY.maxQlooResponseBytes,
      qlooTimeoutMs: APP_POLICY.qlooTimeoutMs,
      inMemoryAuditEvents: APP_POLICY.auditBufferSize,
    },
    tools: APP_POLICY.tools.map(tool => ({ ...tool })),
  };
}
