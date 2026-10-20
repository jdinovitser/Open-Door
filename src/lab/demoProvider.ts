import { DOMAINS, STRATEGIES, type Compatibility, type DiscoveryProvider, type Domain, type Snapshot, type Strategy } from "./model.ts";

// These are authored exercises, not real people, venues, products or cultural graph edges.
const CATALOG: Record<Domain, string[]> = {
  Music: ["A one-record listening notebook", "A found-sound composition", "A rhythm-and-memory playlist", "A quiet album exchange", "A melody drawing exercise", "A soundwalk at home"],
  Film: ["A single-scene close reading", "A silent short-film storyboard", "A color-led film notebook", "A two-scene screening discussion", "A handmade title sequence", "A frame-by-frame sketch"],
  Books: ["A marginalia reading ritual", "A pocket zine of remembered places", "A poetry-and-object exchange", "A shared passage reading", "A story told through captions", "A one-page oral-history prompt"],
  Food: ["A pantry flavor notebook", "A recipe-memory interview", "A table-setting sketch", "A shared recipe story", "An ingredient color study", "A tea-and-story ritual"],
  Fashion: ["A wardrobe texture study", "An outfit-and-memory story", "A fabric color collage", "A clothing repair circle", "A silhouette sketchbook", "A personal-style archive"],
  Art: ["A small-object drawing ritual", "A collaborative paper collage", "A one-color visual diary", "A shared still-life session", "A texture-rubbing notebook", "A miniature found-object exhibit"],
  Architecture: ["A doorway detail sketch", "A light-and-shadow room study", "A model made from scrap paper", "A shared streetscape drawing", "A window-pattern notebook", "A memory-map of a room"],
  Places: ["A nearby detail field note", "A hand-drawn memory map", "A quiet public-space observation", "A familiar-route story exchange", "A neighborhood color notebook", "A personal place-name archive"],
};
const hash = (value: string) => [...value].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 17);
export function normalizeDomain(value: string): Domain {
  if (DOMAINS.includes(value as Domain)) return value as Domain;
  if (/music|jazz|album|song|sound/i.test(value)) return "Music";
  if (/cinema|movie|film/i.test(value)) return "Film";
  if (/novel|book|poetry|reading/i.test(value)) return "Books";
  if (/food|cook|breakfast|recipe|tea/i.test(value)) return "Food";
  if (/fashion|clothing|wardrobe/i.test(value)) return "Fashion";
  if (/design|architecture/i.test(value)) return "Architecture";
  if (/outdoor|place|experience/i.test(value)) return "Places";
  return "Art";
}
export function constraintNotes(snapshot: Snapshot): Compatibility[] {
  const s = snapshot.settings;
  return [
    { constraint: "Place", value: s.location || "Not supplied", status: "Unverified", detail: "No venue, travel route, access or opening hours verified." },
    { constraint: "Time", value: s.time, status: "Planning input", detail: "An adjustable self-guided prompt, not a measured duration or event schedule." },
    { constraint: "Budget", value: s.budget || "Not supplied", status: "Unverified", detail: "Use materials already available where possible; prices and costs are not verified." },
    { constraint: "Occasion", value: s.occasion, status: "Planning input", detail: "A format selected by you, not evidence that other people or a group are available." },
    { constraint: "Access & conditions", value: [s.movement, s.conditions].filter(Boolean).join(" · ") || "Not supplied", status: "Unverified", detail: "Check suitability, safety, accessibility and any dietary needs yourself." },
  ];
}
type DemoBase = (snapshot: Snapshot) => Array<{ category: string; title: string; evidence: string }>;
export function createDemoProvider(baseDiscovery: DemoBase): DiscoveryProvider {
  return {
    id: "demo",
    async discover({ snapshot, strategy, signal }) {
      if (signal?.aborted) throw new DOMException("Discovery cancelled", "AbortError");
      const base = baseDiscovery(snapshot);
      const definition = STRATEGIES.find(item => item.id === strategy)!;
      const anchor = snapshot.anchors.join(" + ");
      const original = snapshot.originalAnchors.join(" + ");
      const category = snapshot.selected?.domain || snapshot.categories[snapshot.anchors[0]];
      const anchorDomain = normalizeDomain(category === "User interest" || !category ? snapshot.anchors[0] : category);
      const originIndex = DOMAINS.indexOf(anchorDomain);
      const moodOffset = ["Creative", "Cozy", "Social", "Adventurous", "Unusual"].indexOf(snapshot.settings.mood);
      const adventureOffset = { familiar: 0, adjacent: 1, unexpected: 3 }[snapshot.settings.adventure];
      const seed = hash(`${anchor}|${strategy}|${snapshot.settings.mood}|${snapshot.settings.time}|${snapshot.settings.groupInterests}`);
      const batchIds = new Set<string>();
      const discoveries = Array.from({ length: 3 }, (_, index) => {
        const offsets: Record<Strategy, number> = { stay: 0, thread: 1, cross: 3, people: 0, wild: 5, real: 0 };
        let domain = strategy === "stay" ? anchorDomain : DOMAINS[(originIndex + offsets[strategy] + index + adventureOffset) % DOMAINS.length];
        if (strategy === "thread" && base[index]) domain = normalizeDomain(base[index].category);
        if (snapshot.settings.domain !== "Any") domain = snapshot.settings.domain;
        if ((strategy === "cross" || strategy === "wild") && domain === anchorDomain && snapshot.settings.domain === "Any") domain = DOMAINS[(originIndex + 4 + index) % DOMAINS.length];
        const activities = CATALOG[domain];
        const start = (seed + index + moodOffset + snapshot.history.length) % activities.length;
        let position = start;
        let id = `demo-lab-${strategy}-${domain}-${position}-${hash(anchor)}`;
        while ((snapshot.shownIds.includes(id) || batchIds.has(id)) && position - start < activities.length) {
          position += 1;
          id = `demo-lab-${strategy}-${domain}-${position % activities.length}-${hash(anchor)}`;
        }
        if (position - start >= activities.length) return null;
        batchIds.add(id);
        const activity = activities[position % activities.length];
        const format = strategy === "people" ? snapshot.settings.occasion
          : strategy === "real" ? `${snapshot.settings.time} plan`
          : { stay: "Close study", thread: "Follow-on exercise", cross: "Domain crossing", wild: "Unusual experiment" }[strategy];
        return {
          id, title: `${activity} · ${format}`, domain, mode: "demo" as const,
          source: "Authored Open Door demo exercise · no Qloo data",
          description: `${snapshot.settings.mood} prompt: use “${anchor}” as a starting point for ${activity.toLowerCase()}.${strategy === "people" ? ` Adapt it for your ${snapshot.settings.occasion.toLowerCase()}${snapshot.settings.groupInterests ? `, incorporating these volunteered interests: ${snapshot.settings.groupInterests}` : ""}.` : ""}`,
          connection: `Authored creative analogy, not a cultural fact: take one detail you notice in “${anchor}” and reinterpret it through ${domain.toLowerCase()}. ${definition.purpose}`,
          originalConnection: `Your original anchors were “${original}”. This prompt descends from ${snapshot.selected ? `your selected discovery “${snapshot.selected.title}”` : "those explicit interests"}; no provider relationship to them has been verified.`,
          evidence: "Demo-only editorial prompt. No cultural affinity, venue listing, social match, availability or graph edge was retrieved.",
          selection: `${definition.name}; ${snapshot.settings.adventure} adventure; ${snapshot.settings.mood.toLowerCase()} mood; ${snapshot.settings.domain === "Any" ? `application-selected ${domain} domain` : `your ${domain} domain filter`}. The shared original demo generator supplies neighboring-domain seeds.`,
          constraints: constraintNotes(snapshot),
          plan: strategy === "real" ? [
            `Prepare: choose a safe, accessible setting in ${snapshot.settings.location || "your chosen area"}; confirm any opening times or permissions yourself.`,
            `Explore: try ${activity.toLowerCase()} at your own pace during your ${snapshot.settings.time.toLowerCase()}.`,
            `Reflect: record a connection to “${anchor}”. Budget input: ${snapshot.settings.budget || "not supplied"}; no prices, bookings or travel times verified.`,
          ] : undefined,
        };
      }).filter(item => item !== null);
      return { mode: "demo", discoveries, notices: discoveries.length ? ["Illustrative demo exercises only. No live Qloo connection."] : ["No unseen exercises remain for these settings. Change domain or mood, or open a discovery as the next anchor."] };
    },
  };
}
