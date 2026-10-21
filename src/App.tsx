import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { useClerk, useUser } from "@clerk/react";
import { requestAccountDeletion } from "./accountDeletion";
import {
  ArrowDownRight, ArrowRight, Bookmark, BookOpen, Check, ChevronDown, Compass,
  HeartCrack, Info, MapPin, Plus, RotateCcw, Share2, Trash2, Volume2, VolumeX, X,
} from "lucide-react";
import { getAgentStatus, runAgentDiscovery, type AgentEvent, type AgentStatus, type DiscoveryRequest, type LiveDoor, type LiveJourney, type ProgressSummary } from "./agentApi";
import { DevSecurityTestView, TrustView } from "./TrustView";
import { MascotArt } from "./MascotArt";
import DiscoveryLab from "./lab/DiscoveryLab";
import { createDemoProvider } from "./lab/demoProvider";
import { createLiveProvider } from "./lab/liveProvider";
import { journeyToLab } from "./lab/journeyAdapter";
import { useDiscoveryLab } from "./lab/useDiscoveryLab";
import { useSoundEffects, type SoundEffect } from "./useSoundEffects";
import JudgesGuide from "./JudgesGuide";
import ProgressView from "./ProgressView";
import { combinePendingSavedDoorChanges, diffAccountSavedDoors, isPendingDoorChanges, mergeAccountSavedDoors, type PendingSavedDoorChanges } from "./accountSavedDoors";
import { ScenarioFields } from "./lab/ScenarioFields";
import { scenarioGuidance, type ScenarioCategory } from "./lab/scenarios";
import { demoIdeas, type DemoOptions } from "./demoIdeas";
import { DayPlanner, mapsSearch, RecommendationTools } from "./RecommendationTools";
import PreferencesMemory, { type PreferenceValues } from "./PreferencesMemory";
import HiddenGem from "./HiddenGem";

type View = "discover" | "saved" | "how" | "trust" | "lab" | "judges" | "progress";
type Intent = "Find my people" | "Go deeper" | "Try something new";
type Depth = "Close to home" | "A little further" | "Surprise me" | "Take me somewhere unexpected";
type Category = "Film" | "Music" | "Food" | "Art" | "Books" | "Design" | "Outdoors" | "Experiences" | "Other";
type Context = { time: string; budget: string; movement: string; conditions: string; startTime?: string; endTime?: string; scenarioCategory?: ScenarioCategory; scenario?: string };
type Door = {
  id: string; tier: "Familiar" | "Adjacent" | "Unexpected"; title: string; kind: string;
  category: Category; source: string; why: string; now: string; evidence: string; thread: string;
  whyYou?: string; entityId?: string; entityType?: string; sourceEntityIds?: string[];
  coordinates?: { latitude: number; longitude: number } | null; popularity?: number | null;
  discoveryDistance?: LiveDoor["discoveryDistance"]; explainability?: unknown; imageUrl?: string;
};
type Journey = {
  city: string; occasion: string; intent: Intent; anchors: string[]; categories: Record<string, Category>;
  context: Context; depth: Depth; doors: Door[]; iteration: number;
  mode?: "demo" | "live"; graph?: LiveJourney["graph"]; resolvedAnchors?: LiveJourney["resolvedAnchors"];
  tools?: LiveJourney["tools"]; notices?: string[]; methodology?: LiveJourney["methodology"];
  feedbackApplied?: string[]; generatedAt?: string;
  demoSeenTitles?: string[];
};
type SavedDoor = Door & { city: string; savedAt: string; anchors: string[]; mode?: "demo" | "live" };
type ThreadExploration = {
  from: string; previous: Journey; status: "loading" | "ready" | "error";
  targetIds: string[]; error?: string; selected: Door;
};
type Participant = { name: string; anchors: string };
type DayPlanInput = { startTime: string; endTime: string; location: string; budget: string; novelty: string };
type StoredDoor = Partial<SavedDoor> & { id: string; title: string; tier: Door["tier"] };
type StoredJourney = Partial<Journey> & { anchors?: string[]; doors?: StoredDoor[] };
type AccountSaveSyncStatus = "loading" | "guest" | "ready" | "saving" | "error";
type AccountProgressStatus = "loading" | "ready" | "error";
const SAVED_OWNER_KEY = "opendoor.saved.owner.v1";
const GUEST_SAVED_KEY = "opendoor.saved.guest.v1";
const MAX_ACCOUNT_SAVED_DOORS = 100;
const EXAMPLES = ["independent cinema", "Japanese breakfast", "live jazz"];
const CATEGORIES: Category[] = ["Film", "Music", "Food", "Art", "Books", "Design", "Outdoors", "Experiences", "Other"];
const DEPTHS: { value: Depth; note: string }[] = [
  { value: "Close to home", note: "More of what you already enjoy." },
  { value: "A little further", note: "Try something related." },
  { value: "Surprise me", note: "Try a different kind of activity." },
  { value: "Take me somewhere unexpected", note: "Start with something outside your usual interests." },
];
const REASONS = ["Too familiar", "Too far", "Too expensive", "Not my scene", "Wrong time", "Just not interested"];
const INTENTS: Intent[] = ["Find my people", "Go deeper", "Try something new"];
const EMPTY_CONTEXT: Context = { time: "A free Saturday", budget: "Flexible", movement: "Mostly seated", conditions: "Open to anything" };

function publicContext(context: Context): DiscoveryRequest["context"] {
  return {
    time: context.time,
    budget: context.budget,
    movement: context.movement,
    conditions: context.conditions,
    ...(context.startTime ? { startTime: context.startTime } : {}),
    ...(context.endTime ? { endTime: context.endTime } : {}),
  };
}

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(value)) return fallback;
    if (typeof fallback === "boolean" && typeof value !== "boolean") return fallback;
    if (fallback && typeof fallback === "object" && !Array.isArray(fallback)
      && (!value || typeof value !== "object" || Array.isArray(value))) return fallback;
    return value as T;
  }
  catch { return fallback; }
}
function restoreFeedback(): Record<string, string> {
  const stored = readStore<Record<string, unknown>>("opendoor.feedback", {});
  return Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}
function safeSetStore(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be disabled or full. */ }
}
function safeRemoveStore(key: string): void {
  try { localStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
}
function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character] || character);
}
function publicTrace(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicTrace);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/(credential|secret|api.?key|(^|[_-])key($|[_-])|password|bearer|token|authorization|prompt|reasoning|thought)/i.test(key))
      .map(([key, item]) => [key, publicTrace(item)]));
  }
  return value;
}
function inferredCategory(anchor: string): Category {
  const value = anchor.toLowerCase();
  if (/film|cinema|movie|screen/.test(value)) return "Film";
  if (/music|jazz|song|sound|record|concert/.test(value)) return "Music";
  if (/food|breakfast|cuisine|cook|meal|market|tea/.test(value)) return "Food";
  if (/book|poetry|novel|reading|literature/.test(value)) return "Books";
  if (/art|gallery|painting|museum|craft/.test(value)) return "Art";
  if (/design|architecture|fashion/.test(value)) return "Design";
  if (/walk|garden|outdoor|nature/.test(value)) return "Outdoors";
  return "Experiences";
}
function makeDoors(_city: string, anchors: string[], categories: Record<string, Category>, intent: Intent, depth: Depth, context: Context, feedback: string[], iteration: number, options?: DemoOptions): Door[] {
  return demoIdeas(anchors.map(label => ({ label, category: categories[label] || inferredCategory(label) })),
    context.scenario || "", depth, feedback, iteration, { ...options, intent })
    .map(idea => ({ ...idea, id: `demo-${crypto.randomUUID()}` }));
}

function restoreJourney(): Journey | null {
  if (!readStore<boolean>("opendoor.privacy.personalization", true)) return null;
  const stored = readStore<StoredJourney | null>("opendoor.journey", null);
  if (!stored || !Array.isArray(stored.anchors) || !Array.isArray(stored.doors)) return null;
  const anchors = stored.anchors.filter((anchor): anchor is string => typeof anchor === "string" && !/· step \d+/.test(anchor));
  const categories = { ...(stored.categories || {}) };
  for (const anchor of anchors) categories[anchor] ||= inferredCategory(anchor);
  const doors = stored.doors.flatMap((door): Door[] => {
    if (!door || typeof door.id !== "string" || typeof door.title !== "string") return [];
    const tier = door.tier === "Adjacent" || door.tier === "Unexpected" ? door.tier : "Familiar";
    const kind = typeof door.kind === "string" ? door.kind : "Cultural experience";
    return [{
      id: door.id, title: door.title, tier, kind,
      category: door.category || inferredCategory(`${kind} ${door.title}`),
      source: door.source || anchors[0] || "your chosen interest",
      why: door.why || "A previously saved sample explanation.",
      now: door.now || "This is a restored demo idea, not a live recommendation.",
      evidence: door.evidence || "Restored from an earlier deterministic demo journey; not Qloo output.",
      thread: door.thread || "Continue from this cultural thread",
      whyYou: door.whyYou, entityId: door.entityId, entityType: door.entityType, sourceEntityIds: door.sourceEntityIds,
      coordinates: door.coordinates, popularity: door.popularity, discoveryDistance: door.discoveryDistance,
      explainability: door.explainability, imageUrl: door.imageUrl,
    }];
  });
  if (!doors.length) return null;
  const occasion = stored.occasion || EMPTY_CONTEXT.time;
  return {
    city: stored.city || "Your chosen place",
    occasion,
    intent: stored.intent || "Try something new",
    anchors,
    categories,
    context: { ...EMPTY_CONTEXT, ...(stored.context || {}), time: occasion },
    depth: stored.depth || "A little further",
    doors: stored.mode !== "live" && doors.some(door => /authored continuation|editorial analogy|modest step|· step \d+|deterministic demo/.test(`${door.why} ${door.title}`))
      ? makeDoors(stored.city || "", anchors, categories, stored.intent || "Try something new", stored.depth || "A little further", { ...EMPTY_CONTEXT, ...stored.context }, [], 0)
      : doors,
    iteration: stored.iteration || 0, mode: stored.mode || "demo", graph: stored.graph,
    resolvedAnchors: stored.resolvedAnchors, tools: stored.tools, notices: stored.notices,
    methodology: stored.methodology,
    feedbackApplied: Array.isArray(stored.feedbackApplied) ? stored.feedbackApplied.filter(value => typeof value === "string") : [],
    generatedAt: stored.generatedAt,
    demoSeenTitles: Array.isArray(stored.demoSeenTitles) ? stored.demoSeenTitles.filter((title): title is string => typeof title === "string") : [],
  };
}

function restoreSavedDoors(): SavedDoor[] {
  const owner = readStore<string | null>(SAVED_OWNER_KEY, null);
  const entries = owner
    ? readStore<StoredDoor[]>(GUEST_SAVED_KEY, [])
    : readStore<StoredDoor[]>("opendoor.saved", []);
  return restoreSavedDoorEntries(entries);
}

function restoreSavedDoorEntries(entries: unknown): SavedDoor[] {
  if (!Array.isArray(entries)) return [];
  return (entries as StoredDoor[]).flatMap((item): SavedDoor[] => {
    if (!item || typeof item.id !== "string" || typeof item.title !== "string") return [];
    const kind = typeof item.kind === "string" ? item.kind : "Cultural experience";
    return [{
      id: item.id,
      title: item.title,
      tier: item.tier === "Adjacent" || item.tier === "Unexpected" ? item.tier : "Familiar",
      kind,
      category: item.category || inferredCategory(`${kind} ${item.title}`),
      source: item.source || item.anchors?.[0] || "your chosen interest",
      why: item.why || "A previously saved demo idea.",
      now: item.now || "This is not a live recommendation.",
      evidence: item.evidence || "Restored from an earlier deterministic demo journey; not Qloo output.",
      thread: item.thread || "Continue from this cultural thread",
      city: item.city || "Saved journey",
      savedAt: item.savedAt || "Saved earlier",
      whyYou: item.whyYou, entityId: item.entityId, entityType: item.entityType, sourceEntityIds: item.sourceEntityIds,
      coordinates: item.coordinates, popularity: item.popularity, discoveryDistance: item.discoveryDistance,
      explainability: item.explainability, imageUrl: item.imageUrl, mode: item.mode || "demo",
      anchors: Array.isArray(item.anchors) ? item.anchors.filter((anchor): anchor is string => typeof anchor === "string") : [],
    }];
  });
}

function isAccountSavedDoor(value: unknown): value is SavedDoor {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const door = value as Partial<SavedDoor>;
  return typeof door.id === "string" && door.id.length > 0 && door.id.length <= 256
    && typeof door.title === "string"
    && (door.tier === "Familiar" || door.tier === "Adjacent" || door.tier === "Unexpected");
}

function pendingSavedDoorsFor(userId: string): PendingSavedDoorChanges<SavedDoor> {
  const saved = readStore<unknown>(`opendoor.saved.pending.${userId}`, null);
  return isPendingDoorChanges(saved, isAccountSavedDoor) ? saved : { upserts: [], removals: [] };
}

async function readAccountApiError(response: Response, fallback: string): Promise<Error> {
  const result = await response.json().catch(() => null);
  return new Error(typeof result?.message === "string" ? result.message : fallback);
}

const labDemoProvider = createDemoProvider(snapshot => {
  const categories = Object.fromEntries(Object.entries(snapshot.categories).map(([anchor, category]) => [
    anchor, CATEGORIES.includes(category as Category) ? category as Category : /architecture|fashion/i.test(category) ? "Design" as Category : category === "Places" ? "Outdoors" as Category : inferredCategory(anchor),
  ]));
  const depth: Depth = { familiar: "Close to home" as const, adjacent: "A little further" as const, unexpected: "Take me somewhere unexpected" as const }[snapshot.settings.adventure];
  return makeDoors(snapshot.settings.location, snapshot.anchors, categories, "Try something new", depth, {
    time: snapshot.settings.time, budget: snapshot.settings.budget, movement: snapshot.settings.movement, conditions: snapshot.settings.conditions,
  }, Object.values(snapshot.feedback).filter(item => item.action === "reject").map(item => item.reason), snapshot.history.length);
});
const labLiveProvider = createLiveProvider();

