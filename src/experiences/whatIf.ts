import type { DiscoveryRequest, LiveJourney } from "../agentApi";

export const WHAT_IF_INTENTS = ["Find my people", "Go deeper", "Try something new"] as const;
export const WHAT_IF_DEPTHS = ["Close to home", "A little further", "Surprise me", "Take me somewhere unexpected"] as const;
export type WhatIfControls = { location: string; intent: string; depth: string; budget: string; time: string; movement: string };
export type WhatIfReference = { id: string; title: string; category: string; tier?: string; entityId?: string; entityType?: string };
export type WhatIfStart = {
  id: string; origin: "journey" | "result" | "saved" | "new"; label: string;
  mode: "live" | "demo" | "new"; request: DiscoveryRequest; doors: WhatIfReference[];
  restore?: () => void;
};
export type WhatIfMapping = { field: keyof WhatIfControls; value: string; statement: string; scope: "routing" | "local" };
export type WhatIfInterpretation = { mappings: WhatIfMapping[]; localNotes: string[]; unrecognized: string[] };
export const cloneRequest = (request: DiscoveryRequest): DiscoveryRequest => JSON.parse(JSON.stringify(request)) as DiscoveryRequest;
export function snapshotStart(start: WhatIfStart): WhatIfStart {
  return { ...start, request: cloneRequest(start.request), doors: start.doors.map(door => ({ ...door })) };
}
export function controlsFor(request: DiscoveryRequest): WhatIfControls {
  return {
    location: request.location, intent: request.intent, depth: request.depth,
    budget: request.context.budget || "Flexible", time: request.context.time || request.occasion,
    movement: request.context.movement || "Open to anything",
  };
}

