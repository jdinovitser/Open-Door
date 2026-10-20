export type PendingSavedDoorChanges<T extends { id: string }> = {
  upserts: T[];
  removals: string[];
};

export function mergeAccountSavedDoors<T extends { id: string }>(
  remoteDoors: readonly T[],
  guestDoors: readonly T[],
  pending: PendingSavedDoorChanges<T>,
): T[] {
  const remoteById = new Map(remoteDoors.map(door => [door.id, door]));
  const pendingById = new Map(pending.upserts.map(door => [door.id, door]));
  const guestById = new Map(guestDoors.map(door => [door.id, door]));
  const removed = new Set(pending.removals);
  const order = [...pending.upserts, ...remoteDoors, ...guestDoors];
  const result: T[] = [];
  const seen = new Set<string>();
  for (const entry of order) {
    if (seen.has(entry.id) || removed.has(entry.id)) continue;
    seen.add(entry.id);
    result.push(remoteById.get(entry.id) ?? pendingById.get(entry.id) ?? guestById.get(entry.id) ?? entry);
  }
  return result;
}

export function diffAccountSavedDoors<T extends { id: string }>(
  previous: readonly T[],
  next: readonly T[],
): PendingSavedDoorChanges<T> {
  const previousById = new Map(previous.map(door => [door.id, door]));
  const nextById = new Map(next.map(door => [door.id, door]));
  return {
    upserts: [...nextById.values()].filter(door => JSON.stringify(previousById.get(door.id)) !== JSON.stringify(door)),
    removals: [...previousById.keys()].filter(id => !nextById.has(id)),
  };
}

export function combinePendingSavedDoorChanges<T extends { id: string }>(
  previous: PendingSavedDoorChanges<T>,
  next: PendingSavedDoorChanges<T>,
): PendingSavedDoorChanges<T> {
  const upserts = new Map(previous.upserts.map(door => [door.id, door]));
  const removals = new Set(previous.removals);
  for (const id of next.removals) {
    upserts.delete(id);
    removals.add(id);
  }
  for (const door of next.upserts) {
    removals.delete(door.id);
    upserts.set(door.id, door);
  }
  return { upserts: [...upserts.values()], removals: [...removals] };
}

export function isPendingDoorChanges<T extends { id: string }>(
  value: unknown,
  isDoor: (entry: unknown) => entry is T,
): value is PendingSavedDoorChanges<T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as { upserts?: unknown; removals?: unknown };
  return Array.isArray(pending.upserts) && pending.upserts.every(isDoor)
    && Array.isArray(pending.removals)
    && pending.removals.every(id => typeof id === "string" && id.length > 0 && id.length <= 256);
}
