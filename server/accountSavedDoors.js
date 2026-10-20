import { Router } from "express";
import { createRateLimiter } from "./security.js";
import { assertAccountWritable, eraseAccountData, finishAccountClosure, withAccountTransaction } from "./accountLifecycle.js";

export const MAX_SAVED_DOORS = 100;
const MAX_DOOR_BYTES = 24_000;
const ALLOWED_TIERS = new Set(["Familiar", "Adjacent", "Unexpected"]);
const SAVED_DOOR_FIELDS = new Set([
  "id", "title", "tier", "kind", "category", "source", "why", "now", "evidence",
  "thread", "whyYou", "entityId", "entityType", "sourceEntityIds", "coordinates",
  "popularity", "discoveryDistance", "explainability", "imageUrl", "city", "savedAt",
  "anchors", "mode",
]);
const ALLOWED_CATEGORIES = new Set([
  "Film", "Music", "Food", "Art", "Books", "Design", "Outdoors", "Experiences", "Other",
]);

export function normalizeSavedDoors(value) {
  if (!Array.isArray(value) || value.length > MAX_SAVED_DOORS) return null;
  const seen = new Set();
  const normalized = [];
  for (const door of value) {
    if (!door || typeof door !== "object" || Array.isArray(door)) return null;
    if (typeof door.id !== "string" || !door.id.trim() || door.id.length > 256) return null;
    if (typeof door.title !== "string" || !door.title.trim() || door.title.length > 280) return null;
    if (!ALLOWED_TIERS.has(door.tier) || seen.has(door.id)) return null;
    const safeDoor = Object.fromEntries(
      Object.entries(door).filter(([key]) => SAVED_DOOR_FIELDS.has(key)),
    );
    let serialized;
    try { serialized = JSON.stringify(safeDoor); } catch { return null; }
    if (Buffer.byteLength(serialized, "utf8") > MAX_DOOR_BYTES) return null;
    seen.add(door.id);
    normalized.push(safeDoor);
  }
  return normalized;
}

export function normalizeRemovalIds(value) {
  if (!Array.isArray(value) || value.length > MAX_SAVED_DOORS) return null;
  if (value.some(id => typeof id !== "string" || !id.trim() || id.length > 256)) return null;
  return [...new Set(value)];
}

export function normalizeProgressDoorEvents(value) {
  if (!Array.isArray(value) || value.length > MAX_SAVED_DOORS) return null;
  const seen = new Set();
  const result = [];
  for (const event of value) {
    if (!event || typeof event !== "object" || Array.isArray(event)) return null;
    if (typeof event.id !== "string" || !event.id.trim() || event.id.length > 256
      || !ALLOWED_TIERS.has(event.tier) || !ALLOWED_CATEGORIES.has(event.category)
      || seen.has(event.id)) return null;
    seen.add(event.id);
    result.push({ id: event.id, tier: event.tier, category: event.category });
  }
  return result;
}

export function createAccountSavedDoorStore(pool) {
  return {
    async list(userId) {
      const result = await pool.query(
        `SELECT door_data
           FROM open_door_saved_doors
          WHERE clerk_user_id = $1
          ORDER BY updated_at DESC`,
        [userId],
      );
      return result.rows.map(row => row.door_data);
    },

    async count(userId) {
      const result = await pool.query(
        `SELECT count(*)::integer AS total
           FROM open_door_saved_doors
          WHERE clerk_user_id = $1`,
        [userId],
      );
      return result.rows[0]?.total ?? 0;
    },

    async applyChanges(userId, upserts, removals, revision = 0) {
      const safeUpserts = normalizeSavedDoors(upserts);
      const safeRemovals = normalizeRemovalIds(removals);
      if (!safeUpserts || !safeRemovals || safeUpserts.some(door => safeRemovals.includes(door.id))) {
        throw new TypeError("Invalid saved-door changes.");
      }
      if (!safeUpserts.length && !safeRemovals.length) return;
      return withAccountTransaction(pool, userId, async (client, state) => {
        assertAccountWritable(state, revision);
        if (safeUpserts.length) {
          await client.query(
            `INSERT INTO open_door_saved_doors (clerk_user_id, door_id, door_data)
             SELECT $1, item.value->>'id', item.value
               FROM jsonb_array_elements($2::jsonb) AS item(value)
             ON CONFLICT (clerk_user_id, door_id)
             DO UPDATE SET door_data = EXCLUDED.door_data, updated_at = now()`,
            [userId, JSON.stringify(safeUpserts)],
          );
        }
        if (safeRemovals.length) {
          await client.query(
            `DELETE FROM open_door_saved_doors
              WHERE clerk_user_id = $1
                AND door_id = ANY($2::text[])`,
            [userId, safeRemovals],
          );
        }
        const countResult = await client.query(
          "SELECT count(*)::integer AS total FROM open_door_saved_doors WHERE clerk_user_id = $1",
          [userId],
        );
        if ((countResult.rows[0]?.total ?? 0) > MAX_SAVED_DOORS) {
          const error = new Error("Saved-door limit reached.");
          error.code = "SAVED_DOOR_LIMIT";
          throw error;
        }
      });
    },
  };
}

