import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/accountDeletion.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { requestAccountDeletion } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("cloud erasure sends only scope and confirmation; success requires explicit acknowledgement", async () => {
  for (const scope of ["progress", "saved-doors", "all", "close"]) {
    const result = await requestAccountDeletion(scope, async (url, options) => {
      assert.equal(url, scope === "close" ? "/api/account" : "/api/account/data");
      assert.equal(options.method, "DELETE");
      assert.deepEqual(JSON.parse(options.body), { scope, confirmation: scope === "close" ? "CLOSE" : "ERASE" });
      return Response.json(scope === "close" ? { closed: true } : { erased: scope, revision: 2 });
    });
    assert.ok(scope === "close" ? result.closed : result.revision === 2);
  }
});

test("network errors, partial closure, unexpected content, and wrong-scope replies never claim success", async () => {
  await assert.rejects(requestAccountDeletion("all", async () => { throw new Error("Network failure"); }), /could not be confirmed/);
  for (const result of [{}, { erased: "progress", revision: 2 }, { erased: "all" }]) {
    await assert.rejects(requestAccountDeletion("all", async () => Response.json(result)), /could not be confirmed/);
  }
  await assert.rejects(requestAccountDeletion("close", async () => new Response("bad gateway", { status: 502 })), /could not be confirmed/);
  await assert.rejects(requestAccountDeletion("close", async () => Response.json({ closed: false })), /could not be confirmed/);
  await assert.rejects(requestAccountDeletion("close", async () => Response.json({
    code: "CLOSURE_PENDING", message: "Cloud erased; closure is still pending.",
  }, { status: 503 })), /closure is still pending/);
});
