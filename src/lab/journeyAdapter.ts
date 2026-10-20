import { constraintNotes } from "./demoProvider.ts";
import { emptyLab, seedLab } from "./engine.ts";
import type { Discovery, LabSeed } from "./model.ts";

type SourceDoor = {
  id: string; title: string; category: string; kind: string; why: string; evidence: string; thread: string; source: string; tier: string;
  whyYou?: string; entityId?: string; entityType?: string;
};
type SourceJourney = {
  anchors: string[]; categories: Record<string, string>; city: string; context: Record<string, string>;
  intent: string; depth: string; occasion: string; mode?: "demo" | "live"; doors: SourceDoor[];
};
export function journeyToLab(journey: SourceJourney, selectedId?: string, feedback: Record<string, string> = {}, groupInterests = ""): LabSeed {
  const mode = journey.mode || "demo";
  const discoveries: Discovery[] = journey.doors.map(door => ({
    id: door.id, title: door.title, domain: door.category, description: door.kind,
    connection: door.why, originalConnection: door.whyYou || `Original user anchors: ${journey.anchors.join(", ")}.`,
    evidence: door.evidence, mode,
    source: mode === "live" ? `Qloo-returned entity · ${door.source}` : "Authored Open Door sample · no Qloo data",
    selection: `Open Door ${door.tier.toLowerCase()} route · ${door.thread}`,
    entityId: mode === "live" ? door.entityId : undefined, entityType: mode === "live" ? door.entityType : undefined,
    constraints: [],
  }));
  const seed: LabSeed = {
    anchors: [...journey.anchors], categories: { ...journey.categories }, location: journey.city,
    context: { ...journey.context, intent: journey.intent, depth: journey.depth, time: journey.occasion, groupInterests },
    mode, discoveries, selected: discoveries.find(door => door.id === selectedId),
    feedback: Object.fromEntries(Object.entries(feedback).filter(([, value]) => value && value !== "choose").map(([key, value]) => [key, { action: value === "keep" ? "keep" as const : "reject" as const, reason: value }])),
  };
  const notes = constraintNotes(seedLab(emptyLab(), seed).current!);
  seed.discoveries = discoveries.map(door => ({ ...door, constraints: notes }));
  seed.selected = seed.discoveries.find(door => door.id === selectedId);
  return seed;
}