export function createAccountProgressStore(pool) {
  return {
    async summary(userId) {
      const result = await pool.query(
        `SELECT count(*)::integer AS opened_count,
                count(*) FILTER (WHERE tier = 'Unexpected')::integer AS brave_count,
                COALESCE(array_agg(DISTINCT category ORDER BY category), '{}') AS categories
           FROM open_door_progress_events
          WHERE clerk_user_id = $1`,
        [userId],
      );
      const row = result.rows[0] || {};
      return {
        doorsOpened: row.opened_count ?? 0,
        braveDoorsOpened: row.brave_count ?? 0,
        categories: row.categories ?? [],
      };
    },

    async addDoors(userId, doors, revision = 0) {
      if (!doors.length) return;
      return withAccountTransaction(pool, userId, async (client, state) => {
        assertAccountWritable(state, revision);
        await client.query(
        `INSERT INTO open_door_progress_events (clerk_user_id, door_id, tier, category)
         SELECT $1, item.value->>'id', item.value->>'tier', item.value->>'category'
           FROM jsonb_array_elements($2::jsonb) AS item(value)
         ON CONFLICT (clerk_user_id, door_id) DO NOTHING`,
        [userId, JSON.stringify(doors)],
        );
      });
    },
  };
}

export function createAccountSavedDoorsRouter({ pool, getUserId, users }) {
  const router = Router();
  router.use((request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    const userId = getUserId(request);
    if (typeof userId !== "string" || !userId || userId.length > 256) {
      response.status(401).json({
        code: "AUTHENTICATION_REQUIRED",
        message: "Sign in to access account-saved doors.",
        requestId: request.requestId,
      });
      return;
    }
    request.accountUserId = userId;
    next();
  });

  router.use((_request, response, next) => {
    if (!pool) {
      response.status(503).json({
        code: "ACCOUNT_STORAGE_UNAVAILABLE",
        message: "Account storage is not available. Please try again later.",
      });
      return;
    }
    next();
  });

  router.use(createRateLimiter({
    windowMs: 60_000,
    maxRequests: 120,
    keyForRequest: request => request.accountUserId || request.socket?.remoteAddress || "unknown",
  }));

  const store = pool ? createAccountSavedDoorStore(pool) : null;
  const progressStore = pool ? createAccountProgressStore(pool) : null;

  function stateConflict(error, response) {
    if (error?.code !== "ACCOUNT_STATE_CHANGED") return false;
    response.status(409).json({ code: error.code, message: error.message });
    return true;
  }

  router.delete("/data", async (request, response) => {
    const { scope, confirmation } = request.body || {};
    if (!["progress", "saved-doors", "all"].includes(scope) || confirmation !== "ERASE") {
      return response.status(400).json({ code: "CONFIRMATION_REQUIRED", message: "Confirm which cloud data to erase." });
    }
    try {
      const revision = await eraseAccountData(pool, request.accountUserId, scope);
      response.json({ erased: scope, revision });
    } catch (error) {
      if (stateConflict(error, response)) return;
      response.status(503).json({ code: "ERASURE_UNCONFIRMED", message: "Cloud erasure could not be confirmed. Retry; do not assume your data was erased." });
    }
  });

  router.delete("/", async (request, response) => {
    if (request.body?.confirmation !== "CLOSE") {
      return response.status(400).json({ code: "CONFIRMATION_REQUIRED", message: "Confirm account closure." });
    }
    if (!users) return response.status(503).json({ code: "CLOSURE_UNAVAILABLE", message: "Account closure is unavailable. Try again later." });
    let erased = false;
    try {
      await eraseAccountData(pool, request.accountUserId, "close");
      erased = true;
      await finishAccountClosure(pool, request.accountUserId, users);
      response.json({ closed: true });
    } catch {
      response.status(503).json({
        code: erased ? "CLOSURE_PENDING" : "CLOSURE_UNCONFIRMED",
        message: erased
          ? "Cloud doors and rewards were erased and new cloud saves are blocked. Account closure is not confirmed yet; automatic retries are scheduled. You can also retry here."
          : "Account closure could not be confirmed. Retry; do not assume your account or cloud data was deleted.",
      });
    }
  });

  router.get("/progress", async (request, response) => {
    try {
      response.json(await progressStore.summary(request.accountUserId));
    } catch {
      response.status(503).json({
        code: "ACCOUNT_STORAGE_UNAVAILABLE",
        message: "Progress could not be loaded. Please try again.",
      });
    }
  });

  router.post("/progress/doors", async (request, response) => {
    const doors = normalizeProgressDoorEvents(request.body?.doors);
    if (!doors) {
      response.status(400).json({
        code: "INVALID_PROGRESS_EVENT",
        message: "Door progress could not be recorded.",
        requestId: request.requestId,
      });
      return;
    }
    try {
      await progressStore.addDoors(request.accountUserId, doors, request.body?.revision ?? null);
      response.status(204).end();
    } catch (error) {
      if (stateConflict(error, response)) return;
      response.status(503).json({
        code: "ACCOUNT_STORAGE_UNAVAILABLE",
        message: "Progress could not be synchronized. Please try again.",
        requestId: request.requestId,
      });
    }
  });

  router.get("/saved-doors", async (request, response) => {
    try {
      const result = await withAccountTransaction(pool, request.accountUserId, async (client, state) => {
        assertAccountWritable(state, state.revision);
        return { savedDoors: await createAccountSavedDoorStore(client).list(request.accountUserId), revision: state.revision };
      });
      response.json(result);
    } catch (error) {
      if (stateConflict(error, response)) return;
      response.status(503).json({
        code: "ACCOUNT_STORAGE_UNAVAILABLE",
        message: "Account-saved doors could not be loaded. Please try again.",
      });
    }
  });

  router.patch("/saved-doors", async (request, response) => {
    const upserts = normalizeSavedDoors(request.body?.upserts);
    const removals = normalizeRemovalIds(request.body?.removals);
    if (!upserts || !removals || upserts.some(door => removals.includes(door.id))) {
      response.status(400).json({
        code: "INVALID_SAVED_DOOR_CHANGE",
        message: "Saved-door changes are invalid.",
        requestId: request.requestId,
      });
      return;
    }

    try {
      await store.applyChanges(request.accountUserId, upserts, removals, request.body?.revision ?? null);
      response.status(204).end();
    } catch (error) {
      if (stateConflict(error, response)) return;
      if (error?.code === "SAVED_DOOR_LIMIT") {
        response.status(409).json({
          code: "SAVED_DOOR_LIMIT",
          message: `An account can keep up to ${MAX_SAVED_DOORS} saved doors.`,
          requestId: request.requestId,
        });
        return;
      }
      response.status(503).json({
        code: "ACCOUNT_STORAGE_UNAVAILABLE",
        message: "Account-saved doors could not be synchronized. Please retry.",
        requestId: request.requestId,
      });
    }
  });

  return router;
}
