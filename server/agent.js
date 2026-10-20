import { QlooApiError } from "./qloo.js";
import { APP_POLICY } from "./policy.js";

const ALLOWED_CATEGORIES = new Set([
  "Film", "Music", "Food", "Art", "Books", "Design", "Outdoors", "Experiences", "Other",
]);

const CATEGORY_SEARCH_TYPES = {
  Film: ["movie"],
  Music: ["artist"],
  Food: ["place", "brand"],
  Art: ["artist", "person"],
  Books: ["book"],
  Design: ["brand", "place"],
  Outdoors: ["destination", "place"],
  Experiences: ["place", "destination"],
  Other: ["person", "brand"],
};

const CATEGORY_FOR_TYPE = {
  artist: "Music",
  book: "Books",
  brand: "Design",
  destination: "Outdoors",
  movie: "Film",
  person: "Art",
  place: "Experiences",
  podcast: "Music",
  tv_show: "Film",
  video_game: "Experiences",
};
const SUPPORTED_ENTITY_TYPES = new Set(Object.keys(CATEGORY_FOR_TYPE));

// These ordered routes select Qloo Insights filter types. They are Open Door's
// routing taxonomy, not cultural relationships asserted by Qloo.
const TYPE_ROUTES = {
  artist: ["podcast", "book", "movie", "place", "destination"],
  book: ["movie", "podcast", "artist", "place", "destination"],
  brand: ["place", "artist", "book", "movie", "destination"],
  destination: ["place", "book", "artist", "podcast", "movie"],
  movie: ["book", "artist", "podcast", "place", "destination"],
  person: ["artist", "book", "movie", "place", "destination"],
  place: ["destination", "artist", "book", "podcast", "movie"],
  podcast: ["artist", "book", "movie", "place", "destination"],
  tv_show: ["movie", "book", "artist", "podcast", "place"],
  video_game: ["movie", "artist", "book", "podcast", "place"],
};

const DEPTH_OFFSET = {
  "Close to home": 0,
  "A little further": 1,
  "Surprise me": 2,
  "Take me somewhere unexpected": 3,
};

const TIERS = ["Familiar", "Adjacent", "Unexpected"];
const MAX_ANCHORS = APP_POLICY.maxAnchors;

export class AgentRequestError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = "AgentRequestError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function cleanText(value, maxLength = 140) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function normalizedName(value) {
  return cleanText(value, 180).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function stage(emit, id, status, label, detail, provenance = "OPEN DOOR ORCHESTRATION") {
  emit({ type: "stage", id, status, label, detail, provenance });
}

function qlooEntityName(entity) {
  return cleanText(entity?.name ?? entity?.properties?.name, 180);
}

function qlooEntityId(entity) {
  return cleanText(entity?.entity_id ?? entity?.id, 240);
}

