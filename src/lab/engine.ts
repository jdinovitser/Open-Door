import { STRATEGIES, DOMAINS, type Branch, type Discovery, type DiscoveryResult, type LabSeed, type LabState, type Settings, type Snapshot, type Strategy } from "./model.ts";
import { SCENARIOS } from "./scenarios.ts";

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const emptyLab = (): LabState => ({
  version: 1, current: null, checkpoints: [], branches: [],
  activeBranchId: null, activeCheckpointId: null, favorites: {},
});
export function seedLab(state: LabState, seed: LabSeed): LabState {
  if (!seed.anchors.some(anchor => anchor.trim())) throw new Error("Add at least one cultural anchor.");
  const settings: Settings = {
    adventure: "adjacent", time: "Afternoon", mood: "Creative", domain: "Any",
    occasion: "Solo outing", location: seed.location, budget: seed.context.budget || "Flexible",
    movement: seed.context.movement || "", conditions: seed.context.conditions || "", groupInterests: "",
    ...(seed.context.scenario ? { scenario: seed.context.scenario } : {}),
    ...(SCENARIOS.some(item => item.id === seed.context.scenarioCategory)
      ? { scenarioCategory: seed.context.scenarioCategory as Settings["scenarioCategory"] } : {}),
  };
  if (seed.context.depth === "Close to home") settings.adventure = "familiar";
  if (seed.context.depth === "Take me somewhere unexpected" || seed.context.depth === "Surprise me") settings.adventure = "unexpected";
  settings.groupInterests = seed.context.groupInterests || "";
  if (settings.groupInterests) settings.occasion = "Social gathering";
  if (/hour|quick/i.test(seed.context.time || "")) settings.time = "Quick discovery";
  if (/weekend/i.test(seed.context.time || "")) settings.time = "Weekend";
  if (/day/i.test(seed.context.time || "") && !/saturday/i.test(seed.context.time)) settings.time = "Full day";
  return { ...state, activeBranchId: null, activeCheckpointId: null, current: copy({
    originalAnchors: seed.anchors, anchors: seed.selected ? [seed.selected.title] : seed.anchors,
    categories: seed.categories, originalContext: seed.context, settings, selected: seed.selected,
    candidates: seed.discoveries, history: [], shownIds: seed.discoveries.map(item => item.id),
    feedback: seed.feedback, mode: seed.mode,
  }) };
}
// Import existing evidence as two independently resumable paths. This performs
// no provider request and retains all prior checkpoints/branches.
export function preserveComparison(state: LabState, original: LabSeed, alternative: LabSeed, ids: string[], now: string): LabState {
  if (ids.length !== 5 || new Set(ids).size !== 5) throw new Error("Comparison needs five unique identifiers.");
  if (state.branches.length > 98) throw new Error("Remove unused branches or export this Lab before preserving two more paths.");
  let next = seedLab(state, original);
  next = saveCheckpoint(next, "Before reconsidering · original discovery", ids[0], now);
  for (const [index, seed] of [original, alternative].entries()) {
    next = createBranch(next, ids[0], "thread", ids[index + 1], now);
    const imported = seedLab(emptyLab(), seed).current!;
    next = replaceCurrent(next, { ...imported, candidates: [], history: [], shownIds: [] }, now);
    next = recordResults(next, { mode: seed.mode, discoveries: seed.discoveries, notices: [] }, ids[index + 3], now);
    next = renameItem(next, "branch", ids[index + 1], index === 0 ? "Original · preserved" : "Alternative · reconsidered");
  }
  return next;
}
export function replaceCurrent(state: LabState, snapshot: Snapshot, now = new Date().toISOString()): LabState {
  const current = copy(snapshot);
  return {
    ...state, current,
    branches: state.branches.map(branch => branch.id === state.activeBranchId ? { ...branch, snapshot: copy(current), updatedAt: now } : branch),
  };
}
export function saveCheckpoint(state: LabState, name: string, id: string, now: string): LabState {
  if (!state.current) throw new Error("Start an exploration before saving a checkpoint.");
  if (state.checkpoints.length >= 100) throw new Error("This browser has 100 checkpoints. Reuse a saved checkpoint, or export and clear the Lab before adding more.");
  const checkpoint = {
    id, name: name.trim().slice(0, 100) || `Checkpoint ${state.checkpoints.length + 1}`,
    createdAt: now, ...(state.activeCheckpointId ? { parentCheckpointId: state.activeCheckpointId } : {}),
    ...(state.activeBranchId ? { parentBranchId: state.activeBranchId } : {}), snapshot: copy(state.current),
  };
  return { ...state, checkpoints: [...state.checkpoints, checkpoint], activeCheckpointId: id };
}
export function restoreCheckpoint(state: LabState, id: string): LabState {
  const checkpoint = state.checkpoints.find(item => item.id === id);
  if (!checkpoint) throw new Error("That checkpoint no longer exists.");
  return { ...state, current: copy(checkpoint.snapshot), activeCheckpointId: id, activeBranchId: null };
}
export function createBranch(state: LabState, checkpointId: string, strategy: Strategy, id: string, now: string): LabState {
  const checkpoint = state.checkpoints.find(item => item.id === checkpointId);
  const definition = STRATEGIES.find(item => item.id === strategy);
  if (!checkpoint || !definition) throw new Error("Choose a saved checkpoint and a discovery direction.");
  if (state.branches.length >= 100) throw new Error("This browser has 100 branches. Remove an unused branch first.");
  const snapshot = copy(checkpoint.snapshot);
  snapshot.settings.adventure = definition.adventure;
  // Inherited results belong to the shared checkpoint, not this unexplored path.
  snapshot.candidates = [];
  const branch: Branch = {
    id, checkpointId, strategy, name: definition.name, createdAt: now, updatedAt: now, snapshot,
  };
  return { ...state, branches: [...state.branches, branch], current: copy(snapshot), activeBranchId: id, activeCheckpointId: checkpointId };
}
export function resumeBranch(state: LabState, id: string): LabState {
  const branch = state.branches.find(item => item.id === id);
  if (!branch) throw new Error("That branch no longer exists.");
  return { ...state, current: copy(branch.snapshot), activeBranchId: id, activeCheckpointId: branch.checkpointId };
}
export function recordResults(state: LabState, result: DiscoveryResult, id: string, now: string): LabState {
  const branch = state.branches.find(item => item.id === state.activeBranchId);
  if (!state.current || !branch) throw new Error("Choose a branch before exploring.");
  if (state.current.history.length >= 80) throw new Error("This branch has 80 steps. Fork a new branch to keep exploring.");
  if (result.mode !== state.current.mode || result.discoveries.some(item => item.mode !== result.mode)) throw new Error("Provider provenance did not match this branch. Nothing was saved.");
  const snapshot = state.current;
  return replaceCurrent(state, {
    ...snapshot, candidates: copy(result.discoveries),
    shownIds: [...new Set([...snapshot.shownIds, ...result.discoveries.map(item => item.id)])],
    history: [...snapshot.history, { id, strategy: branch.strategy, anchors: copy(snapshot.anchors), settings: copy(snapshot.settings), discoveries: copy(result.discoveries), createdAt: now }],
  }, now);
}
export function anchorDiscovery(state: LabState, discovery: Discovery): LabState {
  if (!state.current) throw new Error("Start an exploration first.");
  if (discovery.mode !== state.current.mode) throw new Error("Demo and Live discoveries cannot be mixed.");
  return replaceCurrent(state, { ...state.current, anchors: [discovery.title], selected: copy(discovery), categories: { ...state.current.categories, [discovery.title]: discovery.domain }, candidates: [] });
}
export function forkDiscovery(state: LabState, discovery: Discovery, id: string, now: string): LabState {
  if (!state.current) throw new Error("Start a journey first.");
  if (discovery.mode !== state.current.mode) throw new Error("Demo and Live sources cannot be mixed.");
  const prepared = saveCheckpoint({
    ...state, current: {
      ...state.current, selected: copy(discovery), anchors: [discovery.title],
      categories: { ...state.current.categories, [discovery.title]: discovery.domain }, candidates: [],
    },
  }, `From ${discovery.title}`, id, now);
  return restoreCheckpoint(prepared, id);
}
export function renameItem(state: LabState, kind: "branch" | "checkpoint", id: string, name: string): LabState {
  const clean = name.trim().slice(0, 100);
  if (!clean) throw new Error("Please enter a name.");
  return kind === "branch"
    ? { ...state, branches: state.branches.map(item => item.id === id ? { ...item, name: clean } : item) }
    : { ...state, checkpoints: state.checkpoints.map(item => item.id === id ? { ...item, name: clean } : item) };
}
export function deleteBranch(state: LabState, id: string): LabState {
  const favorites = Object.fromEntries(Object.entries(state.favorites).filter(([, favorite]) => favorite !== id));
  const next = { ...state, branches: state.branches.filter(item => item.id !== id), favorites };
  return state.activeBranchId === id ? { ...next, current: null, activeBranchId: null } : next;
}
export function compareBranches(state: LabState, checkpointId: string, ids: string[]): Branch[] {
  return state.branches.filter(item => item.checkpointId === checkpointId && ids.includes(item.id));
}
export function freshLab(state: LabState): LabState {
  return { ...state, current: null, activeBranchId: null, activeCheckpointId: null };
}
export function allDiscoveries(branch: Branch, checkpoint?: LabState["checkpoints"][number]): Discovery[] {
  const steps = checkpoint ? branch.snapshot.history.slice(checkpoint.snapshot.history.length) : branch.snapshot.history;
  const candidates = !checkpoint || steps.length ? branch.snapshot.candidates : [];
  return [...new Map([...steps.flatMap(step => step.discoveries), ...candidates].map(item => [
    item.entityId || `${item.domain}:${item.title.trim().toLocaleLowerCase()}`, item,
  ])).values()];
}
// Reject malformed local data rather than trusting a parsed JSON cast.
export function parseLab(raw: string | null): LabState {
  if (!raw) return emptyLab();
  if (raw.length > 5_000_000) throw new Error("The saved Lab is too large to load safely. Export or clear its browser-local data.");
  const value = JSON.parse(raw);
  const strings = (input: unknown): input is string[] => Array.isArray(input) && input.every(item => typeof item === "string");
  const record = (input: unknown) => input !== null && typeof input === "object" && !Array.isArray(input);
  const stringRecord = (input: unknown) => record(input) && Object.values(input as Record<string, unknown>).every(item => typeof item === "string");
  const discovery = (item: Discovery) => record(item) && ["id", "title", "domain", "description", "connection", "originalConnection", "evidence", "source", "selection"].every(key => typeof item[key as keyof Discovery] === "string")
    && ["demo", "live"].includes(item.mode) && Array.isArray(item.constraints) && item.constraints.every(row => record(row) && typeof row.constraint === "string" && typeof row.value === "string" && typeof row.detail === "string" && ["Planning input", "Unverified"].includes(row.status))
    && (item.plan === undefined || strings(item.plan));
  const settings = (s: Settings) => record(s) && ["familiar", "adjacent", "unexpected"].includes(s.adventure)
    && ["Quick discovery", "Afternoon", "Full day", "Weekend"].includes(s.time)
    && ["Creative", "Cozy", "Social", "Adventurous", "Unusual"].includes(s.mood)
    && ["Any", ...DOMAINS].includes(s.domain) && ["Solo outing", "Date", "Family activity", "Social gathering"].includes(s.occasion)
    && ["location", "budget", "movement", "conditions", "groupInterests"].every(key => typeof s[key as keyof Settings] === "string")
    && (s.scenario === undefined || typeof s.scenario === "string" && s.scenario.length <= 1000)
    && (s.scenarioCategory === undefined || SCENARIOS.some(item => item.id === s.scenarioCategory));
  const snapshot = (s: Snapshot) => record(s) && strings(s.originalAnchors) && strings(s.anchors) && strings(s.shownIds) && stringRecord(s.categories) && stringRecord(s.originalContext)
    && settings(s.settings) && ["demo", "live"].includes(s.mode) && (s.selected === undefined || discovery(s.selected))
    && Array.isArray(s.candidates) && s.candidates.every(discovery) && record(s.feedback) && Object.values(s.feedback).every(f => record(f) && ["keep", "reject"].includes(f.action) && typeof f.reason === "string")
    && Array.isArray(s.history) && s.history.every(step => record(step) && typeof step.id === "string" && typeof step.createdAt === "string" && strings(step.anchors) && settings(step.settings) && STRATEGIES.some(item => item.id === step.strategy) && Array.isArray(step.discoveries) && step.discoveries.every(discovery));
  if (!record(value) || value.version !== 1 || !Array.isArray(value.checkpoints) || !Array.isArray(value.branches)
    || value.checkpoints.length > 100 || value.branches.length > 100 || !(value.current === null || snapshot(value.current))
    || !value.checkpoints.every((item: LabState["checkpoints"][number]) => record(item) && typeof item.id === "string" && typeof item.name === "string" && typeof item.createdAt === "string" && snapshot(item.snapshot))
    || !value.branches.every((item: Branch) => record(item) && typeof item.id === "string" && typeof item.name === "string" && typeof item.createdAt === "string" && typeof item.updatedAt === "string" && typeof item.checkpointId === "string" && STRATEGIES.some(strategy => strategy.id === item.strategy) && snapshot(item.snapshot))
    || !stringRecord(value.favorites) || !(value.activeBranchId === null || typeof value.activeBranchId === "string") || !(value.activeCheckpointId === null || typeof value.activeCheckpointId === "string")) throw new Error("Saved Discovery Lab data is invalid. It has not been overwritten. Export it before clearing or starting again.");
  if (new Set(value.checkpoints.map((item: { id: string }) => item.id)).size !== value.checkpoints.length || new Set(value.branches.map((item: Branch) => item.id)).size !== value.branches.length
    || value.branches.some((branch: Branch) => !value.checkpoints.some((checkpoint: { id: string }) => checkpoint.id === branch.checkpointId))
    || (value.activeBranchId && !value.branches.some((branch: Branch) => branch.id === value.activeBranchId))
    || (value.activeCheckpointId && !value.checkpoints.some((checkpoint: { id: string }) => checkpoint.id === value.activeCheckpointId))) throw new Error("Saved Lab relationships are incomplete. Existing data has not been overwritten.");
  return copy(value as LabState);
}
