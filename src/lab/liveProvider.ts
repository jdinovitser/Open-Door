import { runAgentDiscovery, type LiveJourney } from "../agentApi.ts";
import { constraintNotes } from "./demoProvider.ts";
import { adaptToScenario } from "./scenarios.ts";
import { type DiscoveryProvider, type Snapshot, type Strategy } from "./model.ts";

const depths = { familiar: "Close to home", adjacent: "A little further", unexpected: "Take me somewhere unexpected" };
// These are Qloo entity types, not verified industry or suitability labels.
const domainTypes: Record<string, string[]> = {
  Music: ["artist", "podcast"], Film: ["movie", "tv_show"], Books: ["book"],
  Food: ["place", "brand"], Fashion: ["brand"], Architecture: ["place", "brand"],
  Art: ["person", "artist"], Places: ["place", "destination"],
};
export function liveRequest(snapshot: Snapshot, strategy: Strategy) {
  const settings = snapshot.settings;
  const intents = { stay: "Go deeper", thread: "Go deeper", cross: "Try something new", people: "Find my people", wild: "Try something new", real: "Try something new" };
  const category = (value: string) => ["Film", "Music", "Food", "Art", "Books", "Design", "Outdoors", "Experiences", "Other"].includes(value) ? value : /fashion|architecture/i.test(value) ? "Design" : value === "Places" ? "Outdoors" : "Other";
  return {
    location: settings.location, occasion: `${settings.time} · ${settings.occasion}`,
    intent: intents[strategy], depth: depths[settings.adventure],
    ...(settings.domain !== "Any" ? { resultTypes: domainTypes[settings.domain] }
      : strategy === "real" || strategy === "people" ? { resultTypes: ["place", "destination"] } : {}),
    context: {
      time: settings.time, budget: settings.budget, movement: settings.movement,
      conditions: [settings.conditions, `Mood: ${settings.mood}`, `Branch: ${strategy}`, settings.groupInterests && `Volunteered group interests: ${settings.groupInterests}`, settings.domain !== "Any" && `Requested domain: ${settings.domain}`].filter(Boolean).join(" · "),
    },
    anchors: snapshot.anchors.map(label => ({ label, category: category(snapshot.categories[label] || snapshot.selected?.domain || "Other") })),
    resolvedEntities: snapshot.selected?.mode === "live" && snapshot.selected.entityId && snapshot.selected.entityType
      ? [{ label: snapshot.selected.title, category: category(snapshot.selected.domain), entityId: snapshot.selected.entityId, entityType: snapshot.selected.entityType }] : [],
    excludedEntityIds: [...new Set(snapshot.history.flatMap(step => step.discoveries.flatMap(item => item.entityId ? [item.entityId] : [])))],
    feedback: Object.values(snapshot.feedback).map(item => item.action === "keep" ? "Keep this direction" : item.reason || "Just not interested"),
    iteration: snapshot.history.length + 1,
  };
}
export function createLiveProvider(
  run: typeof runAgentDiscovery = runAgentDiscovery,
): DiscoveryProvider {
  return {
    id: "live",
    async discover({ snapshot, strategy, signal }) {
      const journey: LiveJourney = await run(liveRequest(snapshot, strategy), () => {}, signal);
      if (journey.mode !== "live") throw new Error("The server did not return a successful Live journey.");
      const requestedTypes = domainTypes[snapshot.settings.domain];
      const candidates = journey.doors.filter(door => !requestedTypes || !!door.entityType && requestedTypes.includes(door.entityType));
      return {
        mode: "live", notices: [...journey.notices, "Qloo supplies cultural connections. Your time, budget, access needs and occasion are planning inputs, not verified suitability. Domain choices request related entity types; they do not verify a place's cuisine, architecture or accessibility. Check practical details before visiting."],
        discoveries: candidates.map(door => adaptToScenario({
          id: door.id, title: door.title, domain: door.category, description: door.description,
          connection: door.why, originalConnection: `Original anchors: ${snapshot.originalAnchors.join(", ")}. Current query anchors: ${snapshot.anchors.join(", ")}. Only the returned evidence below is provider-backed; ancestry alone is not a Qloo relationship.`,
          evidence: door.evidence || "No relationship explanation returned.", mode: "live", source: door.source,
          selection: `${strategy} strategy; Open Door selected ${door.tier.toLowerCase()} route. ${door.thread}`,
          entityId: door.entityId, entityType: door.entityType, constraints: constraintNotes(snapshot),
          plan: strategy === "real" ? [`Planning suggestion: investigate “${door.title}” in ${snapshot.settings.location}.`, `Check access, prices, opening hours and travel yourself before committing your ${snapshot.settings.time.toLowerCase()}.`] : undefined,
        }, snapshot.settings)),
      };
    },
  };
}