function safeImageUrl(entity) {
  const value = entity?.properties?.image?.url ?? entity?.properties?.image_url;
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function safeCoordinates(entity) {
  const geocode = entity?.properties?.geocode;
  const latitude = Number(geocode?.latitude ?? geocode?.lat);
  const longitude = Number(geocode?.longitude ?? geocode?.lon ?? geocode?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function safeExplainability(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 8).map(item => safeExplainability(item, depth + 1));
  if (typeof value !== "object") return null;
  const entries = Object.entries(value)
    .filter(([key]) => !/(credential|secret|api.?key|password|bearer|token|authorization|prompt|reasoning|thought)/i.test(key))
    .slice(0, 20)
    .map(([key, item]) => [cleanText(key, 80), safeExplainability(item, depth + 1)]);
  return Object.fromEntries(entries);
}

function selectedRouteTypes(sourceType, depth, feedback) {
  const routes = TYPE_ROUTES[sourceType] ?? TYPE_ROUTES.artist;
  let offset = DEPTH_OFFSET[depth] ?? 0;
  if (feedback.includes("Too familiar") || feedback.includes("Not my scene") || feedback.includes("Just not interested")) offset += 1;
  if (feedback.includes("Too far")) offset -= 1;
  const avoidingPlaceResults = feedback.includes("Too expensive") || feedback.includes("Wrong time");
  const routePool = avoidingPlaceResults
    ? routes.filter(type => !["place", "destination"].includes(type))
    : routes;
  const availableRoutes = routePool.length >= 2 ? routePool : routes;
  const firstIndex = ((offset % availableRoutes.length) + availableRoutes.length) % availableRoutes.length;
  return {
    plan: [
      { tier: "Familiar", entityType: sourceType },
      { tier: "Adjacent", entityType: availableRoutes[firstIndex] },
      { tier: "Unexpected", entityType: availableRoutes[(firstIndex + 1) % availableRoutes.length] },
    ],
    avoidingPlaceResults,
  };
}

function contextSummary(context, occasion) {
  const parts = [
    cleanText(context?.time ?? occasion, 100),
    cleanText(context?.startTime, 60) && cleanText(context?.endTime, 60)
      ? `${cleanText(context.startTime, 60)}–${cleanText(context.endTime, 60)}`
      : "",
    cleanText(context?.budget, 100),
    cleanText(context?.movement, 100),
    cleanText(context?.conditions, 100),
  ].filter(Boolean);
  return parts.join(" · ") || "No additional context supplied";
}

export function validateDiscoveryRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AgentRequestError("INVALID_REQUEST", "Send a discovery request to continue.");
  }
  if (input.anchors !== undefined && !Array.isArray(input.anchors)) {
    throw new AgentRequestError("INVALID_ANCHORS", "Starting interests must be sent as a list.");
  }
  if (Array.isArray(input.anchors) && input.anchors.length > MAX_ANCHORS) {
    throw new AgentRequestError("TOO_MANY_ANCHORS", `Choose no more than ${MAX_ANCHORS} starting interests.`);
  }
  const anchors = Array.isArray(input.anchors)
    ? input.anchors.slice(0, MAX_ANCHORS).map(anchor => {
      const label = cleanText(typeof anchor === "string" ? anchor : anchor?.label, 120);
      const category = cleanText(typeof anchor === "string" ? "" : anchor?.category, 32);
      return { label, category: ALLOWED_CATEGORIES.has(category) ? category : "Other" };
    }).filter(anchor => anchor.label)
    : [];
  if (anchors.length === 0) {
    throw new AgentRequestError("ANCHOR_REQUIRED", "Add at least one starting interest before opening live Qloo.");
  }
  const location = cleanText(input.location, 120);
  const depth = cleanText(input.depth, 60);
  const allowedDepths = Object.keys(DEPTH_OFFSET);
  if (depth && !allowedDepths.includes(depth)) {
    throw new AgentRequestError("INVALID_DEPTH", "Choose one of the available discovery depths.");
  }
  const contextInput = input.context && typeof input.context === "object" && !Array.isArray(input.context) ? input.context : {};
  const context = {
    time: cleanText(contextInput.time ?? input.occasion, 100),
    startTime: cleanText(contextInput.startTime, 60),
    endTime: cleanText(contextInput.endTime, 60),
    budget: cleanText(contextInput.budget, 100),
    movement: cleanText(contextInput.movement, 100),
    conditions: cleanText(contextInput.conditions, 100),
  };
  const feedbackOptions = new Set([
    "Too familiar", "Too far", "Too expensive", "Not my scene", "Wrong time", "Just not interested",
  ]);
  const resolvedEntities = Array.isArray(input.resolvedEntities)
    ? input.resolvedEntities.slice(0, MAX_ANCHORS).flatMap(entity => {
      const label = cleanText(entity?.label, 120);
      const entityId = cleanText(entity?.entityId, 240);
      const entityType = cleanText(entity?.entityType, 40);
      if (!label || !entityId || !SUPPORTED_ENTITY_TYPES.has(entityType)) return [];
      const category = cleanText(entity?.category, 32);
      return [{
        label,
        entityId,
        entityType,
        category: ALLOWED_CATEGORIES.has(category) ? category : (CATEGORY_FOR_TYPE[entityType] ?? "Other"),
      }];
    })
    : [];
  return {
    anchors,
    location,
    occasion: cleanText(input.occasion ?? context.time, 100),
    intent: cleanText(input.intent, 100) || "Try something new",
    depth: depth || "A little further",
    context,
    excludedEntityIds: Array.isArray(input.excludedEntityIds)
      ? input.excludedEntityIds.filter(value => typeof value === "string").slice(0, 40)
      : [],
    feedback: Array.isArray(input.feedback)
      ? [...new Set(input.feedback.filter(value => typeof value === "string" && feedbackOptions.has(value)))]
      : [],
    resolvedEntities,
    iteration: Number.isInteger(input.iteration) && input.iteration >= 0 ? input.iteration : 0,
  };
}

