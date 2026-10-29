import type { DiscoveryRequest, LiveDoor, LiveJourney } from "../agentApi";

export const BRIDGE_CATEGORIES = ["Film", "Music", "Food", "Art", "Books", "Design", "Outdoors", "Experiences", "Other"] as const;
export type BridgeCategory = typeof BRIDGE_CATEGORIES[number];
export type BridgeInterest = { id: string; label: string; category: BridgeCategory };
export type BridgePerson = { id: string; name: string; interests: BridgeInterest[] };
export type BridgeContributor = { personId: string; name: string; interests: LiveJourney["resolvedAnchors"] };
export const normalizeInterest = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export function bridgeAnchors(people: BridgePerson[]): DiscoveryRequest["anchors"] {
  const unique = new Map<string, DiscoveryRequest["anchors"][number]>();
  for (const person of people) for (const interest of person.interests) {
    const label = interest.label.trim().replace(/\s+/g, " ");
    if (label) unique.set(`${normalizeInterest(label)}|${interest.category}`, { label, category: interest.category });
  }
  return [...unique.values()];
}

export function validateBridge(people: BridgePerson[], maxAnchors: number): string[] {
  const errors: string[] = [];
  if (people.length < 2 || people.length > 5) errors.push("Taste Bridge needs two to five people.");
  if (people.some(person => !person.name.trim())) errors.push("Give each person a name or label.");
  if (people.some(person => !person.interests.length || person.interests.some(interest => !interest.label.trim()))) {
    errors.push("Add an interest for every person and fill or remove any empty interest rows.");
  }
  if (people.some(person => person.interests.some(interest => interest.label.trim().length > 120))) errors.push("Keep each interest within 120 characters.");
  const anchors = bridgeAnchors(people);
  if (new Set(anchors.map(anchor => normalizeInterest(anchor.label))).size !== anchors.length) errors.push("Use the same category when an interest is shared by more than one person.");
  if (anchors.length > maxAnchors) errors.push(`This connection accepts at most ${maxAnchors} distinct interests per request. Remove ${anchors.length - maxAnchors} before continuing; no interests will be dropped.`);
  return errors;
}

export function createBridgeRequest(people: BridgePerson[], location: string, occasion: string, maxAnchors: number): DiscoveryRequest {
  const errors = validateBridge(people, maxAnchors);
  if (errors.length) throw new Error(errors.join(" "));
  if (location.trim().length > 120 || occasion.trim().length > 100) throw new Error("Shorten the location or occasion before continuing.");
  // Names and person IDs stay in React state. The existing API receives only cultural inputs.
  return {
    location: location.trim(), occasion: occasion.trim(), intent: "Find my people", depth: "Take me somewhere unexpected",
    context: { time: occasion.trim(), budget: "Flexible", movement: "Open to anything", conditions: "Open to anything" },
    anchors: bridgeAnchors(people), feedback: [], iteration: 0,
  };
}

export function bridgeContributors(people: BridgePerson[], journey: LiveJourney, door: LiveDoor): BridgeContributor[] {
  const ids = new Set(door.sourceEntityIds || []);
  return people.flatMap((person, index) => {
    const interests = journey.resolvedAnchors.filter(resolved =>
      ids.has(resolved.entityId) && person.interests.some(interest =>
        normalizeInterest(interest.label) === normalizeInterest(resolved.label) && interest.category === resolved.category));
    return interests.length ? [{ personId: person.id, name: person.name.trim() || `Person ${index + 1}`, interests }] : [];
  });
}

export const BRIDGE_ROUTES = [
  { title: "Shared Ground", tier: "Familiar", note: "A familiar direction from the combined resolved interests—not confirmation of something everyone likes." },
  { title: "The Bridge", tier: "Adjacent", note: "A related cultural direction returned for the combined interests. A place to start a conversation, not proof of a relationship between each pair." },
  { title: "The Wild Card", tier: "Unexpected", note: "A different cultural category to explore together—not a measured surprise score or a prediction of anyone’s taste." },
] as const;

export function bridgeRouteDoors(journey: LiveJourney, tier: LiveDoor["tier"]): LiveDoor[] {
  return journey.doors.filter(door => door.tier === tier && door.entityId &&
    (tier !== "Unexpected" || door.unexpectedCrossCategory === true));
}
