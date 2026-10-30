import type { DiscoveryRequest, LiveJourney } from "../agentApi";
import type { WhatIfStart } from "./whatIf";
import type { LabSeed } from "../lab/model";
export type HandoffJourney = Pick<LiveJourney, "city" | "occasion" | "intent" | "depth" | "context" | "anchors" | "categories" | "iteration">
  & Partial<Pick<LiveJourney, "resolvedAnchors" | "feedbackApplied">>
  & { doors: Array<Pick<LiveJourney["doors"][number], "id" | "title" | "category" | "tier"> & Partial<Pick<LiveJourney["doors"][number], "entityId" | "entityType">>> };

// Reuse resolved IDs and the exact public planning inputs, never participant
// names, private scenarios, or a reconstructed profile.
export function requestFromJourney(journey: HandoffJourney, excludeResults = false): DiscoveryRequest {
  return {
    location: journey.city, occasion: journey.occasion, intent: journey.intent, depth: journey.depth,
    context: { ...journey.context },
    anchors: journey.anchors.map(label => ({ label, category: journey.categories[label] || "Other" })),
    resolvedEntities: (journey.resolvedAnchors || []).map(anchor => ({
      label: anchor.label, category: anchor.category, entityId: anchor.entityId, entityType: anchor.entityType,
    })),
    feedback: [...(journey.feedbackApplied || [])], iteration: journey.iteration,
    ...(excludeResults ? { excludedEntityIds: journey.doors.map(door => door.entityId).filter((id): id is string => !!id) } : {}),
  };
}

export function referenceToLab(start: WhatIfStart): LabSeed {
  const mode = start.mode === "live" ? "live" : "demo";
  return {
    anchors: start.request.anchors.map(anchor => anchor.label),
    categories: Object.fromEntries(start.request.anchors.map(anchor => [anchor.label, anchor.category])),
    location: start.request.location, context: { ...start.request.context, intent: start.request.intent, depth: start.request.depth, time: start.request.occasion },
    mode, feedback: {},
    discoveries: start.doors.map(door => ({
      id: door.id, title: door.title, domain: door.category, description: door.category,
      connection: "Preserved starting-result reference; detailed historical relationship metadata is not retained in this snapshot.",
      originalConnection: `Starting interests: ${start.request.anchors.map(anchor => anchor.label).join(", ")}.`,
      evidence: mode === "live" ? "Historical Qloo result reference, not a new API request." : "Authored prepared example, not Qloo evidence.",
      mode, source: mode === "live" ? "Historical Qloo entity reference" : "Authored example",
      selection: door.tier || "Starting point", constraints: [],
      entityId: mode === "live" ? door.entityId : undefined,
      entityType: mode === "live" ? door.entityType : undefined,
    })),
  };
}

export function whatIfFromJourney(journey: HandoffJourney, id: string): WhatIfStart {
  return {
    id, origin: "journey", label: `Discovery: ${journey.doors.map(door => door.title).join(", ")}`,
    mode: "live", request: requestFromJourney(journey),
    doors: journey.doors.map(({ id, title, category, tier, entityId, entityType }) => ({ id, title, category, tier, entityId, entityType })),
  };
}
