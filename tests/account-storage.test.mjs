import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/accountSavedDoors.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { mergeAccountSavedDoors, diffAccountSavedDoors, combinePendingSavedDoorChanges, isPendingDoorChanges } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const door = (id, title = id) => ({ id, title });

test("account merge keeps remote records over guest duplicates, but pending account edits win", () => {
  const result = mergeAccountSavedDoors(
    [door("a", "cloud"), door("b", "removed cloud")],
    [door("a", "guest duplicate"), door("c", "guest import")],
    { upserts: [door("a", "pending edit"), door("d", "pending addition")], removals: ["b"] },
  );
  assert.deepEqual(result.map(item => item.id), ["a", "d", "c"]);
  assert.equal(result[0].title, "pending edit");
  const remoteWins = mergeAccountSavedDoors([door("a", "cloud")], [door("a", "guest")], { upserts: [], removals: [] });
  assert.equal(remoteWins[0].title, "cloud");
});

test("sync deltas do not replace an entire account collection or resurrect deleted doors", () => {
  const changes = diffAccountSavedDoors([door("a"), door("b")], [door("a"), door("c")]);
  assert.deepEqual(changes, { upserts: [door("c")], removals: ["b"] });
  const recovered = mergeAccountSavedDoors([door("a"), door("b"), door("other-device")], [], changes);
  assert.deepEqual(recovered.map(item => item.id), ["c", "a", "other-device"]);
});

test("pending changes retain offline removals and reconcile later re-saves", () => {
  const removed = combinePendingSavedDoorChanges(
    { upserts: [door("a")], removals: ["b"] },
    { upserts: [door("b", "re-saved")], removals: ["a"] },
  );
  assert.deepEqual(removed, { upserts: [door("b", "re-saved")], removals: ["a"] });
  assert.equal(isPendingDoorChanges(removed, value => !!value && typeof value.id === "string"), true);
  assert.equal(isPendingDoorChanges({ upserts: [], removals: [123] }, () => true), false);
});