// Whole-statement rules only. No inference from keywords, negations, or unrecognized prose.
export function interpretWhatIf(text: string): WhatIfInterpretation {
  const result: WhatIfInterpretation = { mappings: [], localNotes: [], unrecognized: [] };
  for (const raw of text.split(/[.!?;\n]+/).map(value => value.trim()).filter(Boolean)) {
    const statement = raw.replace(/^what if\s+/i, "").trim();
    let mapping: Omit<WhatIfMapping, "statement"> | undefined;
    const hours = statement.match(/^(?:i\s+)?(?:only\s+)?have\s+(one|two|three|four|[1-9]|1[0-2])\s+hours?$/i);
    const city = statement.match(/^(?:i am|i'm)\s+(?:exploring|traveling)\s+(?:in|to)\s+([^,;!?]{1,120})$/i);
    if (hours) {
      const number = ({ one: "1", two: "2", three: "3", four: "4" } as Record<string, string>)[hours[1].toLowerCase()] || hours[1];
      mapping = { field: "time", value: `${number} ${number === "1" ? "hour" : "hours"}`, scope: "local" };
    } else if (/^(?:i\s+)?(?:have|want)\s+(?:a\s+)?(?:smaller|lower)\s+budget$/i.test(statement)) {
      mapping = { field: "budget", value: "Lower cost", scope: "local" };
    } else if (/^(?:i\s+)?want\s+(?:a\s+)?(?:more\s+)?relaxed\s+experience$/i.test(statement)) {
      mapping = { field: "movement", value: "Mostly seated", scope: "local" };
    } else if (/^(?:i\s+)?want\s+something\s+completely\s+different(?:\s+from\s+my\s+usual\s+preferences)?$/i.test(statement)) {
      mapping = { field: "depth", value: "Take me somewhere unexpected", scope: "routing" };
    } else if (/^(?:i\s+)?want\s+to\s+go\s+deeper$/i.test(statement)) {
      mapping = { field: "intent", value: "Go deeper", scope: "routing" };
    } else if (city && !/\b(?:not|don't|but|and|with|without|if|or)\b/i.test(city[1])) {
      mapping = { field: "location", value: city[1].trim(), scope: "routing" };
    } else if (/^(?:i am|i'm)\s+traveling\s+with\s+(?:children|kids)$/i.test(statement)) {
      result.localNotes.push("Check age suitability, supervision, facilities, and booking rules yourself. Child suitability is not verified by this discovery.");
    } else if (/^(?:i\s+)?want\s+something\s+less\s+touristy$/i.test(statement)) {
      result.localNotes.push("Compare local sources and recent visitor information. These results do not establish whether a place is less touristy.");
    } else {
      result.unrecognized.push(raw);
    }
    if (mapping) result.mappings.push({ ...mapping, statement: raw });
  }
  return result;
}

export function applyWhatIfMappings(controls: WhatIfControls, mappings: WhatIfMapping[]): WhatIfControls {
  return mappings.reduce((next, mapping) => ({ ...next, [mapping.field]: mapping.value }), { ...controls });
}

export function validateWhatIf(start: WhatIfStart, controls: WhatIfControls, maxAnchors: number): string[] {
  const errors: string[] = [];
  if (!start.request.anchors.length || start.request.anchors.some(anchor => !anchor.label.trim())) errors.push("Add at least one named interest and fill or remove empty rows.");
  if (start.request.anchors.length > maxAnchors) errors.push(`This connection allows at most ${maxAnchors} interests. Remove extras; none will be silently dropped.`);
  if (start.request.anchors.some(anchor => anchor.label.length > 120)) errors.push("Each interest must be at most 120 characters.");
  const labels = start.request.anchors.map(anchor => anchor.label.trim().toLowerCase().replace(/\s+/g, " "));
  if (new Set(labels).size !== labels.length) errors.push("Use each named interest once; remove duplicate interest rows.");
  if (!WHAT_IF_INTENTS.includes(controls.intent as typeof WHAT_IF_INTENTS[number])) errors.push("Choose a supported intent.");
  if (!WHAT_IF_DEPTHS.includes(controls.depth as typeof WHAT_IF_DEPTHS[number])) errors.push("Choose a supported depth.");
  if (controls.location.length > 120 || [controls.budget, controls.time, controls.movement].some(value => value.length > 100)) errors.push("Shorten location to 120 characters and planning fields to 100.");
  return errors;
}

export function createWhatIfRequest(start: WhatIfStart, controls: WhatIfControls, maxAnchors: number, iteration: number): DiscoveryRequest {
  const errors = validateWhatIf(start, controls, maxAnchors);
  if (errors.length) throw new Error(errors.join(" "));
  const original = cloneRequest(start.request);
  const context: DiscoveryRequest["context"] = { ...original.context, time: controls.time.trim(), budget: controls.budget.trim(), movement: controls.movement.trim() };
  if (controls.time.trim() !== controlsFor(original).time.trim()) {
    // A new time brief must not inherit a contradictory original time window.
    delete context.startTime;
    delete context.endTime;
  }
  return {
    ...original, location: controls.location.trim(), intent: controls.intent, depth: controls.depth,
    occasion: controls.time.trim(), iteration,
    context,
    anchors: original.anchors.map(anchor => ({ ...anchor, label: anchor.label.trim().replace(/\s+/g, " ") })),
  };
}

export function whatIfChanges(original: DiscoveryRequest, next: DiscoveryRequest) {
  const before = controlsFor(original);
  const after = controlsFor(next);
  return (Object.keys(before) as (keyof WhatIfControls)[]).flatMap(field =>
    before[field] === after[field] ? [] : [{
      field, before: before[field] || "Not set", after: after[field] || "Not set",
      scope: ["location", "intent", "depth"].includes(field) ? "routing" as const : "local" as const,
    }]);
}

export function compareWhatIfResults(start: WhatIfStart, journey: LiveJourney) {
  if (start.mode !== "live") return { comparable: false, retained: 0, added: journey.doors.length, missing: 0 };
  const originals = new Set(start.doors.flatMap(door => door.entityId ? [door.entityId] : []));
  const alternatives = new Set(journey.doors.map(door => door.entityId));
  return {
    comparable: originals.size > 0,
    retained: [...alternatives].filter(id => originals.has(id)).length,
    added: [...alternatives].filter(id => !originals.has(id)).length,
    missing: [...originals].filter(id => !alternatives.has(id)).length,
  };
}

export function practicalWhatIfNotes(controls: WhatIfControls): string[] {
  return [
    ...(controls.time ? [`For “${controls.time}”, check travel, waiting, and activity duration before committing. No duration has been verified.`] : []),
    ...(controls.budget ? [`For “${controls.budget}”, verify current prices and booking fees. These results are not price-filtered.`] : []),
    ...(controls.movement ? [`For “${controls.movement}”, confirm seating, access, and distances with the venue. Mobility suitability is not verified.`] : []),
  ];
}
