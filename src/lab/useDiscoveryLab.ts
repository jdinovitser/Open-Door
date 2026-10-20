import { useEffect, useRef, useState } from "react";
import { anchorDiscovery, createBranch, deleteBranch, emptyLab, forkDiscovery, freshLab, parseLab, recordResults, renameItem, replaceCurrent, restoreCheckpoint, resumeBranch, saveCheckpoint, seedLab } from "./engine.ts";
import { STORAGE_KEY, type Discovery, type DiscoveryProvider, type Feedback, type LabSeed, type LabState, type Settings, type Strategy } from "./model.ts";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function load() {
  try { return { state: parseLab(localStorage.getItem(STORAGE_KEY)), error: "" }; }
  catch (error) { return { state: emptyLab(), error: error instanceof Error ? error.message : "Browser-local Lab data could not be read." }; }
}
export function useDiscoveryLab(demo: DiscoveryProvider, live: DiscoveryProvider, qlooConfigured: boolean) {
  const [initial] = useState(load);
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(state);
  const [loadError, setLoadError] = useState(initial.error);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [notices, setNotices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    if (loadError) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setStorageWarning(""); }
    catch { setStorageWarning("This Lab is only in memory: browser storage is disabled or full. Export it before leaving this page."); }
  }, [state, loadError]);
  useEffect(() => () => request.current?.abort(), []);
  function commit(next: LabState) {
    stateRef.current = next;
    setState(next);
    return next;
  }
  function change(fn: (previous: LabState) => LabState) {
    if (loadError) { setError("Export or explicitly clear the unreadable saved Lab before starting again."); return undefined; }
    if (busyRef.current) { setError("Wait for this exploration to finish, or cancel it first."); return undefined; }
    try { const next = commit(fn(stateRef.current)); setError(""); return next; }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The Lab could not complete that change."); return undefined; }
  }
  async function explore(from = stateRef.current) {
    if (busyRef.current || loadError) return;
    const branch = from.branches.find(item => item.id === from.activeBranchId);
    if (!from.current || !branch) { setError("Choose a discovery branch first."); return; }
    if (from.current.mode === "live" && !qlooConfigured) { setError("Qloo is not configured. This Live branch was not changed. Start a separate Demo exploration to try the Lab."); return; }
    const controller = new AbortController();
    request.current = controller; busyRef.current = true; setBusy(true); setError(""); setNotices([]);
    try {
      const result = await (from.current.mode === "live" ? live : demo).discover({ snapshot: from.current, strategy: branch.strategy, signal: controller.signal });
      if (controller.signal.aborted) return;
      commit(recordResults(from, result, id(), now()));
      setNotices(result.notices);
    } catch (caught) {
      if (!controller.signal.aborted) setError(`${caught instanceof Error ? caught.message : "Discovery could not finish."} Your checkpoint and other branches are unchanged. No Demo fallback was used.`);
    } finally { if (request.current === controller) { busyRef.current = false; setBusy(false); request.current = null; } }
  }
  function cancel() { request.current?.abort(); request.current = null; busyRef.current = false; setBusy(false); setNotices(["Exploration cancelled. Saved branch history is unchanged."]); }
  function start(seed: LabSeed) { return change(previous => seedLab(previous, seed)); }
  function checkpoint(name = "") {
    return change(previous => saveCheckpoint(previous, name, id(), now()));
  }
  async function branch(strategy: Strategy, checkpointId?: string, overrides?: Partial<Settings>) {
    const next = change(previous => {
      let prepared = previous;
      let sourceId = checkpointId || previous.activeCheckpointId;
      if (!sourceId) { sourceId = id(); prepared = saveCheckpoint(previous, "", sourceId, now()); }
      const branched = createBranch(prepared, sourceId, strategy, id(), now());
      return overrides ? replaceCurrent(branched, { ...branched.current!, settings: { ...branched.current!.settings, ...overrides } }) : branched;
    });
    if (next) await explore(next);
  }
  async function next(discovery: Discovery) {
    const anchored = change(previous => anchorDiscovery(previous, discovery));
    if (anchored) await explore(anchored);
  }
  function fork(discovery: Discovery) {
    return change(previous => forkDiscovery(previous, discovery, id(), now()));
  }
  function feedback(discoveryId: string, value?: Feedback) {
    change(previous => {
      if (!previous.current) return previous;
      const feedback = { ...previous.current.feedback };
      if (value) feedback[discoveryId] = value; else delete feedback[discoveryId];
      return replaceCurrent(previous, { ...previous.current, feedback });
    });
  }
  function settings(patch: Partial<Settings>) {
    change(previous => previous.current ? replaceCurrent(previous, { ...previous.current, settings: { ...previous.current.settings, ...patch } }) : previous);
  }
  function clear() {
    cancel(); setLoadError(""); setError(""); setNotices([]); commit(emptyLab());
    try { localStorage.removeItem(STORAGE_KEY); } catch { setStorageWarning("Browser storage could not be cleared."); }
  }
  function exportData() {
    let raw: string;
    try { raw = loadError ? localStorage.getItem(STORAGE_KEY) || "{}" : JSON.stringify(stateRef.current, null, 2); }
    catch { raw = JSON.stringify(stateRef.current, null, 2); }
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "open-door-discovery-lab.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return {
    state, busy, error, loadError, storageWarning, notices, start, checkpoint, branch, explore, next, fork, feedback, settings, cancel, clear, exportData,
    restore: (checkpointId: string) => change(previous => restoreCheckpoint(previous, checkpointId)),
    resume: (branchId: string) => change(previous => resumeBranch(previous, branchId)),
    rename: (kind: "branch" | "checkpoint", itemId: string, name: string) => change(previous => renameItem(previous, kind, itemId, name)),
    remove: (branchId: string) => change(previous => deleteBranch(previous, branchId)),
    fresh: () => change(freshLab),
    favorite: (branchId: string) => change(previous => {
      const selected = previous.branches.find(item => item.id === branchId);
      if (!selected) return previous;
      const favorites = { ...previous.favorites };
      if (favorites[selected.checkpointId] === branchId) delete favorites[selected.checkpointId]; else favorites[selected.checkpointId] = branchId;
      return { ...previous, favorites };
    }),
  };
}
export type LabController = ReturnType<typeof useDiscoveryLab>;
