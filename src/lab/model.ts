export const STRATEGIES = [
  { id: "stay", name: "Stay in Your World", purpose: "Study a close connection within your chosen cultural world.", adventure: "familiar" },
  { id: "thread", name: "Follow the Thread", purpose: "Carry a creative practice into a neighboring domain.", adventure: "adjacent" },
  { id: "cross", name: "Cross Into Another World", purpose: "Deliberately change cultural domains, keeping your starting point visible.", adventure: "adjacent" },
  { id: "people", name: "Find Your People", purpose: "Shape a shared or solo experience around your chosen occasion.", adventure: "familiar" },
  { id: "wild", name: "Take the Wild Door", purpose: "Try an unusual, explicitly explained creative prompt.", adventure: "unexpected" },
  { id: "real", name: "Make It Real", purpose: "Build a self-guided plan from your time, location and budget.", adventure: "adjacent" },
] as const;
export type Strategy = typeof STRATEGIES[number]["id"];
export const DOMAINS = ["Music", "Film", "Books", "Food", "Fashion", "Art", "Architecture", "Places"] as const;
export type Domain = typeof DOMAINS[number];
export type Settings = {
  adventure: "familiar" | "adjacent" | "unexpected";
  time: "Quick discovery" | "Afternoon" | "Full day" | "Weekend";
  mood: "Creative" | "Cozy" | "Social" | "Adventurous" | "Unusual";
  domain: Domain | "Any";
  occasion: "Solo outing" | "Date" | "Family activity" | "Social gathering";
  location: string;
  budget: string;
  movement: string;
  conditions: string;
  groupInterests: string;
};
export type Compatibility = { constraint: string; value: string; status: "Planning input" | "Unverified"; detail: string };
export type Discovery = {
  id: string; title: string; domain: string; description: string;
  connection: string; originalConnection: string; evidence: string;
  mode: "demo" | "live"; source: string; selection: string;
  constraints: Compatibility[];
  entityId?: string; entityType?: string;
  plan?: string[];
};
export type Feedback = { action: "keep" | "reject"; reason: string };
export type Step = {
  id: string; strategy: Strategy; anchors: string[]; settings: Settings;
  discoveries: Discovery[]; createdAt: string;
};
export type Snapshot = {
  originalAnchors: string[]; anchors: string[]; categories: Record<string, string>;
  originalContext: Record<string, string>; settings: Settings;
  selected?: Discovery; candidates: Discovery[]; history: Step[];
  shownIds: string[]; feedback: Record<string, Feedback>; mode: "demo" | "live";
};
export type Checkpoint = {
  id: string; name: string; createdAt: string;
  parentCheckpointId?: string; parentBranchId?: string; snapshot: Snapshot;
};
export type Branch = {
  id: string; name: string; strategy: Strategy; checkpointId: string;
  createdAt: string; updatedAt: string; snapshot: Snapshot;
};
export type LabState = {
  version: 1; current: Snapshot | null; checkpoints: Checkpoint[]; branches: Branch[];
  activeBranchId: string | null; activeCheckpointId: string | null;
  favorites: Record<string, string>;
};
export type DiscoveryResult = { mode: "demo" | "live"; discoveries: Discovery[]; notices: string[] };
export type DiscoveryProvider = {
  id: "demo" | "live";
  discover(input: { snapshot: Snapshot; strategy: Strategy; signal?: AbortSignal }): Promise<DiscoveryResult>;
};
export type LabSeed = {
  anchors: string[]; categories: Record<string, string>; location: string;
  context: Record<string, string>; mode: "demo" | "live";
  discoveries: Discovery[]; selected?: Discovery; feedback: Record<string, Feedback>;
};
export const STORAGE_KEY = "opendoor.lab.v1";