export default function App() {
  const sound = useSoundEffects();
  const { signOut } = useClerk();
  const { isLoaded: authLoaded, isSignedIn, user } = useUser();
  const accountUserId = authLoaded && isSignedIn ? user?.id ?? null : null;
  const currentAccountRef = useRef(accountUserId);
  currentAccountRef.current = accountUserId;
  const [view, setView] = useState<View>(() =>
    /^\/judges\/?$/.test(window.location.pathname) ? "judges"
      : /^\/progress\/?$/.test(window.location.pathname) ? "progress"
      : window.location.pathname === "/trust" ? "trust" : window.location.pathname === "/lab" ? "lab" : "discover",
  );
  useEffect(() => {
    // Keep directly shareable screens correct when entered through an in-app tab.
    const route = view === "judges" ? "/judges" : view === "progress" ? "/progress" : view === "lab" ? "/lab" : view === "trust" ? "/trust" : null;
    if (route && window.location.pathname !== route) window.history.replaceState(null, "", route);
    else if (!route && ["/judges", "/progress", "/lab", "/trust"].includes(window.location.pathname)) window.history.replaceState(null, "", "/");
  }, [view]);
  const [personalizationEnabled, setPersonalizationEnabled] = useState(() =>
    readStore<boolean>("opendoor.privacy.personalization", true),
  );
  const [journeyMode, setJourneyMode] = useState<"demo" | "live">("demo");
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const lab = useDiscoveryLab(labDemoProvider, labLiveProvider, !!agentStatus?.qlooConfigured);
  const [statusError, setStatusError] = useState("");
  const [liveStages, setLiveStages] = useState<Extract<AgentEvent, { type: "stage" }>[]>([]);
  const [liveError, setLiveError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const demoRouteTried = useRef(false);
  const pendingDemoScroll = useRef<ScrollBehavior | null>(null);
  const [city, setCity] = useState("Brooklyn, New York");
  const [occasion, setOccasion] = useState(EMPTY_CONTEXT.time);
  const [intent, setIntent] = useState<Intent>("Try something new");
  const [depth, setDepth] = useState<Depth>("A little further");
  const [context, setContext] = useState<Context>(EMPTY_CONTEXT);
  const [anchors, setAnchors] = useState<string[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [categoryDraft, setCategoryDraft] = useState<Category>("Experiences");
  const [anchorDraft, setAnchorDraft] = useState("");
  const [journey, setJourney] = useState<Journey | null>(() => restoreJourney());
  const [threadExploration, setThreadExploration] = useState<ThreadExploration | null>(null);
  const [entryPhase, setEntryPhase] = useState<"closed" | "opening" | "welcoming" | "entered">("closed");
  const entryRunDemoRef = useRef(false);
  const [judgeDemo, setJudgeDemo] = useState(() => new URLSearchParams(window.location.search).get("demo") === "1");
  const [saved, setSaved] = useState<SavedDoor[]>(() => restoreSavedDoors());
  const [accountSaveStatus, setAccountSaveStatus] = useState<AccountSaveSyncStatus>("loading");
  const [accountSaveNotice, setAccountSaveNotice] = useState("");
  const [accountSyncAttempt, setAccountSyncAttempt] = useState(0);
  const syncedAccountDoorsRef = useRef<Map<string, SavedDoor> | null>(null);
  const accountWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const accountRevisionRef = useRef<number | null>(null);
  const cloudBusyRef = useRef(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMessage, setCloudMessage] = useState("");
  const [cloudError, setCloudError] = useState(false);
  const [accountProgress, setAccountProgress] = useState<ProgressSummary | null>(null);
  const [accountProgressStatus, setAccountProgressStatus] = useState<AccountProgressStatus>("loading");
  const [accountProgressError, setAccountProgressError] = useState("");
  const [progressSyncAttempt, setProgressSyncAttempt] = useState(0);
  const [feedback, setFeedback] = useState<Record<string, string>>(() =>
    personalizationEnabled ? restoreFeedback() : {},
  );
  const [openedIds, setOpenedIds] = useState<string[]>(() =>
    personalizationEnabled ? readStore<unknown[]>("opendoor.opened", []).filter((value): value is string => typeof value === "string") : [],
  );
  const [selectedNode, setSelectedNode] = useState("");
  const [toast, setToast] = useState("");
  const [groupMode, setGroupMode] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([
    { name: "Mara Chen", anchors: "independent cinema, live jazz" },
    { name: "Theo Brooks", anchors: "Japanese breakfast, poetry" },
    { name: "Imani Reed", anchors: "live jazz, printmaking" },
  ]);
  const [groupBuilt, setGroupBuilt] = useState(false);
  const [oneHour, setOneHour] = useState(false);
  const [storyCopied, setStoryCopied] = useState(false);
  useEffect(() => {
    if (journey?.mode === "live") setJourneyMode("live");
  }, []);
  useEffect(() => {
    if (!authLoaded || cloudBusy) return;
    let active = true;
    syncedAccountDoorsRef.current = null;
    accountRevisionRef.current = null;
    setAccountProgress(null);
    setAccountProgressStatus("loading");
    setAccountProgressError("");

    if (!isSignedIn || !accountUserId) {
      const previousOwner = readStore<string | null>(SAVED_OWNER_KEY, null);
      const guestDoors = previousOwner
        ? restoreSavedDoorEntries(readStore<StoredDoor[]>(GUEST_SAVED_KEY, []))
        : restoreSavedDoors();
      if (previousOwner) safeRemoveStore(SAVED_OWNER_KEY);
      setSaved(guestDoors);
      setAccountSaveNotice("");
      setAccountSaveStatus("guest");
      return () => { active = false; };
    }

    setAccountSaveStatus("loading");
    setAccountSaveNotice("");
    setSaved([]);
    const previousOwner = readStore<string | null>(SAVED_OWNER_KEY, null);
    const guestDoors = previousOwner ? [] : restoreSavedDoors();
    if (!previousOwner) safeSetStore(GUEST_SAVED_KEY, guestDoors);
    const controller = new AbortController();

    void fetch("/api/account/saved-doors", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) {
          throw await readAccountApiError(response, "Your account-saved doors could not be loaded. Retry the connection.");
        }
        return response.json();
      })
      .then(result => {
        if (!active) return;
        if (!Number.isSafeInteger(result.revision)) throw new Error("Account version could not be loaded.");
        accountRevisionRef.current = result.revision;
        const revisionKey = `opendoor.saved.revision.${accountUserId}`;
        const storedRevision = readStore<number>(revisionKey, 0);
        if (storedRevision !== result.revision) safeRemoveStore(`opendoor.saved.pending.${accountUserId}`);
        safeSetStore(revisionKey, result.revision);
        const pending = pendingSavedDoorsFor(accountUserId);
        const remoteDoors = restoreSavedDoorEntries(result?.savedDoors);
        const remoteIds = new Set(remoteDoors.map(door => door.id));
        const pendingUpserts = pending.upserts.filter(door => !pending.removals.includes(door.id));
        const pendingIds = new Set(pendingUpserts.map(door => door.id));
        const pendingRemovedCount = pending.removals.filter(id => remoteIds.has(id)).length;
        const pendingAddedCount = pendingUpserts.filter(door => !remoteIds.has(door.id)).length;
        const availableForGuestImport = Math.max(
          0,
          MAX_ACCOUNT_SAVED_DOORS - remoteDoors.length + pendingRemovedCount - pendingAddedCount,
        );
        const alreadySavedIds = new Set([...remoteIds, ...pendingIds]);
        const guestCandidates = guestDoors.filter(door => !alreadySavedIds.has(door.id));
        const guestToImport = guestCandidates.slice(0, availableForGuestImport);
        const mergedDoors = mergeAccountSavedDoors(remoteDoors, guestToImport, pending)
          .slice(0, MAX_ACCOUNT_SAVED_DOORS);
        if (guestCandidates.length > guestToImport.length) {
          setAccountSaveNotice("Your account can hold up to 100 saved doors. The rest of your Guest collection remains in this browser.");
        }
        safeSetStore(SAVED_OWNER_KEY, accountUserId);
        syncedAccountDoorsRef.current = new Map(remoteDoors.map(door => [door.id, door]));
        setSaved(mergedDoors);
        setAccountSaveStatus("ready");
      })
      .catch(error => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setAccountSaveStatus("error");
        setAccountSaveNotice(error instanceof Error
          ? error.message
          : "Account-saved doors couldn’t load. Retry the connection.");
      });
    return () => { active = false; controller.abort(); };
  }, [authLoaded, isSignedIn, accountUserId, accountSyncAttempt, cloudBusy]);

  useEffect(() => {
    if (!authLoaded) {
      if (!readStore<string | null>(SAVED_OWNER_KEY, null)) {
        safeSetStore("opendoor.saved", saved);
        safeSetStore(GUEST_SAVED_KEY, saved);
      }
      return;
    }
    if (!isSignedIn || !accountUserId) {
      if (accountSaveStatus === "guest") {
        safeSetStore("opendoor.saved", saved);
        safeSetStore(GUEST_SAVED_KEY, saved);
      }
      return;
    }
    if (accountSaveStatus !== "ready"
      || readStore<string | null>(SAVED_OWNER_KEY, null) !== accountUserId) return;
    safeSetStore("opendoor.saved", saved);
  }, [authLoaded, isSignedIn, accountUserId, saved, accountSaveStatus]);

  useEffect(() => {
    if (cloudBusy || !authLoaded || !isSignedIn || !accountUserId || accountSaveStatus !== "ready"
      || readStore<string | null>(SAVED_OWNER_KEY, null) !== accountUserId
      || !syncedAccountDoorsRef.current) return;
    let active = true;
    const pendingKey = `opendoor.saved.pending.${accountUserId}`;
    const previous = [...syncedAccountDoorsRef.current.values()];
    const next = new Map(saved.map(door => [door.id, door]));
    const changes = diffAccountSavedDoors(previous, [...next.values()]);
    const pending = combinePendingSavedDoorChanges(pendingSavedDoorsFor(accountUserId), changes);
    syncedAccountDoorsRef.current = next;
    if (!pending.upserts.length && !pending.removals.length) return () => { active = false; };

    const payload = JSON.stringify(pending);
    safeSetStore(pendingKey, pending);
    const timer = window.setTimeout(() => {
      accountWriteQueueRef.current = accountWriteQueueRef.current.catch(() => {}).then(async () => {
        if (!active || cloudBusyRef.current) return;
        setAccountSaveStatus("saving");
        const response = await fetch("/api/account/saved-doors", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ ...pending, revision: accountRevisionRef.current }),
        });
        if (!response.ok) {
          throw await readAccountApiError(response, "Account saves could not be synced. Retry to keep your doors with your account.");
        }
        if (!active) return;
        if (JSON.stringify(pendingSavedDoorsFor(accountUserId)) === payload) safeRemoveStore(pendingKey);
        setAccountSaveNotice("");
        setAccountSaveStatus("ready");
      }).catch(error => {
        if (!active) return;
        setAccountSaveNotice(error instanceof Error
          ? error.message
          : "Account saves could not be synced. Retry the connection.");
        setAccountSaveStatus("error");
      });
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [saved, authLoaded, isSignedIn, accountUserId, accountSyncAttempt, cloudBusy]);

  useEffect(() => {
    if (cloudBusy || view !== "progress" || !authLoaded || !isSignedIn || !accountUserId) return;
    if (accountSaveStatus !== "ready") {
      setAccountProgressStatus(accountSaveStatus === "error" ? "error" : "loading");
      setAccountProgressError(accountSaveStatus === "error"
        ? "Your account-saved doors couldn’t be synchronized."
        : "");
      return;
    }
    let active = true;
    setAccountProgressStatus("loading");
    const controller = new AbortController();
    void fetch("/api/account/progress", { headers: { Accept: "application/json" }, signal: controller.signal })
      .then(async response => {
        if (!response.ok) {
          throw await readAccountApiError(response, "Your progress couldn’t load. Retry the connection.");
        }
        return response.json();
      })
      .then(result => {
        if (!active) return;
        setAccountProgress({
          doorsOpened: Number.isFinite(result?.doorsOpened) ? Math.max(0, result.doorsOpened) : 0,
          braveDoorsOpened: Number.isFinite(result?.braveDoorsOpened) ? Math.max(0, result.braveDoorsOpened) : 0,
          categories: Array.isArray(result?.categories)
            ? result.categories.filter((item: unknown): item is string => typeof item === "string")
            : [],
        });
        setAccountProgressStatus("ready");
        setAccountProgressError("");
      })
      .catch(error => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setAccountProgressStatus("error");
        setAccountProgressError(error instanceof Error
          ? error.message
          : "Progress couldn’t load. Retry the connection.");
      });
    return () => { active = false; controller.abort(); };
  }, [view, authLoaded, isSignedIn, accountUserId, accountSaveStatus, progressSyncAttempt, cloudBusy]);

  useEffect(() => {
    let active = true;
    getAgentStatus().then(status => { if (active) setAgentStatus(status); }).catch(error => {
      if (active) setStatusError(error instanceof Error ? error.message : "Configuration status is unavailable.");
    });
    return () => { active = false; abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (personalizationEnabled) safeSetStore("opendoor.journey", journey);
    else safeRemoveStore("opendoor.journey");
  }, [journey, personalizationEnabled]);
  useEffect(() => {
    if (personalizationEnabled) safeSetStore("opendoor.feedback", feedback);
    else safeRemoveStore("opendoor.feedback");
  }, [feedback, personalizationEnabled]);
  useEffect(() => {
    if (personalizationEnabled) safeSetStore("opendoor.opened", openedIds);
    else safeRemoveStore("opendoor.opened");
  }, [openedIds, personalizationEnabled]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const demoUrl = new URL(window.location.href);
    if (!judgeDemo) return;
    demoUrl.searchParams.delete("demo");
    window.history.replaceState({}, "", `${demoUrl.pathname}${demoUrl.search}${demoUrl.hash}`);
  }, []);
  const savedIds = useMemo(() => new Set(saved.map(item => item.id)), [saved]);
  const openedCategories = useMemo(() => new Set(openedIds.map(id => id.split("|")[1]).filter(Boolean)), [openedIds]);
  const openedTiers = useMemo(() => openedIds.reduce<Record<string, number>>((counts, id) => {
    const tier = id.split("|")[2];
    if (tier) counts[tier] = (counts[tier] || 0) + 1;
    return counts;
  }, {}), [openedIds]);
  const dnaNodes = useMemo(() => {
    if (!journey) return [];
    if (journey.mode === "live") return (journey.graph?.nodes || []).map(node => ({
      id: node.id, label: node.label, kind: node.provenance === "USER" ? "USER INPUT" : "QLOO ENTITY",
      category: (node.category || "Other") as Category, detail: node.detail, result: node.label,
    }));
    return [
      ...journey.anchors.map((anchor, index) => ({ id: `anchor-${index}`, label: anchor, kind: "USER INPUT", category: journey.categories[anchor] || inferredCategory(anchor), detail: `Entered explicitly as an anchor. Category is the one you selected or a broad deterministic sample grouping.`, result: journey.doors[index % 3]?.title || "No current result" })),
      ...journey.doors.map((door, index) => ({ id: `bridge-${index}`, label: door.thread, kind: "SAMPLE CONNECTION", category: door.category, detail: `${door.evidence} This relationship was not retrieved from Qloo.`, result: door.title })),
      ...journey.doors.map((door, index) => ({ id: `door-${index}`, label: door.title, kind: "DEMO EXPERIENCE", category: door.category, detail: `Illustrative experience direction from the deterministic demo path. Not a real-world listing.`, result: door.title })),
    ];
  }, [journey]);

  function addAnchor(value: string, category = categoryDraft) {
    const clean = value.trim().replace(/\s+/g, " ");
    if (!clean) return;
    if (anchors.some(item => item.toLowerCase() === clean.toLowerCase())) { setAnchorDraft(""); return; }
    if (anchors.length >= 5) { setToast("Up to five starting anchors"); return; }
    setAnchors(current => [...current, clean]);
    setCategories(current => ({ ...current, [clean]: category }));
    setAnchorDraft("");
  }
  function removeAnchor(item: string) {
    setAnchors(current => current.filter(anchor => anchor !== item));
    setCategories(current => { const next = { ...current }; delete next[item]; return next; });
  }
  function updateAnchorCategory(anchor: string, category: Category) {
    setCategories(current => ({ ...current, [anchor]: category }));
    setJourney(current => current ? { ...current, categories: { ...current.categories, [anchor]: category } } : current);
  }
  function generate(nextAnchors: string[], nextIntent = intent, iteration = 0, feedbackValues = Object.values(feedback).filter(value => value && value !== "choose")) {
    const usedAnchors = nextAnchors.length ? nextAnchors : EXAMPLES;
    const nextCategories = { ...categories };
    usedAnchors.forEach(anchor => { if (!nextCategories[anchor]) nextCategories[anchor] = inferredCategory(anchor); });
    const next: Journey = {
      city: city.trim() || "Your chosen place", occasion, intent: nextIntent, anchors: usedAnchors,
      categories: nextCategories, context: { ...context, time: occasion }, depth,
      doors: makeDoors(city, usedAnchors, nextCategories, nextIntent, depth, { ...context, time: occasion }, feedbackValues, iteration), iteration, mode: "demo",
      feedbackApplied: feedbackValues,
    };
    setAnchors(usedAnchors); setCategories(nextCategories); setJourney(next); setSelectedNode("");
    requestAnimationFrame(() => document.getElementById("journey-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function toDoor(item: LiveDoor): Door {
    return {
      id: item.id, tier: item.tier, title: item.title, kind: item.kind,
      category: (CATEGORIES.includes(item.category as Category) ? item.category : "Other") as Category,
      source: item.source, why: item.why, whyYou: item.whyYou, now: item.whyNow || item.now,
      evidence: item.evidence, thread: item.thread, entityId: item.entityId, entityType: item.entityType,
      sourceEntityIds: item.sourceEntityIds, coordinates: item.coordinates, popularity: item.popularity,
      discoveryDistance: item.discoveryDistance, explainability: item.explainability, imageUrl: item.imageUrl,
    };
  }
  function createRequest(nextAnchors: string[], nextIntent = intent, nextIteration = 0, feedbackValues = Object.values(feedback).filter(value => value && value !== "choose")): DiscoveryRequest {
    const used = nextAnchors.length ? nextAnchors : EXAMPLES;
    const cats = { ...categories };
    used.forEach(anchor => { cats[anchor] ||= inferredCategory(anchor); });
    return {
      location: city.trim() || "Your chosen place", occasion, intent: nextIntent, depth,
      context: publicContext({ ...context, time: occasion }),
      anchors: used.map(label => ({ label, category: cats[label] || inferredCategory(label) })),
      excludedEntityIds: journey?.doors.map(door => door.entityId).filter((id): id is string => Boolean(id)),
      feedback: feedbackValues, iteration: nextIteration,
    };
  }
  async function runLive(nextAnchors: string[], nextIntent = intent, nextIteration = 0, feedbackValues = Object.values(feedback).filter(value => value && value !== "choose"), requestOverride?: DiscoveryRequest, localContext = context) {
    if (!agentStatus?.qlooConfigured) {
      setLiveError("Live discovery is not configured. Choose Demo, or configure Qloo on the server.");
      return null;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const localScenarioCategory = localContext.scenarioCategory;
    const localScenario = localContext.scenario;
    setIsRunning(true); setLiveError(""); setLiveStages([]);
    try {
      const result = await runAgentDiscovery(requestOverride || createRequest(nextAnchors, nextIntent, nextIteration, feedbackValues), event => {
        if (event.type === "stage") setLiveStages(current => [...current, event]);
      }, controller.signal);
      const next: Journey = {
        city: result.city, occasion: result.occasion, intent: result.intent as Intent, anchors: result.anchors,
        categories: result.categories as Record<string, Category>, context: {
          ...EMPTY_CONTEXT, ...result.context, time: result.occasion,
          scenarioCategory: localScenarioCategory, scenario: localScenario,
        },
        depth: result.depth as Depth, doors: result.doors.map(toDoor), iteration: result.iteration, mode: "live",
        graph: result.graph, resolvedAnchors: result.resolvedAnchors, tools: result.tools, notices: result.notices,
        methodology: result.methodology, feedbackApplied: result.feedbackApplied, generatedAt: result.generatedAt,
      };
      setJourney(next); setAnchors(next.anchors); setCategories(next.categories); setSelectedNode("");
      setLiveError("");
      requestAnimationFrame(() => document.getElementById("journey-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return result;
    } catch (error) {
      if (controller.signal.aborted) return null;
      setLiveError(error instanceof Error ? error.message : "Live discovery failed. No sample was substituted.");
      return null;
    } finally {
      if (abortRef.current === controller) setIsRunning(false);
    }
  }
  function runJourney(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedFeedback = Object.values(feedback).filter(value => value && value !== "choose");
    if (journeyMode === "live") {
      void runLive(anchors, intent, journey?.iteration || 0, selectedFeedback).then(result => {
        if (result) { setFeedback({}); setToast("Live Qloo journey received"); }
      });
    } else {
      generate(anchors, intent, 0, selectedFeedback);
      setFeedback({});
      if (selectedFeedback.length) setToast("Your explicit feedback will shape the next live exploration");
    }
  }
  function startDemoJourney(scrollBehavior: ScrollBehavior = "smooth", preserveScenario = false) {
    if (preserveScenario && journeyMode === "live") {
      void runLive(anchors, intent, journey?.iteration || 0, Object.values(feedback).filter(value => value && value !== "choose"));
      return;
    }
    pendingDemoScroll.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : scrollBehavior;
    setJourneyMode("demo");
    setLiveError("");
    const demoCity = "Brooklyn, New York";
    const demoOccasion = "One memorable afternoon";
    const demoIntent: Intent = "Try something new";
    const demoDepth: Depth = "Surprise me";
    const demoContext: Context = {
      time: demoOccasion, budget: "Free or low-cost", movement: "Easy walking", conditions: "Social setting",
      ...(preserveScenario ? { scenarioCategory: context.scenarioCategory, scenario: context.scenario } : {}),
    };
    const demoCategories: Record<string, Category> = { "independent cinema": "Film", "Japanese breakfast": "Food", "live jazz": "Music" };
    const demoAnchors = [...EXAMPLES];
    const demoJourney: Journey = {
      city: demoCity, occasion: demoOccasion, intent: demoIntent, anchors: demoAnchors,
      categories: demoCategories, context: demoContext, depth: demoDepth,
      doors: makeDoors(demoCity, demoAnchors, demoCategories, demoIntent, demoDepth, demoContext, [], 0), mode: "demo",
      iteration: 0,
    };
    setCity(demoCity); setOccasion(demoOccasion); setIntent(demoIntent); setDepth(demoDepth);
    setContext(demoContext); setAnchors(demoAnchors); setCategories(demoCategories);
    setEntryPhase("entered");
    setGroupMode(false); setOneHour(false); setFeedback({}); setJourney(demoJourney); setSelectedNode(""); setView("discover");
  }
  useEffect(() => {
    if (journey && pendingDemoScroll.current) {
      const behavior = pendingDemoScroll.current;
      pendingDemoScroll.current = null;
      document.getElementById("journey-result")?.scrollIntoView({ behavior, block: "start" });
    }
  }, [journey]);
  useEffect(() => {
    if (window.location.pathname === "/demo" && !demoRouteTried.current) {
      demoRouteTried.current = true;
      startDemoJourney("instant");
    }
  }, []);
  function completeEntryAnimation() {
    setEntryPhase("entered");
    if (entryRunDemoRef.current) {
      entryRunDemoRef.current = false;
      setJudgeDemo(false);
      startDemoJourney("instant");
    }
  }
  useEffect(() => {
    if (entryPhase !== "opening" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setEntryPhase("welcoming"), 1050);
    return () => window.clearTimeout(timer);
  }, [entryPhase]);
  function openEntry(runPreparedDemo = false) {
    if (entryPhase !== "closed") return;
    setEntryPhase("opening");
    entryRunDemoRef.current = runPreparedDemo || judgeDemo;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.setTimeout(completeEntryAnimation, 0);
    }
  }
  function resetJourney() {
    setJourney(null); setFeedback({}); setSelectedNode(""); setGroupBuilt(false); setView("discover");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function updatePersonalization(enabled: boolean) {
    setPersonalizationEnabled(enabled);
    safeSetStore("opendoor.privacy.personalization", enabled);
    if (!enabled) {
      safeRemoveStore("opendoor.journey");
      safeRemoveStore("opendoor.feedback");
      safeRemoveStore("opendoor.opened");
    }
  }
  function exportLocalData() {
    const exportData = {
      exportedAt: new Date().toISOString(),
      storage: isSignedIn
        ? "This export includes the account-saved doors and account progress summary currently loaded in this browser, plus local browser data. Account preference memory is not included. It does not include server audit records, authentication credentials, or other account records."
        : "This export includes data stored in this browser by Open Door. It does not include server audit records or credentials.",
      personalizationEnabled,
      currentJourney: journey,
      savedDoors: saved,
      savedDoorsStoredIn: isSignedIn ? "signed-in account" : "this browser",
      accountProgress: isSignedIn ? accountProgress : null,
      explicitFeedback: feedback,
      openedDoorIds: openedIds,
      discoveryLab: lab.state,
      accountPreferences: "Not included in this export. Manage optional account preference memory from the discovery form.",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `open-door-browser-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function clearLocalData() {
    lab.clear();
    sound.reset();
    setJourney(null);
    if (!isSignedIn) setSaved([]);
    setFeedback({});
    setOpenedIds([]);
    for (const key of ["opendoor.journey", "opendoor.feedback", "opendoor.opened"]) {
      safeRemoveStore(key);
    }
    if (!isSignedIn) {
      safeRemoveStore("opendoor.saved");
      safeRemoveStore(GUEST_SAVED_KEY);
    }
  }
  async function deleteCloudData(scope: "progress" | "saved-doors" | "all" | "close") {
    if (!accountUserId || cloudBusyRef.current) return;
    cloudBusyRef.current = true;
    setCloudBusy(true);
    setCloudMessage("");
    setCloudError(false);
    try {
      // Settle writes already sent before issuing the destructive operation.
      await accountWriteQueueRef.current.catch(() => {});
      if (currentAccountRef.current !== accountUserId) throw new Error("Your signed-in account changed. No deletion was requested. Reload to continue.");
      const result = await requestAccountDeletion(scope);
      if (currentAccountRef.current !== accountUserId) return;
      safeRemoveStore(`opendoor.saved.pending.${accountUserId}`);
      if (scope !== "progress") {
        setSaved([]);
        syncedAccountDoorsRef.current = new Map();
        safeSetStore("opendoor.saved", []);
        // Keep the owner marker so this empty account cache is not Guest data.
      }
      if (scope !== "saved-doors") setAccountProgress({ doorsOpened: 0, braveDoorsOpened: 0, categories: [] });
      if (scope === "close") {
        setCloudMessage("Account closed. Cloud saved doors and rewards erased. Signing out…");
        try { await signOut({ redirectUrl: "/" }); }
        catch { throw new Error("Account closed and cloud data erased, but sign-out could not finish. Reload this page to leave the old session."); }
      } else {
        accountRevisionRef.current = result.revision;
        safeSetStore(`opendoor.saved.revision.${accountUserId}`, result.revision);
        setCloudMessage("Selected cloud data erased. Your login, Guest collection, browser journey, and Discovery Lab data are unchanged.");
      }
    } catch (error) {
      setCloudError(true);
      setCloudMessage(error instanceof Error ? error.message : "Deletion could not be confirmed. Retry.");
    } finally {
      cloudBusyRef.current = false;
      setCloudBusy(false);
      setAccountSyncAttempt(attempt => attempt + 1);
    }
  }
  function resetCompass(nextIntent: Intent) {
    setIntent(nextIntent);
    const selectedFeedback = Object.values(feedback).filter(value => value && value !== "choose");
    if (journeyMode === "live") {
      void runLive(journey?.anchors || anchors, nextIntent, (journey?.iteration || 0) + 1, selectedFeedback).then(result => {
        if (result) { setFeedback({}); setToast(`Compass reset: ${nextIntent.toLowerCase()}`); }
      });
      return;
    }
    generate(journey?.anchors || anchors, nextIntent, (journey?.iteration || 0) + 1, selectedFeedback);
    setFeedback({});
    setToast(`Compass reset: ${nextIntent.toLowerCase()}`);
  }
  function toggleSave(door: Door, location: string, chosenAnchors: string[]) {
    if (cloudBusyRef.current) return;
    if (isSignedIn && accountSaveStatus !== "ready") {
      setToast("Wait for your account saves to sync before changing My Doors.");
      return;
    }
    if (savedIds.has(door.id)) {
      setSaved(current => current.filter(item => item.id !== door.id)); setToast("Removed from My Doors");
    } else {
      if (isSignedIn && saved.length >= MAX_ACCOUNT_SAVED_DOORS) {
        setToast("Your account has room for 100 saved doors. Remove one to save another.");
        return;
      }
      setSaved(current => [{ ...door, city: location, savedAt: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }), anchors: chosenAnchors, mode: journey?.mode || "demo" }, ...current]);
      setToast("Saved to My Doors");
    }
  }
  function updateSavedDoors(update: (current: SavedDoor[]) => SavedDoor[]) {
    if (cloudBusyRef.current) return;
    if (isSignedIn && accountSaveStatus !== "ready") {
      setToast("Wait for your account saves to sync before changing My Doors.");
      return;
    }
    setSaved(update);
  }
  async function recordProgressDoor(door: Door) {
    if (cloudBusyRef.current || !authLoaded || !isSignedIn || !accountUserId || accountRevisionRef.current === null) return;
    const revision = accountRevisionRef.current;
    const write = accountWriteQueueRef.current.catch(() => {}).then(async () => {
    if (cloudBusyRef.current) return;
    try {
      const response = await fetch("/api/account/progress/doors", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ doors: [{ id: door.id, tier: door.tier, category: door.category }], revision }),
      });
      if (!response.ok) {
        throw await readAccountApiError(response, "This door’s progress could not be saved.");
      }
      if (view === "progress") setProgressSyncAttempt(attempt => attempt + 1);
    } catch {
      setToast("This door’s progress could not be synced. Retry by reopening the door while signed in.");
    }
    });
    accountWriteQueueRef.current = write;
    await write;
  }
  async function openNext(door: Door) {
    if (!journey || isRunning) return;
    const previous = journey;
    const nextAnchor = door.title;
    const nextIteration = previous.iteration + 1;
    const selectedFeedback = Object.values(feedback).filter(value => value && value !== "choose");
    const pending: ThreadExploration = { from: nextAnchor, previous, selected: door, status: "loading", targetIds: [] };
    setThreadExploration(pending);
    // Continue from the displayed result's source, not an unrelated form-mode toggle.
    if (previous.mode === "live") {
      if (!door.entityId || !door.entityType) {
        setThreadExploration({ ...pending, status: "error", error: "This result has no reusable Qloo entity. Your recommendations are unchanged; try another door." });
        return;
      }
      const request: DiscoveryRequest = {
        location: previous.city, occasion: previous.occasion, intent: previous.intent, depth: previous.depth,
        context: publicContext(previous.context), anchors: [{ label: nextAnchor, category: door.category }],
        resolvedEntities: [{ label: nextAnchor, category: door.category, entityId: door.entityId, entityType: door.entityType }],
        excludedEntityIds: previous.doors.flatMap(item => item.entityId ? [item.entityId] : []),
        feedback: selectedFeedback, iteration: nextIteration,
      };
      const result = await runLive([nextAnchor], previous.intent, nextIteration, selectedFeedback, request, previous.context);
      if (result) {
        setFeedback({});
        setThreadExploration({ ...pending, status: "ready", targetIds: result.doors.map(item => item.id) });
      } else {
        setThreadExploration({ ...pending, status: "error", error: "This thread could not be continued. Your previous recommendations are still here. Retry, or choose another door; no demo was substituted." });
      }
      return;
    }
    const nextCategories = previous.categories;
    const seenTitles = [...new Set([...(previous.demoSeenTitles || []), ...previous.doors.map(item => item.title)])];
    setAnchors(previous.anchors); setCategories(nextCategories);
    const next: Journey = {
      ...previous, categories: nextCategories, mode: "demo",
      doors: makeDoors(previous.city, previous.anchors, nextCategories, previous.intent, previous.depth, previous.context, selectedFeedback, nextIteration, { seenTitles, focusCategory: door.category }),
      iteration: nextIteration, demoSeenTitles: seenTitles,
    };
    setJourney(next);
    setThreadExploration({ ...pending, status: "ready", targetIds: next.doors.map(item => item.id) });
    setFeedback({}); setSelectedNode("");
  }
  function returnFromThread() {
    if (!threadExploration || isRunning) return;
    const previous = threadExploration.previous;
    setJourney(previous); setAnchors(previous.anchors); setCategories(previous.categories);
    setCity(previous.city); setOccasion(previous.occasion); setContext(previous.context);
    setIntent(previous.intent); setDepth(previous.depth); setJourneyMode(previous.mode || "demo");
    setThreadExploration(null); setSelectedNode(""); setFeedback({}); setLiveError("");
    requestAnimationFrame(() => document.getElementById("journey-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function setDoorFeedback(id: string, reason: string) {
    setFeedback(current => {
      const next = { ...current };
      if (!reason) delete next[id]; else next[id] = reason;
      return next;
    });
  }
  async function shareStory() {
    if (!journey) return;
    const story = `My Open Door ${journey.mode === "live" ? "live" : "demo"} journey\nI started with ${journey.anchors.join(", ")}.\nThe journey opened toward ${journey.doors.map(door => door.title).join(", ")}.\n${journey.mode === "live" ? "Qloo-backed response; not verified venue availability." : "Demo only: authored illustrative cultural paths, not Qloo data or venue recommendations."}`;
    try {
      if (navigator.share) await navigator.share({ title: "My Open Door story", text: story });
      else { await navigator.clipboard.writeText(story); setStoryCopied(true); setToast("Selected story details copied"); }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setToast("Sharing canceled");
        return;
      }
      try { await navigator.clipboard.writeText(story); setStoryCopied(true); setToast("Selected story details copied"); }
      catch { setToast("Share is unavailable in this browser"); }
    }
  }
  function downloadStoryCard() {
    if (!journey) return;
    const start = escapeXml(journey.anchors[0] || "your chosen interests");
    const first = escapeXml(journey.doors[0]?.title || "A familiar door");
    const unexpected = escapeXml(journey.doors[2]?.title || "An unexpected door");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs><linearGradient id="paper" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f3eddf"/><stop offset="1" stop-color="#dedbca"/></linearGradient><linearGradient id="inside" x1="0" x2="1"><stop stop-color="#24423a"/><stop offset="1" stop-color="#917b55"/></linearGradient></defs>
      <rect width="1200" height="630" fill="url(#paper)"/><path d="M0 44H1200M0 586H1200" stroke="#c8c0ae"/>
      <text x="82" y="105" fill="#9b604b" font-family="monospace" font-size="15" letter-spacing="4">OPEN DOOR · ${journey.mode === "live" ? "QLOO JOURNEY" : "DEMO STORY"}</text>
      <text x="82" y="205" fill="#28332d" font-family="Georgia,serif" font-size="62">I started with</text>
      <text x="82" y="270" fill="#31594f" font-family="Georgia,serif" font-size="45">${start}</text>
      <text x="82" y="345" fill="#777b70" font-family="monospace" font-size="14" letter-spacing="2">A FAMILIAR DOOR</text>
      <text x="82" y="390" fill="#28332d" font-family="Georgia,serif" font-size="31">${first}</text>
      <text x="82" y="454" fill="#777b70" font-family="monospace" font-size="14" letter-spacing="2">THEN AN UNEXPECTED THREAD</text>
      <text x="82" y="498" fill="#28332d" font-family="Georgia,serif" font-size="28">${unexpected}</text>
      <path d="M900 586V253a145 145 0 0 1 290 0v333" fill="#6b6351"/><path d="M921 586V254a124 124 0 0 1 248 0v332" fill="url(#inside)" stroke="#c3ad7f" stroke-width="3"/>
      <path d="M964 586V254a81 81 0 0 1 162 0v332" fill="none" stroke="#d6c79d" stroke-width="2" opacity=".65"/>
      <circle cx="1101" cy="430" r="6" fill="#d6c79d"/>
      <text x="82" y="610" fill="#777b70" font-family="monospace" font-size="12">${journey.mode === "live" ? "QLOO RESPONSE · NOT VERIFIED VENUE AVAILABILITY" : "ILLUSTRATIVE SAMPLE PATH · NOT QLOO OUTPUT OR A REAL-WORLD LISTING"}</text>
    </svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "my-open-door-story.svg"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("Your Open Door story card was downloaded");
  }
  function buildGroup() { setGroupBuilt(true); }
  function updateParticipant(index: number, field: keyof Participant, value: string) {
    setParticipants(current => current.map((person, i) => i === index ? { ...person, [field]: value } : person));
    setGroupBuilt(false);
  }
  function addParticipant() {
    if (participants.length < 5) setParticipants(current => [...current, { name: `Person ${current.length + 1}`, anchors: "" }]);
  }
  function removeParticipant(index: number) {
    if (participants.length > 2) setParticipants(current => current.filter((_, i) => i !== index));
    setGroupBuilt(false);
  }
  function exploreSaved(item: SavedDoor) {
    void recordProgressDoor(item);
    setCity(item.city); setAnchors([item.title]); setCategories({ [item.title]: item.category }); setIntent("Try something new"); setView("discover");
    setEntryPhase("entered");
    if (item.mode === "live") {
      if (!item.entityId || !item.entityType) {
        setToast("This saved choice can’t be explored further. Try starting a new discovery.");
        return;
      }
      const request: DiscoveryRequest = {
        location: item.city, occasion, intent: "Try something new", depth, context: publicContext({ ...context, time: occasion }),
        anchors: [{ label: item.title, category: item.category }], feedback: [], iteration: 1,
        resolvedEntities: [{ label: item.title, category: item.category, entityId: item.entityId, entityType: item.entityType }],
        excludedEntityIds: [item.entityId],
      };
      void runLive([item.title], "Try something new", 1, [], request);
      return;
    }
    const originalInterests = item.anchors.filter(anchor => !/· step \d+/.test(anchor));
    const roots = originalInterests.length ? originalInterests : [item.category.toLowerCase()];
    const next = Object.fromEntries(roots.map(anchor => [anchor, inferredCategory(anchor)]));
    setAnchors(roots); setCategories(next);
    const nextJourney: Journey = { city: item.city, occasion, intent: "Try something new", anchors: roots, categories: next, context: { ...context, time: occasion }, depth, doors: makeDoors(item.city, roots, next, "Try something new", depth, { ...context, time: occasion }, [], 1, { seenTitles: [item.title], focusCategory: item.category }), iteration: 1, mode: "demo", demoSeenTitles: [item.title] };
    setJourney(nextJourney);
  }
  function exploreCategory(category: Category) {
    const anchor = category;
    const nextCategories = { ...categories, [anchor]: category };
    const nextIntent: Intent = "Try something new";
    const iteration = (journey?.iteration || 0) + 1;
    if (journeyMode === "live") {
      setAnchors([anchor]); setCategories(nextCategories); setIntent(nextIntent); setView("discover"); setEntryPhase("entered");
      void runLive([anchor], nextIntent, iteration, []).then(result => { if (result) setSelectedNode(""); });
      return;
    }
    setAnchors([anchor]); setCategories(nextCategories); setIntent(nextIntent); setView("discover"); setEntryPhase("entered");
    setJourney({
      city: city.trim() || "Your chosen place", occasion, intent: nextIntent, anchors: [anchor], categories: nextCategories,
      context: { ...context, time: occasion }, depth,
      doors: makeDoors(city, [anchor], nextCategories, nextIntent, depth, { ...context, time: occasion }, [], iteration), iteration, mode: "demo",
    });
    setSelectedNode("");
    requestAnimationFrame(() => document.getElementById("journey-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function buildDayPlan(input: DayPlanInput) {
    const location = input.location.trim() || city.trim() || "Your chosen place";
    const nextContext: Context = {
      ...context,
      time: occasion,
      startTime: input.startTime,
      endTime: input.endTime,
      budget: input.budget,
    };
    const nextDepth: Depth = input.novelty === "Familiar first"
      ? "Close to home"
      : input.novelty === "Unexpected first" ? "Take me somewhere unexpected" : depth;
    const usedAnchors = journey?.anchors.length ? journey.anchors : anchors;
    const usedCategories = { ...categories, ...(journey?.categories || {}) };
    usedAnchors.forEach(anchor => { usedCategories[anchor] ||= inferredCategory(anchor); });
    const nextIteration = (journey?.iteration || 0) + 1;
    setCity(location); setContext(nextContext); setDepth(nextDepth);

    if (journeyMode === "live") {
      const selectedFeedback = Object.values(feedback).filter(value => value && value !== "choose");
      const request: DiscoveryRequest = {
        location,
        occasion,
        intent,
        depth: nextDepth,
        context: publicContext(nextContext),
        anchors: usedAnchors.map(label => ({ label, category: usedCategories[label] })),
        excludedEntityIds: journey?.doors.map(door => door.entityId).filter((id): id is string => Boolean(id)),
        feedback: selectedFeedback,
        iteration: nextIteration,
      };
      void runLive(usedAnchors, intent, nextIteration, selectedFeedback, request).then(result => {
        if (result) { setFeedback({}); setToast("Live candidates updated for your day context"); }
      });
      return;
    }

    setJourney({
      city: location,
      occasion,
      intent,
      anchors: usedAnchors,
      categories: usedCategories,
      context: nextContext,
      depth: nextDepth,
      doors: makeDoors(location, usedAnchors, usedCategories, intent, nextDepth, nextContext, Object.values(feedback).filter(value => value && value !== "choose"), nextIteration),
      iteration: nextIteration,
      mode: "demo",
    });
    setToast("Demo day shape updated from your explicit inputs");
    requestAnimationFrame(() => document.getElementById("day-plan")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  if (import.meta.env.DEV && window.location.pathname === "/security-test") {
    return <DevSecurityTestView onBack={() => {
      window.history.replaceState({}, "", "/");
      setView("trust");
    }} />;
  }

  return <div className="app-shell" onClickCapture={sound.onClickCapture}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="topbar">
      <button className="brand" onClick={() => setView("discover")} aria-label="Open Door, Discover">
        <span className="brand-mark"><img src="/mascot/qloo-guide-still.webp" alt="" width="400" height="225" /></span>
        <span><span className="brand-name">open door</span><span className="brand-caption">a cultural field guide</span></span>
      </button>
      <nav className="nav" aria-label="Main navigation">
        <button className={`nav-btn ${view === "discover" ? "active" : ""}`} onClick={() => setView("discover")}>Discover</button>
        <button className={`nav-btn lab-nav ${view === "lab" ? "active" : ""}`} onClick={() => setView("lab")}><span className="lab-nav-full">Discovery </span>Lab</button>
        <button className={`nav-btn ${view === "saved" ? "active" : ""}`} onClick={() => setView("saved")}>My Doors<span className="nav-count">{saved.length || ""}</span></button>
        <button className={`nav-btn ${view === "how" ? "active" : ""}`} onClick={() => setView("how")}>How it works</button>
        <button className={`nav-btn ${view === "trust" ? "active" : ""}`} onClick={() => setView("trust")}>Trust</button>
        {isSignedIn && <button className={`nav-btn progress-nav ${view === "progress" ? "active" : ""}`} onClick={() => setView("progress")}>Progress</button>}
      </nav>
      {isSignedIn
        ? <div className="account-control">
          <span className="account-label" aria-live="polite">
            {accountSaveStatus === "saving" ? "Syncing saves…" : accountSaveStatus === "error" ? "Sync needs attention" : accountSaveStatus === "ready" ? "Saved to your account" : "Loading your account…"}
          </span>
          {accountSaveStatus === "error" && <button type="button" className="account-retry" onClick={() => setAccountSyncAttempt(attempt => attempt + 1)}>Retry</button>}
          <button type="button" className="account-sign-out" onClick={() => setView("trust")}>Account &amp; privacy</button>
          <button type="button" className="account-sign-out" disabled={cloudBusy} onClick={() => void signOut({ redirectUrl: "/" })}>Sign out</button>
        </div>
        : <a className="account-sign-in" href="/sign-in">Sign in</a>}
      <button className="sound-toggle" type="button" data-sound="none" onClick={sound.toggle}
        aria-pressed={sound.enabled} aria-label={`Sound effects: ${sound.enabled ? "on" : "off"}`}
        title={sound.notice || (sound.enabled ? "Mute sound effects" : "Enable gentle sound effects")}>
        {sound.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        <span>Sound {sound.enabled ? "on" : "off"}</span>
      </button>
    </header>
    {sound.notice && <p className="sound-notice" role="status">{sound.notice}</p>}
    <main className="page" id="main-content" tabIndex={-1}>
      {accountSaveNotice && isSignedIn && <p className={`account-sync-notice${accountSaveStatus === "error" ? " is-error" : ""}`} role={accountSaveStatus === "error" ? "alert" : "status"}>
        {accountSaveNotice}{accountSaveStatus === "error" && <button type="button" onClick={() => setAccountSyncAttempt(attempt => attempt + 1)}>Retry account sync</button>}
      </p>}
      {view === "discover" && <DiscoverView
        city={city} setCity={setCity} occasion={occasion} setOccasion={setOccasion} intent={intent} setIntent={setIntent}
        depth={depth} setDepth={setDepth} context={context} setContext={setContext} anchors={anchors} categories={categories}
        threadExploration={threadExploration} onReturnFromThread={returnFromThread}
        setCategory={category => updateAnchorCategory(category.anchor, category.value)}
        categoryDraft={categoryDraft} setCategoryDraft={setCategoryDraft} anchorDraft={anchorDraft} setAnchorDraft={setAnchorDraft}
        addAnchor={addAnchor} removeAnchor={removeAnchor} submit={runJourney} journey={journey} savedIds={savedIds}
        toggleSave={toggleSave} feedback={feedback} setFeedback={setDoorFeedback} reset={resetJourney}
        onLab={door => {
          if (!journey) { setView("lab"); return; }
          if (lab.state.current && !lab.state.activeBranchId && !lab.state.activeCheckpointId
            && !window.confirm("Replace the current unsaved Lab starting point? Saved checkpoints and branches will remain.")) return;
          const opened = lab.start(journeyToLab(journey, door?.id, feedback, groupMode ? participants.map(person => person.anchors).filter(Boolean).join("; ") : ""));
          if (opened) { setView("lab"); window.scrollTo({ top: 0, behavior: "smooth" }); }
        }}
        resetCompass={resetCompass} openNext={openNext} onDoorOpened={door => {
          const visit = `${door.id}|${door.category}|${door.tier}`;
          setOpenedIds(current => current.includes(visit) ? current : [...current, visit]);
          void recordProgressDoor(door);
        }} setView={setView} nodes={dnaNodes} selectedNode={selectedNode}
        setSelectedNode={setSelectedNode} onShare={shareStory} onDownloadStory={downloadStoryCard} storyCopied={storyCopied} openedCount={openedIds.length} openedIds={openedIds}
        openedCategories={openedCategories} openedTiers={openedTiers} savedCount={saved.length} groupMode={groupMode} setGroupMode={setGroupMode}
        participants={participants} updateParticipant={updateParticipant} addParticipant={addParticipant}
        removeParticipant={removeParticipant} groupBuilt={groupBuilt} buildGroup={buildGroup}
        oneHour={oneHour} setOneHour={setOneHour} onStartDemo={startDemoJourney}
        onBuildDay={buildDayPlan}
        entryPhase={entryPhase} onOpenEntry={openEntry} onEntryAnimationComplete={completeEntryAnimation} onSound={sound.play}
        exploreCategory={exploreCategory}
        accountUserId={accountUserId} signedIn={!!isSignedIn}
        judgeDemo={judgeDemo}
        onPreferenceRevisionChanged={() => setAccountSyncAttempt(attempt => attempt + 1)}
         journeyMode={journeyMode} setJourneyMode={setJourneyMode} agentStatus={agentStatus} statusError={statusError}
         liveStages={liveStages} liveError={liveError} isRunning={isRunning} showInspector={showInspector}
         setShowInspector={setShowInspector}
      />}
      {view === "saved" && <SavedView saved={saved} signedIn={!!isSignedIn} remove={id => { updateSavedDoors(current => current.filter(item => item.id !== id)); }} onDiscover={() => setView("discover")} explore={exploreSaved} />}
      {view === "progress" && (isSignedIn
        ? <ProgressView summary={accountProgress} savedCount={saved.length} status={accountProgressStatus} error={accountProgressError} onRetry={() => { if (accountSaveStatus === "error") setAccountSyncAttempt(attempt => attempt + 1); setProgressSyncAttempt(attempt => attempt + 1); }} />
        : <section className="progress-login-prompt">
          <span className="eyebrow">Open Door · your account</span><h1>Sign in to see your progress.</h1>
          <p>Your saved doors and reward tracks belong to your account. Keep exploring as a guest, or sign in to see account progress.</p>
          <div><a href="/sign-in" className="primary-btn">Sign in <ArrowRight size={16} /></a><button type="button" className="secondary-btn" onClick={() => setView("discover")}>Continue as guest</button></div>
        </section>)}
      {view === "lab" && <DiscoveryLab lab={lab} qlooConfigured={!!agentStatus?.qlooConfigured} />}
      {view === "how" && <HowView agentStatus={agentStatus} />}
      {view === "judges" && <JudgesGuide status={agentStatus} statusError={statusError} />}
      {view === "trust" && <TrustView
        personalizationEnabled={personalizationEnabled}
        savedCount={saved.length}
        signedIn={!!isSignedIn}
        savedStorageScope={isSignedIn ? "your account" : "this browser"}
        cloudBusy={cloudBusy}
        cloudMessage={cloudMessage}
        cloudError={cloudError}
        onDeleteCloud={scope => void deleteCloudData(scope)}
        onPersonalizationChange={updatePersonalization}
        onExport={exportLocalData}
        onDeleteJourney={() => { setJourney(null); setToast("Current journey deleted"); }}
        onClearSignals={() => { setFeedback({}); setOpenedIds([]); setToast("Feedback and activity cleared"); }}
        onDeleteSaved={() => { updateSavedDoors(() => []); }}
        onClearAll={() => { clearLocalData(); setToast("Open Door data cleared from this browser"); }}
      />}
    </main>
    <footer className="site-footer">
      <div className="footer-note">A FIELD GUIDE, NOT A CHECKLIST · OPEN DOOR · {journey?.mode === "live" ? "LIVE QLOO RESPONSE RECEIVED" : "DEMO PATHS ARE AUTHORED EXAMPLES"}</div>
      <nav className="footer-nav" aria-label="Footer navigation">
        <a href="/">Discover</a>
        <a href="/lab">Discovery Lab</a>
        <a href="/trust">Trust &amp; privacy</a>
        <a href="/judges" aria-current={view === "judges" ? "page" : undefined}>Judge’s Guide</a>
      </nav>
    </footer>
    {toast && <div role="status" className="toast">{toast}</div>}
  </div>;
}

type DiscoverProps = {
  threadExploration: ThreadExploration | null; onReturnFromThread: () => void;
  onLab: (door?: Door) => void;
  city: string; setCity: (value: string) => void; occasion: string; setOccasion: (value: string) => void;
  intent: Intent; setIntent: (value: Intent) => void; depth: Depth; setDepth: (value: Depth) => void;
  context: Context; setContext: (value: Context) => void; anchors: string[]; categories: Record<string, Category>;
  setCategory: (value: { anchor: string; value: Category }) => void; categoryDraft: Category;
  setCategoryDraft: (value: Category) => void; anchorDraft: string; setAnchorDraft: (value: string) => void;
  addAnchor: (value: string, category?: Category) => void; removeAnchor: (value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void; journey: Journey | null; savedIds: Set<string>;
  toggleSave: (door: Door, location: string, anchors: string[]) => void; feedback: Record<string, string>;
  setFeedback: (id: string, reason: string) => void; reset: () => void; resetCompass: (intent: Intent) => void;
  openNext: (door: Door) => void; onDoorOpened: (door: Door) => void; setView: (view: View) => void; nodes: { id: string; label: string; kind: string; category: Category; detail: string; result: string }[];
  selectedNode: string; setSelectedNode: (value: string) => void; onShare: () => void; onDownloadStory: () => void; storyCopied: boolean;
  openedCount: number; openedIds: string[]; openedCategories: Set<string>; openedTiers: Record<string, number>; groupMode: boolean; setGroupMode: (value: boolean) => void;
  savedCount: number;
  participants: Participant[]; updateParticipant: (index: number, field: keyof Participant, value: string) => void;
  addParticipant: () => void; removeParticipant: (index: number) => void; groupBuilt: boolean; buildGroup: () => void;
  oneHour: boolean; setOneHour: (value: boolean) => void; onStartDemo: (behavior?: ScrollBehavior, preserveScenario?: boolean) => void;
  onBuildDay: (input: DayPlanInput) => void;
  accountUserId: string | null; signedIn: boolean; onPreferenceRevisionChanged: () => void;
  judgeDemo: boolean;
  entryPhase: "closed" | "opening" | "welcoming" | "entered"; onOpenEntry: (runPreparedDemo?: boolean) => void;
  onEntryAnimationComplete: () => void;
  onSound: (effect: SoundEffect) => void;
  exploreCategory: (category: Category) => void;
  journeyMode: "demo" | "live"; setJourneyMode: (value: "demo" | "live") => void; agentStatus: AgentStatus | null; statusError: string;
  liveStages: Extract<AgentEvent, { type: "stage" }>[]; liveError: string; isRunning: boolean; showInspector: boolean;
  setShowInspector: (value: boolean) => void;
};

function DoorwayFrame() {
  return <div className="entry-frame">
    <div className="entry-leaf"><i></i><span>OD</span></div>
    <div className="entry-threshold"></div>
  </div>;
}

function DoorwayAnimationArt({ autoPlay = false, className = "", onComplete }: { autoPlay?: boolean; className?: string; onComplete?: () => void }) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [playing, setPlaying] = useState(autoPlay && !reducedMotion);
  const [run, setRun] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setPlaying(false);
      onCompleteRef.current?.();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [playing, run]);
  function togglePlayback() {
    if (playing) setPlaying(false);
    else {
      setRun(value => value + 1);
      setPlaying(true);
    }
  }
  return <div className={`doorway-animation-art ${className}`} data-testid="doorway-animation">
    <img
      key={run}
      data-testid="doorway-animation-image"
      src={playing ? `/mascot/welcome-opening.webp?play=${run}` : "/mascot/welcome-opening-still.webp"}
      alt="The Open Door mascot welcomes you from a red arched doorway."
      width="480"
      height="270"
      decoding="async"
    />
    <button
      className="mascot-motion-toggle"
      type="button"
      aria-pressed={playing}
      aria-label={`${playing ? "Pause" : "Play"} welcome illustration`}
      onClick={togglePlayback}
    >
      {playing ? "Pause illustration" : "Play illustration"}
    </button>
  </div>;
}

function DiscoverView(p: DiscoverProps) {
  const [activeDoorId, setActiveDoorId] = useState<string | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const openTriggerRef = useRef<HTMLButtonElement | null>(null);
  const openedVisitsRef = useRef(new Set(p.openedIds));
  const [preferenceFormEdited, setPreferenceFormEdited] = useState(false);
  const previousPreferenceOwner = useRef(p.accountUserId);
  const thread = p.threadExploration && p.journey && (
    p.threadExploration.status === "ready"
      ? p.threadExploration.targetIds.join("|") === p.journey.doors.map(door => door.id).join("|")
      : p.threadExploration.previous === p.journey
  ) ? p.threadExploration : null;
  useEffect(() => {
    if (thread?.status === "ready" && thread.targetIds[0]) {
      openTriggerRef.current = null;
      setActiveDoorId(thread.targetIds[0]);
    } else if (thread && thread.status !== "ready") {
      requestAnimationFrame(() => {
        const notice = document.getElementById("thread-continuation");
        notice?.focus({ preventScroll: true });
        notice?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      });
    }
  }, [thread]);
  useEffect(() => {
    if (previousPreferenceOwner.current === p.accountUserId) return;
    previousPreferenceOwner.current = p.accountUserId;
    setPreferenceFormEdited(false);
    p.setIntent("Try something new");
    p.setDepth("A little further");
    p.setContext({ ...p.context, budget: "Flexible", movement: "Mostly seated" });
  }, [p.accountUserId]);
  useEffect(() => {
    if (activeDoorId) resultHeadingRef.current?.focus();
  }, [activeDoorId]);
  function openDoor(door: Door) {
    const visit = `${door.id}|${door.category}|${door.tier}`;
    if (!openedVisitsRef.current.has(visit)) {
      openedVisitsRef.current.add(visit);
      p.onDoorOpened(door);
    }
    p.onSound("door-open");
    openTriggerRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    setActiveDoorId(door.id);
  }
  function closeDoor() {
    p.onSound("door-close");
    setActiveDoorId(null);
    requestAnimationFrame(() => openTriggerRef.current?.focus());
  }
  const selectedNode = p.nodes.find(node => node.id === p.selectedNode) || p.nodes[0];
  const liveJourney = p.journey?.mode === "live" ? p.journey : null;
  const qlooCoordinateNodes = liveJourney?.graph?.nodes.filter(node => node.provenance === "QLOO" && node.coordinates && Number.isFinite(node.coordinates.latitude) && Number.isFinite(node.coordinates.longitude)) || [];
  const latitudes = qlooCoordinateNodes.map(node => node.coordinates!.latitude);
  const longitudes = qlooCoordinateNodes.map(node => node.coordinates!.longitude);
  const latMin = Math.min(...latitudes), latMax = Math.max(...latitudes), lonMin = Math.min(...longitudes), lonMax = Math.max(...longitudes);
  const wildcardDoor = p.journey?.doors.find(door => door.tier === "Unexpected") || p.journey?.doors[p.journey.doors.length - 1];
  const groupTokens = p.participants.map(person => person.anchors.split(",").map(token => token.trim()).filter(Boolean));
  const overlap = groupTokens.length ? groupTokens[0].filter(token => groupTokens.every(tokens => tokens.some(value => value.toLowerCase() === token.toLowerCase()))) : [];
  const allGroupAnchors = [...new Set(groupTokens.flat())];
  const storyDoors = p.journey?.doors || [];
  const setContextValue = (key: keyof Context, value: string) => p.setContext({ ...p.context, [key]: value });
  return <>
    {p.entryPhase !== "entered" && <section className={`entry-scene ${p.entryPhase === "opening" ? "is-opening" : ""}`} data-entry-phase={p.entryPhase} aria-label="Open Door introduction">
      <div className="entry-copy"><span className="eyebrow">Open Door · a cultural field guide</span><p className="entry-index">FIELD NOTE 001 <span>—</span> ARRIVAL</p><h1>What’s behind<br /><em>your next door?</em></h1><p className="entry-deck">Start with the films, music, food, or books you love. Open three cultural directions—and choose where to go next.</p>
        <button className="entry-action" type="button" data-sound="door-open" onClick={() => p.onOpenEntry()} disabled={p.entryPhase !== "closed"}><span>{p.entryPhase !== "closed" ? "The room is opening" : "Open the door"}</span><ArrowRight size={17} /></button>
        <button className="entry-demo-link" type="button" data-sound="door-open" onClick={() => p.onOpenEntry(true)} disabled={p.entryPhase !== "closed"}>Open the prepared sample door</button>
        <p className="entry-caveat">{p.agentStatus?.qlooConfigured ? "Qloo configured · only successful responses are labeled Live" : p.agentStatus ? "Illustrative demo paths · Qloo is not configured" : p.statusError ? "Qloo status unavailable · demo paths remain available" : "Checking Qloo configuration…"}</p>
      </div>
      <div className="entry-architecture" data-testid="entry-art">
        {p.entryPhase === "welcoming" ? <DoorwayAnimationArt autoPlay onComplete={p.onEntryAnimationComplete} className="entry-animation-art" /> : <>
          <div className="entry-halo" aria-hidden="true"></div>
          <div className="entry-wall">
            <button className="entry-door-trigger" type="button" data-sound="door-open" aria-label="Open the illustrated door" onClick={() => p.onOpenEntry()} disabled={p.entryPhase !== "closed"}>
              <DoorwayFrame />
            </button>
          </div>
          <div className="entry-companion"><MascotArt scene="map" priority /><span>Come along.</span></div>
          <span className="entry-coordinate" aria-hidden="true">A CULTURAL FIELD GUIDE</span>
          <span className="entry-caption" aria-hidden="true">A threshold, not a destination.</span>
        </>}
      </div>
    </section>}
    {p.entryPhase === "entered" && <>
    <section className="mode-panel" aria-label="Journey data mode">
      <div><span className="eyebrow">How would you like to explore?</span><h2>Try the demo, or make it personal.</h2><p>Demo lets you try example activities. Choose Live for recommendations from Qloo based on your interests.</p></div>
      <div className="mode-switch" role="group" aria-label="Choose Demo or Live">
        <button type="button" className={p.journeyMode === "demo" ? "selected" : ""} aria-pressed={p.journeyMode === "demo"} onClick={() => p.setJourneyMode("demo")}>Demo</button>
        <button type="button" className={p.journeyMode === "live" ? "selected" : ""} aria-pressed={p.journeyMode === "live"} onClick={() => p.setJourneyMode("live")}>Live</button>
      </div>
      <div className={`configuration-status ${p.agentStatus?.qlooConfigured ? "configured" : ""}`} role="status">
        <span className="status-mark" />{p.agentStatus ? (p.agentStatus.qlooConfigured ? "Live recommendations are available" : "Live recommendations aren’t available right now. You can still try Demo.") : p.statusError ? "Couldn’t check Live availability" : "Checking Live availability…"}
      </div>
    </section>
    <section className="hero">
      <div className="hero-copy"><span className="eyebrow">Arrive curious. Leave with a thread.</span>
        <h1>Find your way<br />into <em>somewhere.</em></h1>
        <p>Tell us about the music, films, food, or art you love. Find something to enjoy next, with a simple way to get started.</p>
          <button className="primary-btn demo-start" type="button" onClick={() => p.onStartDemo("smooth", true)}>{p.journeyMode === "live" ? "Run the prepared live journey" : "Open the sample journey"} <ArrowRight size={15} /></button>
      </div>
      <div className="hero-art mascot-welcome">
        <DoorwayAnimationArt className="hero-welcome-art" />
      </div>
    </section>
    {p.journeyMode === "demo" && <div className="demo-note"><Info size={16} /><div><strong>Demo mode.</strong> Every sample path is authored deterministic content; it did not come from Qloo and is not a real venue listing, event, availability check, or local fact. <button className="text-button" onClick={() => p.setView("how")}>Evidence &amp; method</button></div></div>}
    {p.journeyMode === "live" && <div className="demo-note live-note"><Info size={16} /><div><strong>Live is a request, not a setting.</strong> A configured server is necessary but not sufficient. The interface will only say Live Qloo after a successful real response. {p.agentStatus?.qlooConfigured ? "Your next exploration will make a server request." : "Live requests are unavailable until Qloo is configured."}</div></div>}
    {p.liveError && <div className="live-error" role="alert"><strong>The live door is temporarily closed.</strong><span>{p.liveError}</span><button className="secondary-btn" type="button" disabled={p.isRunning} onClick={() => p.onStartDemo()}>Continue with Demo Mode <ArrowRight size={14} /></button></div>}
    {p.isRunning && p.liveStages.length === 0 && <div className="stage-wait" role="status" aria-live="polite"><span>Waiting for the first server event</span><i /><i /><small>No estimated stages or fabricated progress are shown.</small></div>}
    <form className="form-panel" onSubmit={p.submit}>
      <div className="form-heading"><div><span className="eyebrow">Begin with your own coordinates</span><h2>What brings you here?</h2></div><span className="step-label">01 — YOUR STARTING POINT</span></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="city">Place you’re exploring</label><input id="city" value={p.city} onChange={event => p.setCity(event.target.value)} placeholder="City, neighborhood, or region" required /></div>
        <div className="field"><label htmlFor="occasion">Time and occasion</label><select id="occasion" value={p.occasion} onChange={event => { p.setOccasion(event.target.value); setContextValue("time", event.target.value); }}><option>A free Saturday</option><option>A quiet weeknight</option><option>My first week here</option><option>A solo afternoon</option><option>A day with a friend</option><option>Just passing through</option><option>Something else, soon</option></select></div>
        <div className="field full"><span className="label-text">What are you hoping to find?</span><div className="intent-options">{INTENTS.map(choice => <label key={choice} className={`intent-option ${p.intent === choice ? "selected" : ""}`}><input type="radio" name="intent" checked={p.intent === choice} onChange={() => { setPreferenceFormEdited(true); p.setIntent(choice); }} />{choice}</label>)}</div></div>
         <div className="field full exploration-control"><span className="label-text">How far do you want to go?</span><p>{p.journeyMode === "live" ? "The selection changes the documented Qloo result types Open Door requests; this route label is not a Qloo score." : "The selection changes the kind of cultural bridge the deterministic sample path explores—not a score."}</p>
          <div className="depth-options" role="radiogroup" aria-label="Exploration depth">{DEPTHS.map(item => <label key={item.value} className={`depth-option ${p.depth === item.value ? "selected" : ""}`}><input className="visually-hidden" type="radio" name="depth" checked={p.depth === item.value} onChange={() => { setPreferenceFormEdited(true); p.setDepth(item.value); }} /><strong>{item.value}</strong><span>{item.note}</span></label>)}</div>
        </div>
        <div className="field full"><span className="label-text">Your explicit context</span><div className="context-grid">
          <div className="field"><label htmlFor="budget">Budget</label><select id="budget" value={p.context.budget} onChange={event => { setPreferenceFormEdited(true); setContextValue("budget", event.target.value); }}><option>Flexible</option><option>Free or low-cost</option><option>Moderate</option><option>Open to a splurge</option></select></div>
          <div className="field"><label htmlFor="movement">Movement preference</label><select id="movement" value={p.context.movement} onChange={event => { setPreferenceFormEdited(true); setContextValue("movement", event.target.value); }}><option>Mostly seated</option><option>Easy walking</option><option>Active and moving</option><option>Transit is fine</option></select></div>
          <div className="field"><label htmlFor="conditions">Conditions / energy</label><select id="conditions" value={p.context.conditions} onChange={event => setContextValue("conditions", event.target.value)}><option>Open to anything</option><option>Rainy day</option><option>Low energy</option><option>High energy</option><option>Quiet setting</option><option>Social setting</option><option>Early morning</option><option>Late evening</option></select></div>
          <div className="field"><label htmlFor="mode">Journey mode</label><select id="mode" value={p.groupMode ? "group" : "solo"} onChange={event => p.setGroupMode(event.target.value === "group")}><option value="solo">Solo journey</option><option value="group">Small group / couples</option></select></div>
        </div></div>
         <div className="field full personal-considerations">
           <details open>
             <summary>Personal considerations <span>Optional · explicit preferences only</span><ChevronDown size={15} /></summary>
             <p className="personal-considerations-intro">Personal style, age-related needs, health and wellbeing, or any other situation: choose an example below, then make it your own. Open Door uses what you tell it, not assumptions about age, health, or identity.</p>
             <ScenarioFields
               value={p.context}
               onChange={patch => p.setContext({ ...p.context, ...patch })}
               label="Personal considerations"
               helpId="discover-scenario-help"
               helperText="Optional text stays in this browser and local journey/Lab data/exports; it is not sent to Qloo or your account. Suggestions use explicit preferences only, are not medical advice or verified suitability, and do not check venue facts. Avoid identifying or sensitive details."
             />
           </details>
         </div>
        <div className="field full"><label htmlFor="anchor-input">Cultural anchors — things you already love</label>
          <div className="anchor-input-row"><input id="anchor-input" value={p.anchorDraft} onChange={event => p.setAnchorDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); p.addAnchor(p.anchorDraft); } }} placeholder="A sound, meal, film, ritual, place…" aria-describedby="anchor-hint" />
            <select className="category-select" aria-label="Category for new anchor" value={p.categoryDraft} onChange={event => p.setCategoryDraft(event.target.value as Category)}>{CATEGORIES.map(item => <option key={item}>{item}</option>)}</select>
            <button type="button" className="text-button" onClick={() => p.addAnchor(p.anchorDraft)}><Plus size={14} /> Add</button></div>
          <div className="anchor-pills">{p.anchors.map(anchor => <span className="anchor-pill" key={anchor}>{anchor}<button type="button" onClick={() => p.removeAnchor(anchor)} aria-label={`Remove ${anchor}`}><X size={13} /></button></span>)}</div>
          <div id="anchor-hint" className="example-line">{p.anchors.length ? `${p.anchors.length} of 5 interests added. You can change their categories below.` : <>Need a starting point? <button type="button" onClick={() => EXAMPLES.forEach((anchor, index) => p.addAnchor(anchor, (["Film", "Food", "Music"] as Category[])[index]))}>Try three example interests</button></>}</div>
        </div>
         <div className="submit-row"><span className="helper">{p.journeyMode === "demo" ? "Your words shape an illustrative sample. With no anchors, three clearly identified demo examples are used." : "Your stated interests and context are sent to the Open Door server, which calls Qloo. No browser-side Qloo request is made."}</span><button className="primary-btn" type="submit" disabled={p.isRunning || (p.journeyMode === "live" && !p.agentStatus?.qlooConfigured)}>{p.isRunning ? "Waiting for the real response…" : p.journeyMode === "live" ? "Explore with Qloo" : "Find my doors"} <ArrowRight size={16} /></button></div>
      </div>
    </form>
    <PreferencesMemory
      key={p.accountUserId || "guest"}
      userId={p.accountUserId}
      signedIn={p.signedIn}
      values={{ intent: p.intent, depth: p.depth, budget: p.context.budget as PreferenceValues["budget"], movement: p.context.movement as PreferenceValues["movement"] }}
      hasJourney={!!p.journey}
      demoActive={p.judgeDemo}
      hasFormEdits={preferenceFormEdited}
      onApply={values => {
        p.setIntent(values.intent);
        p.setDepth(values.depth);
        p.setContext({ ...p.context, budget: values.budget, movement: values.movement });
      }}
      onRevisionChanged={p.onPreferenceRevisionChanged}
    />

    {p.groupMode && <section className="group-panel" aria-labelledby="group-title">
        <div className="module-heading"><div><span className="eyebrow">Open Door together · prepared group demo</span><h3 id="group-title">A shared path, without averaging people.</h3></div><div className="group-route-mark" aria-hidden="true"><span>YOU</span><MiniDoor /><ArrowRight size={17} /><MiniDoor /><span>SHARED PATH</span></div><p>Three fictional participants, with editable explicit interests. This group sketch is a demo and does not claim Qloo-matched group affinity.</p></div>
      <div className="group-form">{p.participants.map((person, index) => <div className="participant" key={index}><h4>{person.name || `Person ${index + 1}`}</h4>
        <label className="visually-hidden" htmlFor={`person-name-${index}`}>Participant {index + 1} name</label><input id={`person-name-${index}`} value={person.name} onChange={event => p.updateParticipant(index, "name", event.target.value)} aria-label={`Participant ${index + 1} name`} />
        <label className="visually-hidden" htmlFor={`person-anchors-${index}`}>Participant {index + 1} anchors, comma separated</label><input id={`person-anchors-${index}`} value={person.anchors} onChange={event => p.updateParticipant(index, "anchors", event.target.value)} placeholder="Anchors, separated by commas" aria-label={`Participant ${index + 1} anchors, comma separated`} />
        <small>Only the anchors typed here contribute to this illustrative group sketch.</small>
        {p.participants.length > 2 && <button className="text-button" type="button" onClick={() => p.removeParticipant(index)}>Remove participant</button>}</div>)}</div>
      <div className="story-actions"><button className="secondary-btn" type="button" onClick={p.addParticipant} disabled={p.participants.length >= 5}><Plus size={14} /> Add participant ({p.participants.length}/5)</button><button className="primary-btn" type="button" onClick={p.buildGroup} disabled={p.participants.some(person => !person.anchors.trim())}>Find a shared bridge <ArrowRight size={14} /></button></div>
      {p.groupBuilt && <div className="group-results" aria-live="polite">
        <div className="group-result"><span>Common ground</span><h4>{overlap.length ? overlap.join(", ") : "A shared attention practice"}</h4><p>{overlap.length ? "An exact anchor appears in every participant’s entered list." : "No anchor is shared verbatim. The demo uses a broad practice bridge without claiming overlap."}</p></div>
        <div className="group-result"><span>A bridge</span><h4>Make something side by side</h4><p>{allGroupAnchors.slice(0, 3).join(" + ") || "Entered interests"} → shared attention and exchange → a hands-on group activity. A conceptual demo connection only.</p></div>
        <div className="group-result"><span>Individual doors</span><h4>One thread each</h4><p>{p.participants.map((person, index) => `${person.name || `Person ${index + 1}`}: ${person.anchors.split(",").map(value => value.trim()).filter(Boolean)[0] || "no anchor entered"} → ${["a listening ritual", "a foodways reading", "an open studio", "a shared walk", "a small performance"][index]}`).join(" · ")}. Fictional illustrative prompts, not venue listings.</p></div>
        <div className="group-result"><span>Shared door</span><h4>A listening-and-making table</h4><p>{allGroupAnchors.slice(0, 3).join(" + ") || "Entered interests"} → take turns noticing and making together. A prepared demo bridge only.</p></div>
        <div className="group-result"><span>Wildcard</span><h4>A neighborhood sound postcard</h4><p>Combine one sound, one remembered meal, and a short written note. An unexpected group prompt—not a real place or retrieved recommendation.</p></div>
      </div>}
    </section>}

      {p.liveStages.length > 0 && p.journeyMode === "live" && <section className="stream-stages" aria-live="polite" aria-label="Actual live orchestration stages"><div className="module-heading"><div><span className="eyebrow">Live request trace</span><h3>What the server actually did.</h3></div><p>Only stage events received from the real orchestration stream appear here; no estimated progress is shown.</p></div>
        <ol>{p.liveStages.map((stage, index) => <li key={`${stage.id}-${index}`} className={`stage-${stage.status}`}><span className="stage-number">{String(index + 1).padStart(2, "0")}</span><div><b>{stage.label}</b><p>{stage.detail}</p><small>{stage.provenance} · {stage.status}</small></div></li>)}</ol>
      </section>}
      {p.journey && <section className="journey-result" id="journey-result" aria-live="polite">
      <div className="result-top"><div><div className={`journey-badge ${p.journey.mode === "live" ? "live-badge" : ""}`}><Compass size={12} /> {p.journey.mode === "live" ? "Live Qloo" : "Demo"}</div><span className="eyebrow" style={{ display: "block", marginTop: 12 }}>{p.journey.occasion} · {p.journey.depth}</span><h2>{p.journey.doors.length ? `${p.journey.doors.length} ideas for you` : "Ready for a different interest?"}</h2><div className="journey-city"><MapPin size={13} /> {p.journey.city} <span>·</span> {p.journey.intent}</div></div>
         <div className="journey-tools"><button className="secondary-btn" type="button" onClick={() => p.onLab()}>Explore in Discovery Lab <ArrowRight size={14} /></button><button className="secondary-btn" type="button" onClick={() => p.setShowInspector(!p.showInspector)} aria-expanded={p.showInspector}><Info size={14} /> {p.showInspector ? "Close evidence" : "Under the Door"}</button><button className="secondary-btn" type="button" onClick={p.reset}><RotateCcw size={14} /> Reset the Compass</button></div></div>
      {p.journey.notices?.map((notice, index) => <div className="demo-note live-note" role="status" key={`${notice}-${index}`}>{notice}</div>)}
      {!!p.journey.feedbackApplied?.length && <div className="feedback-applied" role="status"><strong>Your feedback changed {p.journey.mode === "live" ? "the search" : "the sample route"}.</strong><span>{p.journey.feedbackApplied.join(" · ")}. {p.journey.mode === "live" ? "The orchestrator adjusted the Qloo result types; price and opening hours remain unverified." : "This is deterministic Demo adaptation, not a Qloo response."}</span></div>}
      {thread && <section className="thread-continuation" id="thread-continuation" tabIndex={-1} aria-label="Thread exploration" aria-busy={thread.status === "loading"}>
        <span className="eyebrow">After: {thread.from}</span>
        <h3>{thread.status === "loading" ? "Finding more ideas…" : thread.status === "error" ? "We couldn’t find more ideas just now." : "Here are a few more things to try."}</h3>
        <p role={thread.status === "error" ? "alert" : "status"}>
          {thread.status === "loading" ? `Finding new Qloo connections from “${thread.from}”. Your current results stay here while we look.`
            : thread.status === "error" ? thread.error
            : thread.targetIds.length ? `${thread.targetIds.length} more ideas. The first is open below. Pick one you like, or go back to your previous choices.`
            : p.journey.mode === "live" ? "Qloo didn’t find any more recommendations for this choice. Go back and try another idea."
            : "You’ve reached the end of these example ideas. Go back to revisit a favorite, or change your interests to start again."}
        </p>
        {thread.status === "error" && <button type="button" className="primary-btn" disabled={p.isRunning} onClick={() => p.openNext(thread.selected)}>Retry this thread</button>}
        {thread.status === "ready" && <button type="button" className="secondary-btn" disabled={p.isRunning} onClick={p.onReturnFromThread}>Back to previous recommendations</button>}
      </section>}
      <p className="result-truth-note" role="note">
        {p.journey.mode === "live"
          ? "Recommendations from Qloo. Check opening hours, prices, and access before visiting a place."
          : "You’re trying the demo: these are example activities, not live Qloo recommendations or booked events."}
      </p>
       <RecommendationTools recommendations={p.journey.doors} city={p.journey.city} mode={p.journey.mode || "demo"} />
        <aside className="result-guide" aria-label="A note from your field guide">
          <MascotArt scene="curiosity" />
          <p><strong>See something you like?</strong><span>Open a door to see why you might enjoy it and how to get started.</span></p>
        </aside>
       <div className="doors-grid" aria-label="Your recommendations">{p.journey.doors.map(door => <DoorCard key={door.id} door={door} city={p.journey!.city} anchors={p.journey!.anchors} mode={p.journey!.mode || "demo"}
         saved={p.savedIds.has(door.id)} toggleSave={p.toggleSave} onOpenDoor={openDoor} onCloseDoor={closeDoor}
         expanded={activeDoorId === door.id} resultHeadingRef={activeDoorId === door.id ? resultHeadingRef : undefined}
         scenarioCategory={p.journey!.context.scenarioCategory} scenario={p.journey!.context.scenario}
         exploring={p.isRunning}
         onExploreDeeper={p.openNext} onLab={p.onLab} feedback={p.feedback[door.id]} setFeedback={p.setFeedback} />)}</div>
      <DayPlanner key={p.journey.doors.map(door => door.id).join("|")} recommendations={p.journey.doors} city={p.journey.city} mode={p.journey.mode || "demo"}
        startTime={p.context.startTime || "10:00"} endTime={p.context.endTime || "17:00"}
        location={p.city} budget={p.context.budget} novelty="Balanced"
        onRefresh={p.onBuildDay}
        refreshDisabled={p.isRunning || (p.journeyMode === "live" && !p.agentStatus?.qlooConfigured)}
        refreshing={p.isRunning} oneHour={p.oneHour} setOneHour={p.setOneHour} />
      <div className="dna-strip"><div className="dna-title"><span>Your Discovery DNA</span><p>Changes as you explore</p></div><div className="dna-items">{p.journey.anchors.map((anchor, i) => <span className="dna-chip" key={anchor}><b>0{i + 1}</b> {anchor} · {p.journey?.categories[anchor] || inferredCategory(anchor)}</span>)}</div></div>
      <div className="dna-edit" aria-label="Edit Discovery DNA categories"><label>Edit explicit categories</label>{p.journey.anchors.map(anchor => <label key={anchor}>{anchor}<select className="dna-category" aria-label={`Category for ${anchor}`} value={p.journey?.categories[anchor] || inferredCategory(anchor)} onChange={event => p.setCategory({ anchor, value: event.target.value as Category })}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>)}</div>

      {p.journey.mode === "live" ? <section className="constellation live-graph" aria-labelledby="constellation-title">
        <div className="module-heading"><div><span className="eyebrow">Retrieved cultural graph · provenance separated</span><h3 id="constellation-title">Only returned nodes and edges.</h3></div><p>Qloo edges describe returned Search or Insights evidence. USER edges identify an explicit choice to continue from a Qloo entity; both sources are labeled.</p></div>
        <div className="graph-columns">
          <div><span className="legend-pill">USER INPUT</span><div className="constellation-nodes">{(p.journey.graph?.nodes || []).filter(node => node.provenance === "USER").map(node => <button key={node.id} className="constellation-node" onClick={() => p.setSelectedNode(node.id)} aria-pressed={selectedNode?.id === node.id}>{node.label}</button>)}</div></div>
          <div><span className="legend-pill qloo-legend">QLOO RETURN</span><div className="constellation-nodes">{(p.journey.graph?.nodes || []).filter(node => node.provenance === "QLOO").map(node => <button key={node.id} className="constellation-node experience" onClick={() => p.setSelectedNode(node.id)} aria-pressed={selectedNode?.id === node.id}>{node.label}</button>)}</div></div>
        </div>
        {selectedNode && <div className="constellation-detail"><div><strong>{selectedNode.kind} · {selectedNode.category}</strong>{selectedNode.label}</div><div><strong>Returned node detail</strong>{selectedNode.detail}</div></div>}
        <div className="edge-evidence"><h4>Returned graph edges · {p.journey.graph?.edges.length || 0}</h4>{p.journey.graph?.edges.length ? p.journey.graph.edges.map(edge => <div className="edge-row" key={edge.id}><span>{p.journey?.graph?.nodes.find(node => node.id === edge.from)?.label || edge.from}</span><ArrowRight size={13} /><span>{edge.type}</span><ArrowRight size={13} /><span>{p.journey?.graph?.nodes.find(node => node.id === edge.to)?.label || edge.to}</span><small>{edge.provenance} · {edge.evidence}</small></div>) : <p>No Qloo graph edges were returned for this journey.</p>}</div>
        <div className="coordinate-panel"><div className="module-heading"><div><span className="eyebrow">Returned coordinates only</span><h3>Coordinate field</h3></div><p>No map provider is used. Plot positions are scaled only from the actual coordinates returned in Qloo graph data.</p></div>
          {qlooCoordinateNodes.length ? <><div className="coordinate-canvas" role="img" aria-label="Schematic plot of Qloo-returned coordinates">{qlooCoordinateNodes.map(node => {
            const x = lonMax === lonMin ? 50 : 8 + ((node.coordinates!.longitude - lonMin) / (lonMax - lonMin)) * 84;
            const y = latMax === latMin ? 50 : 8 + ((latMax - node.coordinates!.latitude) / (latMax - latMin)) * 84;
            return <span key={node.id} className="coordinate-dot" style={{ left: `${x}%`, top: `${y}%` }} title={`${node.label}: ${node.coordinates!.latitude}, ${node.coordinates!.longitude}`} />;
          })}</div><ul className="coordinate-list">{qlooCoordinateNodes.map(node => <li key={node.id}><b>{node.label}</b><span>{node.coordinates!.latitude}, {node.coordinates!.longitude}</span></li>)}</ul></> : <div className="coordinate-empty">No coordinates were returned by Qloo. Nothing is plotted.</div>}
        </div>
      </section> : <section className="constellation" aria-labelledby="constellation-title">
        <div className="module-heading"><div><span className="eyebrow">Demo constellation · authored sample relationships</span><h3 id="constellation-title">A compact map of the path.</h3></div><p>Sample connections are editorial examples, not retrieved entities or Qloo relationships.</p></div>
        <div className="constellation-legend" aria-label="Constellation legend"><span className="legend-pill">User input</span><span className="legend-pill">Sample connection</span><span className="legend-pill">Demo experience</span></div>
        <div className="constellation-nodes" role="group" aria-label="Selectable sample constellation nodes">{p.nodes.map(node => <button type="button" key={node.id} className={`constellation-node ${node.kind === "SAMPLE CONNECTION" ? "connection" : node.kind === "DEMO EXPERIENCE" ? "experience" : ""}`} aria-pressed={selectedNode?.id === node.id} onClick={() => p.setSelectedNode(node.id)}>{node.label}</button>)}</div>
        {selectedNode && <div className="constellation-detail" aria-live="polite"><div><strong>{selectedNode.kind} · {selectedNode.category}</strong>{selectedNode.label}</div><div><strong>Sample connection</strong>{selectedNode.detail} Result in this sample: {selectedNode.result}. No Qloo or external data is used.</div></div>}
      </section>}
      <div className="comparison" aria-label="Conceptual comparison of search and Open Door">
        <article><h4>Conventional search · conceptual example</h4><p>“Show me {p.journey.anchors[0]}.”</p><small>A useful way to find the thing already named. This is a curated comparison, not a result from a search engine.</small></article>
         <article><h4>Open Door · {p.journey.mode === "live" ? "retrieved path" : "sample path"}</h4><p>“What cultural thread might {p.journey.anchors[0] || "an interest"} open next?”</p><small>{p.journey.mode === "live" ? "Qloo returned the entity and evidence; Open Door assigned the route label. This is not a confidence or affinity score." : "Starts from an anchor and makes an authored bridge visible. This is sample data, not Qloo output."}</small></article>
      </div>
       {wildcardDoor && <div className="bridge-callout"><span className="eyebrow">{p.journey.mode === "live" ? "Returned connection evidence" : "Surprise with purpose · illustrative bridge"}</span><h3>{p.journey.mode === "live" ? "What connects this result to your starting point." : "A detour should show its connecting thread."}</h3><div className="bridge-chain"><span>{p.journey.anchors[0]}</span><ArrowRight size={14} aria-hidden="true" /><span>{wildcardDoor.thread}</span><ArrowRight size={14} aria-hidden="true" /><span>{wildcardDoor.title}</span></div><p>{wildcardDoor.evidence}</p></div>}
      <div className="story-card"><MiniDoor className="story-door-mark" /><span className="eyebrow">A story with selected details</span><h3>Your Open Door Story</h3>
         <p>You started with <strong>{p.journey.anchors.join(", ")}</strong>.</p><p>This {p.journey.mode === "live" ? "Qloo-backed response" : "demo path"} moved through <strong>{storyDoors.map(door => door.title).join(" → ") || "no returned candidates"}</strong>.</p>
         <p>The story includes the anchors and discoveries shown here—not your city or budget. Review it before sharing: the interests you enter may still be personal. {p.journey.mode === "demo" && "Sample paths are illustrative, not Qloo data."}</p>
        <div className="story-actions"><button className="secondary-btn" type="button" onClick={p.onShare}><Share2 size={14} /> {p.storyCopied ? "Copy story again" : "Share / copy story"}</button><button className="secondary-btn" type="button" onClick={p.onDownloadStory}>Download story card <ArrowDownRight size={14} /></button><span className="helper">Share sheet where supported; otherwise copies a text-only story.</span></div>
      </div>
        <section className="helpful-insights">
          <div className="helpful-art"><MascotArt scene="map" /></div>
          <div className="helpful-content">
            <span className="eyebrow"><span aria-hidden="true">✨</span> Helpful tips</span>
            <h3>Keep the plan kind to your energy.</h3>
            <ul><li>Start with one practical step from a result; there is no need to book or travel.</li><li>Leave a little unscheduled space between ideas for rest or a change of mind.</li><li>For an in-person visit, check the venue, hours, price, and access details directly.</li></ul>
          </div>
          <div className="insight-content">
            <span className="eyebrow"><span aria-hidden="true">✨</span> Amazing insights</span>
            {(() => {
              const counts = p.journey!.doors.reduce<Record<string, number>>((result, door) => {
                result[door.category] = (result[door.category] || 0) + 1;
                return result;
              }, {});
              const categories = Object.entries(counts).sort((a, b) => b[1] - a[1]);
              return <><h3>{categories.length ? `Your returned set touches ${categories.length} ${categories.length === 1 ? "category" : "categories"}.` : "Your returned set is ready to explore."}</h3>
                <p>{categories.length ? `${categories.map(([category, count]) => `${category} (${count})`).join(" · ")}. This is a count of the recommendations shown here, not a claim about cultural affinity or Qloo's reasoning.` : "No recommendation categories were returned for this journey."}</p></>;
            })()}
          </div>
        </section>
        <Passport openedCount={p.openedCount} categories={p.openedCategories} tiers={p.openedTiers} savedCount={p.savedCount} />
      <section className="unopened-panel"><div className="module-heading"><div><span className="eyebrow">Doors left unopened</span><h3>Choose another cultural direction.</h3></div><p>{p.journey.mode === "live" ? "Each choice starts a new Qloo Search and Insights run in the selected category." : "Each choice becomes an explicit starting anchor for a new deterministic sample path."}</p></div>
        <div className="unopened-doors">{(["Art", "Books", "Design", "Food", "Music", "Outdoors"] as Category[]).map(category => <button className="unopened-door" type="button" key={category} onClick={() => p.exploreCategory(category)}><MiniDoor /><span>{category}</span><ArrowRight size={14} /></button>)}</div>
      </section>
      <section className="group-panel" style={{ marginTop: 28 }}><div className="module-heading"><div><span className="eyebrow">Reset the compass</span><h3>Keep the anchors. Change the intention.</h3></div><p>{p.journey.mode === "live" ? "A new intention sends another Qloo Insights request with the same explicit anchors. Chosen feedback is passed along." : "One tap creates another deterministic sample path. Feedback you explicitly chose can also shape the next path."}</p></div>
        <div className="intent-options">{INTENTS.map(choice => <button type="button" className={`intent-option ${p.journey?.intent === choice ? "selected" : ""}`} key={choice} onClick={() => p.resetCompass(choice)}>{choice}<ArrowRight size={13} /></button>)}</div>
      </section>
       {p.showInspector && <details className="provenance" open><summary>Under the Door · evidence from this journey <ChevronDown size={16} /></summary>
         {p.journey.mode === "live" ? <>
           <p><strong>Live Qloo response received.</strong> This evidence describes the completed response currently displayed. Tool names and endpoints are server-provided; credentials and hidden reasoning are never shown.</p>
            <div className="under-door-grid"><div><b>Qloo endpoints</b><span>{p.journey.methodology?.qlooEndpoints.join(", ") || "No endpoint evidence returned"}</span></div><div><b>Returned candidates</b><span>{p.journey.doors.length} entities</span></div><div><b>Resolved anchors</b><span>{p.journey.resolvedAnchors?.filter(entity => entity.entityId).length || 0} returned resolutions</span></div><div><b>Graph evidence</b><span>{p.journey.graph?.nodes.length || 0} nodes · {p.journey.graph?.edges.length || 0} edges</span></div><div><b>External provenance</b><span>Absent — no external provider was used</span></div><div><b>AI synthesis</b><span>Absent — no generative model was called</span></div></div>
            <h4>Anchor resolution evidence</h4>{p.journey.resolvedAnchors?.length ? p.journey.resolvedAnchors.map((entity, index) => <div className="inspector-row" key={`${entity.entityId || entity.label}-${index}`}><b>{entity.label}</b><span>{entity.entityId ? `${entity.entityName} · ${entity.entityType} · ${entity.entityId} · ${entity.reusedSeedEntity ? "selected from prior Qloo result" : `exact text match: ${entity.exactNameMatch ? "yes" : "no"}`}` : "No Qloo entity match; this input did not contribute to the query."}</span></div>) : <p>No resolved anchor entities were returned.</p>}
           <h4>Tool / endpoint evidence</h4>{p.journey.tools?.length ? p.journey.tools.map((tool, index) => {
             return <pre className="tool-evidence" key={index}>{JSON.stringify(publicTrace(tool), null, 2)}</pre>;
           }) : <p>No tool trace entries were returned.</p>}
           <h4>Returned graph edge evidence</h4>{p.journey.graph?.edges.length ? p.journey.graph.edges.map(edge => <div className="inspector-row" key={edge.id}><b>{edge.type} · {edge.provenance}</b><span>{edge.evidence}</span></div>) : <p>No graph edges were returned.</p>}
         </> : <>
           <p><strong>Demo mode · no Qloo data.</strong> This deterministic sample was authored for the interface and is not a Qloo result, external fact, or venue listing.</p>
           <div className="under-door-grid"><div><b>Qloo endpoints</b><span>None called</span></div><div><b>Tool calls / candidates</b><span>None · sample content only</span></div><div><b>Resolved entities / graph edges</b><span>None from Qloo</span></div><div><b>External provenance</b><span>Absent</span></div><div><b>AI synthesis</b><span>Absent</span></div></div>
           <div className="provenance-flow"><span>User-entered anchors</span><ArrowRight size={13} /><span>Authored deterministic demo path</span></div>
         </>}
       </details>}
       <details className="why-qloo"><summary>Why Qloo? <ChevronDown size={15} /></summary><p>Qloo lets Open Door resolve cultural entities and retrieve cross-domain signals through the server-side Search and Insights API contract. Its popularity field remains popularity, not affinity. Familiar, Adjacent, and Unexpected are Open Door route labels. Discovery Distance is an Open Door ordinal, never a Qloo score or a psychological measure.</p><p>Open Door uses explicit inputs and retrieved evidence; it does not infer identity. A configured key alone is not a live journey—the current results are called Live Qloo only after the real request succeeds.</p></details>
       <details className="explain"><summary>How this path was assembled <ChevronDown size={16} /></summary><div className="explain-content"><div><h4>Start with your words</h4><p>Anchors, intent, context, budget, and location are explicit inputs. Nothing about identity is inferred.</p></div><div><h4>Separate source from route</h4><p>Qloo supplies returned entities and evidence. Open Door labels familiar, adjacent, or unexpected routes and keeps that presentation logic distinct.</p></div><div><h4>Keep limits visible</h4><p>External provenance and AI synthesis are absent when none were used. Results do not verify opening hours, cost, availability, accessibility, or travel time.</p></div></div></details>
    </section>}
    </>}
  </>;
}

function DoorCard({ door, city, anchors, mode, saved, toggleSave, onOpenDoor, onCloseDoor, expanded, resultHeadingRef,
  scenarioCategory, scenario, onExploreDeeper, onLab, feedback, setFeedback, exploring }: {
  door: Door; city: string; anchors: string[]; saved: boolean; toggleSave: (door: Door, city: string, anchors: string[]) => void;
  onOpenDoor: (door: Door) => void; onCloseDoor: () => void; expanded: boolean;
  resultHeadingRef?: RefObject<HTMLHeadingElement | null>; exploring?: boolean;
  scenarioCategory?: ScenarioCategory; scenario?: string; onExploreDeeper: (door: Door) => void;
  onLab: (door: Door) => void; feedback?: string; setFeedback: (id: string, reason: string) => void; mode: "demo" | "live";
}) {
  const expansionId = `door-result-${door.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const scenarioText = scenario?.trim() || "";
  const localGuidance = scenarioText ? scenarioGuidance({ scenario: scenarioText }) : [];
  return <article className={`door-card ${expanded ? "is-expanded" : ""} ${feedback ? "dismissed" : ""} tier-${door.tier.toLowerCase()} category-${door.category.toLowerCase()}`}>
    <button className="door-preview" type="button" data-sound="none" onClick={() => expanded ? onCloseDoor() : onOpenDoor(door)}
      aria-expanded={expanded} aria-controls={expansionId} aria-label={`${expanded ? "Collapse" : "Open"} ${door.tier.toLowerCase()} door: ${door.title}`}>
      <span className="preview-number">{door.tier === "Familiar" ? "01" : door.tier === "Adjacent" ? "02" : "03"}</span>
      <span className="preview-architecture"><span className="preview-opening"><span className="preview-glint"></span><span className="preview-mark">{door.tier === "Familiar" ? "NEAR" : door.tier === "Adjacent" ? "BESIDE" : "BEYOND"}</span></span></span>
      <span className="preview-invite">{expanded ? "CLOSE DETAILS" : door.tier === "Unexpected" ? "OPEN THE WILDCARD" : "OPEN THIS DOOR"} <ArrowDownRight size={14} /></span>
    </button>
    <div className="door-top"><div className="door-kind"><Compass size={13} /> {door.tier === "Familiar" ? "A familiar interest" : door.tier === "Adjacent" ? "A related idea" : "Something different"} · {door.category}</div><h3>{door.title}</h3><div className="door-location">{mode === "live" ? door.kind : "An activity you can try at your own pace"}</div></div>
    {!expanded && <div className="door-body door-summary"><p>{door.why}</p></div>}
    <div className="door-actions"><button className={`icon-action ${saved ? "saved" : ""}`} type="button" onClick={() => toggleSave(door, city, anchors)} aria-label={saved ? `Remove ${door.title} from My Doors` : `Save ${door.title}`}><Bookmark size={15} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save"}</button>
      <button className="secondary-btn" type="button" data-sound="none" aria-expanded={expanded} aria-controls={expansionId}
        onClick={() => expanded ? onCloseDoor() : onOpenDoor(door)}>{expanded ? "Close details" : door.tier === "Unexpected" ? "Open the wildcard" : "Open this door"} <ArrowDownRight size={14} /></button>
    </div>
    <section className="door-result-expanded" id={expansionId} hidden={!expanded} aria-labelledby={`${expansionId}-heading`}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onCloseDoor(); } }}>
      <div className="door-result-heading">
        <span className="eyebrow">{mode === "live" ? "Recommended by Qloo" : "An idea to try"}</span>
        <button className="door-result-close" type="button" data-sound="none" onClick={onCloseDoor} aria-label={`Collapse ${door.title} details`}><X size={15} /> Close</button>
      </div>
      <h4 id={`${expansionId}-heading`} tabIndex={-1} ref={resultHeadingRef}>{door.title}</h4>
      <p className="expanded-kind">{door.category}</p>
      <div className="expanded-reasons">
        <div><h5>Why you might enjoy it</h5><p>{door.why}</p></div>
        <div><h5>Try this first</h5><p>{door.now}</p></div>
      </div>
      <a className="door-map-link" href={mapsSearch(door.category, city)} target="_blank" rel="noopener noreferrer">
        <MapPin size={14} /> Find {({ Music: "record shops", Art: "art galleries", Books: "libraries", Film: "cinemas", Food: "food markets", Design: "design museums", Outdoors: "parks", Experiences: "community centers", Other: "museums" } as Record<string, string>)[door.category] || "places"} nearby <span>Opens Google Maps</span>
      </a>
      {scenarioText && <section className="scenario-result" aria-label="Local personal considerations">
        <div><span>Make it work for you</span><p>You told us: {scenarioText}</p></div>
        <ul>{localGuidance.map((suggestion, index) => <li key={`${suggestion}-${index}`}>{suggestion}</li>)}</ul>
        {scenarioCategory === "wellbeing" && <small>These are planning suggestions, not medical advice. Check any access needs before visiting.</small>}
      </section>}
      <HiddenGem doorId={door.id} title={door.title} category={door.category} mode={mode} />
      <details className="expanded-evidence">
        <summary>{mode === "live" ? "Where this recommendation came from" : "About this example"} <ChevronDown size={14} /></summary>
        <p>{door.evidence}</p>
        {mode === "live" && <div className="expanded-source-facts">
          <span>Entity type · {door.entityType || "not returned"}</span>
          <span>Entity ID · {door.entityId || "not returned"}</span>
          <span>Discovery Distance · {door.discoveryDistance?.ordinal ?? "not supplied"} · Open Door ordinal, not a Qloo score</span>
          {door.popularity !== null && door.popularity !== undefined && <span>Qloo popularity · {door.popularity} · not affinity</span>}
        </div>}
        {mode === "live" && <p>{door.discoveryDistance?.rationale || "The familiar, related, and different labels describe the type of suggestion. They are not scores from Qloo."}</p>}
        {mode === "live" && door.explainability != null && <details className="qloo-explainability"><summary>Qloo explainability returned</summary><pre>{JSON.stringify(publicTrace(door.explainability), null, 2)}</pre></details>}
      </details>
      <div className="expanded-next-actions">
        <button className="primary-btn" type="button" disabled={exploring} onClick={() => onExploreDeeper(door)}>{exploring ? "Finding more ideas…" : "Explore more ideas"} <ArrowRight size={15} /></button>
        <button className="secondary-btn" type="button" onClick={() => onLab(door)}>Branch in Discovery Lab <ArrowRight size={14} /></button>
        <button className="icon-action" type="button" onClick={() => setFeedback(door.id, feedback ? "" : "choose")} aria-label={`Give feedback on ${door.title}`}><HeartCrack size={15} /> Not for me</button>
      </div>
    </section>
     {expanded && feedback && <div className="feedback-panel"><p>What didn’t fit? Your selected reason will be sent with the next live exploration.</p>{feedback === "choose" ? <div className="feedback-options">{REASONS.map(reason => <button key={reason} type="button" className="feedback-chip" onClick={() => setFeedback(door.id, reason)}>{reason}</button>)}</div> : <div><span className="feedback-confirm"><Check size={14} /> Noted: {feedback}</span><button className="text-button" type="button" onClick={() => setFeedback(door.id, "choose")}>Change</button><button className="text-button" type="button" onClick={() => setFeedback(door.id, "")}>Clear</button></div>}</div>}
  </article>;
}

function MiniDoor({ className = "" }: { className?: string }) {
  return <span className={`mini-door ${className}`} aria-hidden="true"><i /><b /></span>;
}

function Passport({ openedCount, categories, tiers, savedCount }: { openedCount: number; categories: Set<string>; tiers: Record<string, number>; savedCount: number }) {
  const values = [
    { label: "Familiar doors", value: tiers.Familiar || 0 },
    { label: "Adjacent doors", value: tiers.Adjacent || 0 },
    { label: "Unexpected doors", value: tiers.Unexpected || 0 },
  ];
  return <section className="passport-panel"><div className="module-heading"><div><span className="eyebrow">Your Cultural Passport · local activity only</span><h3>Tracks what you chose to open.</h3></div><p>Counts reflect explicit Open next door actions saved in this browser. They are activity markers, not personality traits or quality scores.</p></div>
    <div className="passport-stats"><div className="passport-stat"><b>{openedCount}</b><span>Doors opened</span></div><div className="passport-stat"><b>{categories.size}</b><span>Categories opened</span></div><div className="passport-stat"><b>{savedCount}</b><span>Doors saved</span></div></div>
    <h4 className="radar-title">Discovery Radar · opened-door counts</h4>
    <div className="radar-list" aria-label="Discovery Radar, counts from explicit actions only">{values.map(item => <div className="radar-item" key={item.label}><b>{item.value}</b>{item.label} · based on your explicit opens</div>)}</div>
  </section>;
}

function SavedView({ saved, signedIn, remove, onDiscover, explore }: { saved: SavedDoor[]; signedIn: boolean; remove: (id: string) => void; onDiscover: () => void; explore: (item: SavedDoor) => void }) {
  return <section><div className="section-heading"><div><span className="eyebrow">A small collection, gathered by you</span><h1>My Doors</h1><p>Threads worth keeping for another day. {signedIn ? "Saved with your account, across devices." : "Guest saves stay in this browser. Sign in to keep your doors across devices."}</p></div><span className="step-label">{saved.length} SAVED</span></div>
    {saved.length === 0 ? <div className="empty-state mascot-empty"><MascotArt scene="hello" /><h2>No doors saved yet.</h2><p>When a discovery stays with you, save it here. {signedIn ? "Saved doors sync with your account across devices." : "Your guest collection stays in this browser."}</p><button className="primary-btn" onClick={onDiscover}>Find your first door <ArrowRight size={15} /></button></div> :
        <><aside className="saved-guide" aria-label="A note from your field guide"><MascotArt scene="map" /><p><strong>Your collection, ready when you are.</strong><span>Open a saved door to begin a fresh path from its original interests.</span></p></aside><div className="saved-list">{saved.map(item => <article className="saved-row" key={item.id}><MiniDoor className="saved-door-mark" /><div className="saved-copy"><span className="saved-meta">{item.tier} door · saved {item.savedAt} · {item.mode === "live" ? "Qloo response" : "Demo sample"}</span><h3>{item.title}</h3><p><MapPin size={12} /> {item.city} · from {item.anchors.join(", ")}</p><p style={{ marginTop: 8 }}>{item.why} <br />Connection: {item.evidence}</p></div><div className="saved-actions"><button className="secondary-btn" onClick={() => explore(item)}><BookOpen size={14} /> Open a new path</button><button className="icon-action" onClick={() => remove(item.id)} aria-label={`Remove ${item.title}`}><Trash2 size={15} /> Remove</button></div></article>)}</div></>}
    <p className="helper" style={{ marginTop: 20 }}>{signedIn ? "Your saved doors sync with your account. Full journeys, explicit feedback, and Discovery Lab branches remain browser-local." : "Guest-saved doors and explicit feedback remain in this browser. Sign in to keep saved doors across devices."}</p>
  </section>;
}

function HowView({ agentStatus }: { agentStatus: AgentStatus | null }) {
  return <section>
     <div className="how-hero"><span className="eyebrow">A little more about the method</span><h1>Curiosity is a<br /><em>good compass.</em></h1><p>Open Door begins with the things you choose to share, then offers cultural threads to follow. It is an invitation to explore—not a verdict on who you are.</p><div className="journey-badge"><Info size={12} /> {agentStatus?.qlooConfigured ? "Live requests available · success required for a Live label" : "Demo available · Qloo not configured"}</div></div>
     <aside className="guide-illustration" aria-label="Open Door field guide">
       <MascotArt scene="explorer" />
       <p><span className="eyebrow">A field guide, not a verdict</span><span>Three directions to follow. The next step is yours.</span></p>
     </aside>
    <div className="steps">
      <div className="step"><span className="step-num">01 / BEGIN</span><h2>Name what you love.</h2><p>Choose a place, a time, explicit conditions, exploration depth, and cultural anchors. A sound, a meal, a film, a ritual—your own words are enough.</p></div>
      <div className="step"><span className="step-num">02 / CONNECT</span><h2>Follow a thread.</h2><p>In Live mode, actual Qloo Search and Insights responses supply entities and graph evidence. Demo Mode uses authored deterministic content. Familiar, adjacent, and unexpected are Open Door route labels, not Qloo scores.</p></div>
      <div className="step"><span className="step-num">03 / MAKE IT YOURS</span><h2>Keep what resonates.</h2><p>Save a door locally, open a Qloo-returned entity as a new anchor, or provide a reason it missed. Your explicit feedback is included in the next live request.</p></div>
    </div>
    <section className="mascot-showcase" aria-labelledby="mascot-showcase-title">
      <div><span className="eyebrow">Meet your field guide</span><h2 id="mascot-showcase-title">A door for every kind of curiosity.</h2><p>A little company for the music, art, and everyday moments you choose to explore.</p></div>
      <div className="mascot-showcase-grid">
        <figure><MascotArt scene="music" /><figcaption>A moment to listen</figcaption></figure>
        <figure><MascotArt scene="artist" /><figcaption>A creative detour</figcaption></figure>
        <figure><MascotArt scene="camera" /><figcaption>A new perspective</figcaption></figure>
        <figure><MascotArt scene="curiosity" /><figcaption>A little wonder</figcaption></figure>
      </div>
    </section>
    <div className="trust-box"><Info size={20} /><div><h3>Evidence, without pretending</h3><p>{agentStatus?.qlooConfigured ? "A server-side Qloo key is configured, but configuration does not make results live; only a successful real Qloo-backed response earns the Live label." : "Qloo is not currently configured. Demo connections remain authored sample content, not retrieved results."} The API key stays on the server. External provider data and AI synthesis are absent unless explicitly evidenced.</p></div></div>
     <section className="architecture-section" aria-labelledby="architecture-title">
       <div className="architecture-heading">
         <div><span className="eyebrow">The live path, with provenance attached</span><h2 id="architecture-title">Architecture</h2></div>
         <p>Only a successful Qloo-backed response is labeled Live. A failed request never falls back into a Live-labeled result.</p>
       </div>
       <div className="architecture-layout">
         <ol className="architecture-flow">
           <li><span className="architecture-step">01</span><div><strong>Explicit user interests</strong><p>You choose the anchors and context sent for discovery.</p></div></li>
           <li><span className="architecture-step">02</span><div><strong>Bounded Open Door server orchestrator</strong><p>The server coordinates the request; provider credentials remain server-side.</p></div></li>
           <li><span className="architecture-step">03</span><div><strong>Qloo Search entity resolution</strong><p>Search resolves the explicitly supplied interests into provider entities.</p></div></li>
           <li><span className="architecture-step">04</span><div><strong>Qloo Insights results and evidence</strong><p>Returned candidates and evidence inform the available directions.</p></div></li>
           <li><span className="architecture-step">05</span><div><strong>Open Door route labels and inspectable choices</strong><p>Familiar, adjacent, and unexpected are Open Door route labels—not Qloo scores. You can inspect the evidence and choose what to open.</p></div></li>
         </ol>
         <div className="architecture-art">
           <MascotArt scene="qloo" />
           <p className="architecture-art-note">An illustration of the handoff—not a connection indicator.</p>
         </div>
       </div>
       <div className="architecture-status" role="status">
         <Info size={16} />
         <p>{agentStatus?.qlooConfigured
           ? "Qloo is currently configured on the server. Configuration alone does not count as Live success; only a successful Qloo-backed response is labeled Live."
           : "Qloo is currently not configured. Demo remains available while Live discovery is unavailable."}</p>
       </div>
       <div className="architecture-demo"><strong>Demo is separate.</strong> Demo journeys use authored deterministic content, not Qloo results. A failed live request does not substitute a Demo path under a Live label.</div>
     </section>
    <div className="how-future"><strong>Responsible discovery.</strong> Open Door uses explicit taste signals, does not infer sensitive identity, does not assign cultural identity, and does not tell anyone what they should like. Cultural intelligence should create possibilities, not judgments. Business, event, and creator applications are future possibilities only; they are not functional features in this demo.</div>
  </section>;
}
