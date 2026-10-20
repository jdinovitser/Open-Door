export type DeletionScope = "progress" | "saved-doors" | "all" | "close";

export async function requestAccountDeletion(scope: DeletionScope, send: typeof fetch = fetch) {
  const fallback = "Deletion could not be confirmed. Check your connection and retry; do not assume anything was deleted.";
  let response: Response;
  try {
    response = await send(scope === "close" ? "/api/account" : "/api/account/data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ scope, confirmation: scope === "close" ? "CLOSE" : "ERASE" }),
    });
  } catch {
    throw new Error(fallback);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof result?.message === "string" ? result.message : fallback);
  if (scope === "close" ? result?.closed !== true : result?.erased !== scope || !Number.isSafeInteger(result?.revision)) {
    throw new Error(fallback);
  }
  return result as { revision: number; closed?: boolean; erased?: string };
}