function normalizeQlooCandidate(entity, requestedType) {
  const id = qlooEntityId(entity);
  const title = qlooEntityName(entity);
  if (!id || !title) return null;
  const type = requestedType;
  const category = CATEGORY_FOR_TYPE[type] ?? "Experiences";
  const subtype = cleanText(entity?.subtype, 100);
  const description = cleanText(
    entity?.properties?.description ?? entity?.properties?.short_description,
    420,
  );
  const popularity = Number(entity?.popularity);
  return {
    id,
    title,
    entityType: type,
    subtype,
    category,
    description,
    imageUrl: safeImageUrl(entity),
    coordinates: safeCoordinates(entity),
    popularity: Number.isFinite(popularity) ? popularity : null,
    explainability: safeExplainability(entity?.query?.explainability ?? entity?.explainability ?? null),
    tags: Array.isArray(entity?.tags)
      ? entity.tags.slice(0, 8).map(tag => cleanText(typeof tag === "string" ? tag : tag?.name, 80)).filter(Boolean)
      : [],
  };
}

export function buildDiscoveryGraph({ anchors, resolvedAnchors, doors, location }) {
  const nodes = [];
  const edges = [];
  const seen = new Set();
  const addNode = node => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(node);
  };

  anchors.forEach((anchor, index) => {
    const anchorNodeId = `user-anchor-${index}`;
    addNode({
      id: anchorNodeId,
      label: anchor.label,
      type: "starting-interest",
      provenance: "USER",
      category: anchor.category,
      detail: "Text and category entered by the user.",
    });
    const resolved = resolvedAnchors[index];
    if (resolved?.entityId) {
      const qlooNodeId = `qloo-entity-${resolved.entityId}`;
      addNode({
        id: qlooNodeId,
        label: resolved.entityName,
        type: "resolved-entity",
        provenance: "QLOO",
        category: anchor.category,
        detail: resolved.reusedSeedEntity
          ? `Qloo entity selected from a door in the prior journey (${resolved.entityType}).`
          : `Top Qloo Search match for this input (${resolved.entityType}).`,
        entityId: resolved.entityId,
      });
      edges.push({
        id: `resolution-${index}`,
        from: anchorNodeId,
        to: qlooNodeId,
        type: resolved.reusedSeedEntity ? "user-selected-qloo-entity" : "qloo-search-match",
        provenance: resolved.reusedSeedEntity ? "USER" : "QLOO",
        evidence: resolved.reusedSeedEntity
          ? "The user opened this exact Qloo entity from the previous journey and selected it as the next starting point."
          : "Returned by the documented Qloo Search endpoint for the user's explicit text.",
      });
    }
  });

  if (location) {
    addNode({
      id: "user-location",
      label: location,
      type: "location",
      provenance: "USER",
      detail: "Location supplied by the user; it is sent only to supported place and destination insights queries.",
    });
  }

  doors.forEach(door => {
    const candidateNodeId = `qloo-result-${door.entityId}`;
    addNode({
      id: candidateNodeId,
      label: door.title,
      type: "insight-result",
      provenance: "QLOO",
      category: door.category,
      detail: `Returned by Qloo Insights for filter.type=urn:entity:${door.entityType}.`,
      entityId: door.entityId,
      coordinates: door.coordinates,
    });
    resolvedAnchors.forEach((anchor, index) => {
      if (!anchor?.entityId) return;
      edges.push({
        id: `insight-${index}-${door.entityId}`,
        from: `qloo-entity-${anchor.entityId}`,
        to: candidateNodeId,
        type: "qloo-insights-result",
        provenance: "QLOO",
        evidence: `The candidate was returned by an Insights request conditioned on the resolved user entities. Requested output type: ${door.entityType}.`,
        explainability: door.explainability,
      });
    });
    if (location && door.coordinates && ["place", "destination"].includes(door.entityType)) {
      edges.push({
        id: `geo-${door.entityId}`,
        from: "user-location",
        to: candidateNodeId,
        type: "qloo-geographic-result",
        provenance: "QLOO",
        evidence: "Qloo returned coordinates for this entity in a location-shaped query.",
      });
    }
  });

  return { nodes, edges };
}

export async function runDiscovery(input, { qloo, emit = () => {}, signal, onToolEvent = () => {} } = {}) {
  if (!qloo?.searchEntities || !qloo?.getInsights) {
    throw new TypeError("A Qloo client is required for live discovery");
  }
  const request = validateDiscoveryRequest(input);

  stage(emit, "intent-analysis", "running", "Reading your starting point", "Using only the interests, categories, depth, and context you supplied.");
  const sourceCategory = request.anchors[0].category;
  const sourceType = (CATEGORY_SEARCH_TYPES[sourceCategory] ?? ["artist"])[0];
  stage(emit, "intent-analysis", "complete", "Starting point understood", `${request.anchors.length} explicit interest${request.anchors.length === 1 ? "" : "s"} · ${request.intent} · ${request.depth}.`);

  stage(emit, "entity-resolution", "running", "Resolving your interests", "Searching entered text with Qloo or preserving a Qloo entity that you selected from a previous door.", "QLOO + USER");
  let searchCalls = 0;
  const resolvedAnchors = await Promise.all(request.anchors.map(async anchor => {
    const selectedEntity = request.resolvedEntities.find(entity => normalizedName(entity.label) === normalizedName(anchor.label));
    if (selectedEntity) {
      return {
        label: anchor.label,
        category: anchor.category,
        entityType: selectedEntity.entityType,
        entityId: selectedEntity.entityId,
        entityName: selectedEntity.label,
        exactNameMatch: true,
        reusedSeedEntity: true,
      };
    }
    const types = CATEGORY_SEARCH_TYPES[anchor.category] ?? ["artist"];
    for (const entityType of types) {
      searchCalls += 1;
      const toolStartedAt = Date.now();
      onToolEvent({ toolName: "qlooSearch", outcome: "started" });
      let matches;
      try {
        matches = await qloo.searchEntities(anchor.label, entityType, { signal });
        onToolEvent({ toolName: "qlooSearch", outcome: "success", durationMs: Date.now() - toolStartedAt });
      } catch (error) {
        onToolEvent({ toolName: "qlooSearch", outcome: error?.code || "failed", durationMs: Date.now() - toolStartedAt });
        throw error;
      }
      const best = matches.find(entity => qlooEntityId(entity) && qlooEntityName(entity));
      if (best) {
        return {
          label: anchor.label,
          category: anchor.category,
          entityType,
          entityId: qlooEntityId(best),
          entityName: qlooEntityName(best),
          exactNameMatch: normalizedName(qlooEntityName(best)) === normalizedName(anchor.label),
          reusedSeedEntity: false,
        };
      }
    }
    return { label: anchor.label, category: anchor.category, entityType: types[0], entityId: "", entityName: "", exactNameMatch: false, reusedSeedEntity: false };
  }));
  const resolved = resolvedAnchors.filter(anchor => anchor.entityId);
  const unresolved = resolvedAnchors.filter(anchor => !anchor.entityId);
  if (resolved.length === 0) {
    throw new AgentRequestError("UNRESOLVED_ANCHORS", "Qloo could not resolve these starting interests. Try a more specific title, artist, place, or book name.", 422, {
      unresolvedAnchors: unresolved.map(anchor => anchor.label),
    });
  }
  stage(
    emit,
    "entity-resolution",
    "complete",
    "Starting entities resolved",
    `${resolved.length} of ${request.anchors.length} interests resolved${unresolved.length ? ` · ${unresolved.length} not matched` : ""} · ${searchCalls} Qloo Search request${searchCalls === 1 ? "" : "s"}.`,
    searchCalls ? "QLOO SEARCH" : "USER-SELECTED QLOO ENTITY",
  );

  const entityIds = [...new Set(resolved.map(anchor => anchor.entityId))];
  const { plan: routePlan, avoidingPlaceResults } = selectedRouteTypes(
    resolved[0].entityType,
    request.depth,
    request.feedback,
  );
  const rawResults = [];
  const tools = [{
    name: "resolveEntities",
    endpoint: searchCalls ? "GET /search" : "No Search call; previously returned Qloo entity selected",
    source: searchCalls ? "QLOO" : "USER + QLOO",
    calls: searchCalls,
    reusedEntityCount: resolved.filter(anchor => anchor.reusedSeedEntity).length,
    resolvedCount: resolved.length,
    unresolvedCount: unresolved.length,
    resolved: resolved.map(({ label, entityId, entityName, entityType, exactNameMatch, reusedSeedEntity }) => ({
      label, entityId, entityName, entityType, exactNameMatch, reusedSeedEntity,
    })),
  }];

  stage(emit, "qloo-exploration", "running", "Exploring Qloo cultural insights", `Querying three documented entity types using ${entityIds.length} resolved Qloo entities.`, "QLOO INSIGHTS");
  let insightCalls = 0;
  let insightFailures = 0;
  for (const route of routePlan) {
    const toolStartedAt = Date.now();
    onToolEvent({ toolName: "qlooInsights", outcome: "started" });
    try {
      const result = await qloo.getInsights(route.entityType, entityIds, request.location, { signal });
      onToolEvent({ toolName: "qlooInsights", outcome: "success", durationMs: Date.now() - toolStartedAt });
      insightCalls += 1;
      const candidates = (Array.isArray(result?.entities) ? result.entities : [])
        .map(entity => normalizeQlooCandidate(entity, route.entityType))
        .filter(Boolean);
      rawResults.push({ ...route, candidates, query: result?.query ?? null });
      tools.push({
        name: "exploreCrossDomain",
        endpoint: "GET /v2/insights/",
        source: "QLOO",
        filterType: `urn:entity:${route.entityType}`,
        inputEntityCount: entityIds.length,
        locationApplied: Boolean(request.location && ["place", "destination"].includes(route.entityType)),
        candidateCount: candidates.length,
        explainabilityRequested: true,
      });
    } catch (error) {
      onToolEvent({
        toolName: "qlooInsights",
        outcome: error?.code || "failed",
        durationMs: Date.now() - toolStartedAt,
      });
      insightFailures += 1;
      tools.push({
        name: "exploreCrossDomain",
        endpoint: "GET /v2/insights/",
        source: "QLOO",
        filterType: `urn:entity:${route.entityType}`,
        errorCode: error?.code ?? "QLOO_REQUEST_FAILED",
      });
      if (insightCalls === 0 && insightFailures === routePlan.length) throw error;
    }
  }
  if (insightCalls === 0) {
    throw new AgentRequestError("QLOO_INSIGHTS_UNAVAILABLE", "Qloo Insights could not return a result for this request. Try again or change the starting interests.", 502);
  }
  const returnedCount = rawResults.reduce((sum, result) => sum + result.candidates.length, 0);
  stage(
    emit,
    "qloo-exploration",
    insightFailures ? "complete-with-warning" : "complete",
    "Qloo Insights returned candidates",
    `${insightCalls} Insights request${insightCalls === 1 ? "" : "s"} completed · ${returnedCount} candidate${returnedCount === 1 ? "" : "s"} returned${insightFailures ? ` · ${insightFailures} request${insightFailures === 1 ? "" : "s"} failed` : ""}.`,
    "QLOO INSIGHTS",
  );

  stage(emit, "location-context", "running", "Applying location and stated context", "Location is sent only with place and destination queries. Budget, time, movement, and energy are not treated as verified venue facts.");
  stage(
    emit,
    "location-context",
    "complete",
    "Context limits recorded",
    `${request.location ? "Location applied where supported" : "No location filter supplied"} · ${contextSummary(request.context, request.occasion)}.`,
  );

  stage(emit, "candidate-evaluation", "running", "Evaluating returned candidates", "Keeping Qloo's response order, removing duplicate entities, and excluding already-opened entity IDs.");
  const excluded = new Set(request.excludedEntityIds);
  const seen = new Set();
  const selected = [];
  for (let index = 0; index < rawResults.length; index += 1) {
    const result = rawResults[index];
    const candidate = result.candidates.find(item => !seen.has(item.id) && !excluded.has(item.id));
    if (!candidate) continue;
    seen.add(candidate.id);
    const anchorsText = resolved.map(anchor => anchor.label).join(", ");
    const exactMatchNote = resolved.every(anchor => anchor.exactNameMatch)
      ? " Qloo Search names matched the entered text exactly."
      : " Review the resolved entity names in Under the Door before relying on an ambiguous match.";
    const distanceRationale = result.tier === "Familiar"
      ? `Same Qloo entity type as the first resolved starting interest (${result.entityType}).`
      : `Different Qloo entity type selected by Open Door's ${request.depth.toLowerCase()} routing taxonomy; not a Qloo distance score.`;
    const contextText = contextSummary(request.context, request.occasion);
    selected.push({
      id: `qloo-${candidate.id}`,
      entityId: candidate.id,
      entityType: candidate.entityType,
      tier: result.tier,
      title: candidate.title,
      kind: candidate.subtype || `urn:entity:${candidate.entityType}`,
      category: candidate.category,
      source: anchorsText,
      sourceEntityIds: entityIds,
      thread: `${anchorsText} → Qloo ${candidate.category} result`,
      why: `Qloo returned “${candidate.title}” in an Insights request conditioned on your resolved interests: ${anchorsText}.${exactMatchNote}`,
      whyYou: `You explicitly chose ${anchorsText}.`,
      whyNow: `You specified ${contextText}. Qloo does not verify current opening hours, availability, or price.`,
      now: `You specified ${contextText}. Qloo does not verify current opening hours, availability, or price.`,
      evidence: `Qloo Insights API · GET /v2/insights/ · filter.type=urn:entity:${candidate.entityType} · result ${candidate.title}.`,
      description: candidate.description,
      imageUrl: candidate.imageUrl,
      popularity: candidate.popularity,
      explainability: candidate.explainability,
      tags: candidate.tags,
      coordinates: candidate.coordinates,
      discoveryDistance: {
        tier: result.tier,
        ordinal: TIERS.indexOf(result.tier) + 1,
        rationale: distanceRationale,
        isQlooScore: false,
      },
      queryContext: {
        intent: request.intent,
        depth: request.depth,
        location: request.location,
        context: request.context,
      },
    });
  }
  if (selected.length === 0) {
    throw new AgentRequestError("NO_CANDIDATES", "Qloo returned no distinct candidates for these routes. Try broader interests or a different discovery depth.", 422);
  }
  const partial = selected.length < TIERS.length;
  stage(
    emit,
    "candidate-evaluation",
    partial ? "complete-with-warning" : "complete",
    "Candidates evaluated",
    `${selected.length} distinct Qloo result${selected.length === 1 ? "" : "s"} selected in Qloo response order.`,
    "QLOO RESULTS + OPEN DOOR FILTERS",
  );

  stage(
    emit,
    "novelty-balance",
    "running",
    "Setting Discovery Distance",
    `Using result type and your selected exploration depth${request.feedback.length ? ` plus ${request.feedback.length} explicit feedback choice${request.feedback.length === 1 ? "" : "s"}` : ""}; no psychological or Qloo distance score is inferred.`,
  );
  stage(
    emit,
    "novelty-balance",
    "complete",
    "Familiar, adjacent, and unexpected paths labeled",
    "The ordinal labels describe Open Door's query routing, not a measured personality trait or Qloo score.",
  );

  stage(emit, "door-selection", "running", "Selecting your doors", "Selecting up to one distinct Qloo result for each route; missing results are not fabricated.");
  const notices = [];
  if (partial) notices.push(`Qloo returned ${selected.length} of 3 distinct routes. No sample results were added.`);
  if (unresolved.length) notices.push(`${unresolved.length} starting interest${unresolved.length === 1 ? " was" : "s were"} not resolved and did not contribute to the query.`);
  if (insightFailures) notices.push(`${insightFailures} Qloo Insights request${insightFailures === 1 ? "" : "s"} failed.`);
  if (request.feedback.length) {
    notices.push(avoidingPlaceResults
      ? "Your explicit feedback routed this exploration away from place and destination results; no price or schedule data is inferred."
      : `Your explicit feedback changed the next Qloo route: ${request.feedback.join(", ")}.`);
  }
  stage(
    emit,
    "door-selection",
    partial ? "complete-with-warning" : "complete",
    `${selected.length} door${selected.length === 1 ? "" : "s"} selected`,
    partial ? notices[0] : "Each selected door is an entity returned by Qloo; the app adds no synthetic venue listings.",
    "QLOO",
  );

  stage(emit, "journey-generation", "running", "Building your discovery journey", "Preparing the result cards, provenance graph, and request inspector from returned data.");
  const graph = buildDiscoveryGraph({
    anchors: request.anchors,
    resolvedAnchors,
    doors: selected,
    location: request.location,
  });
  const journey = {
    mode: "live",
    city: request.location || "Location not specified",
    occasion: request.occasion,
    intent: request.intent,
    depth: request.depth,
    anchors: request.anchors.map(anchor => anchor.label),
    categories: Object.fromEntries(request.anchors.map(anchor => [anchor.label, anchor.category])),
    context: request.context,
    feedbackApplied: request.feedback,
    iteration: request.iteration,
    doors: selected,
    graph,
    resolvedAnchors,
    tools,
    notices,
    generatedAt: new Date().toISOString(),
    methodology: {
      agent: "Open Door structured tool orchestration",
      llmUsed: false,
      qlooBase: "https://hackathon.api.qloo.com",
      qlooEndpoints: [...(searchCalls ? ["/search"] : []), "/v2/insights/"],
      discoveryDistance: "Open Door ordinal routing labels; not a Qloo score or psychological inference.",
      candidateOrder: "Preserves Qloo Insights response order after duplicate and opened-entity filtering.",
      feedback: "Explicit feedback changes the requested Qloo result types; no price, schedule, or personal preference is inferred.",
    },
  };
  stage(emit, "journey-generation", "complete", "Journey ready", "Live Qloo response data is labeled separately from user inputs and Open Door routing logic.", "QLOO + OPEN DOOR");
  return journey;
}

export function getAgentError(error) {
  if (error instanceof AgentRequestError || error instanceof QlooApiError) {
    return {
      status: error.status || 502,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }
  return {
    status: 500,
    code: "AGENT_ERROR",
    message: "Open Door could not complete this live discovery. Try again.",
  };
}
