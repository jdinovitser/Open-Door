import { Router } from "express";
import { assertAccountWritable, withAccountTransaction } from "./accountLifecycle.js";

const CHOICES = {
  intent: ["Find my people", "Go deeper", "Try something new"],
  depth: ["Close to home", "A little further", "Surprise me", "Take me somewhere unexpected"],
  budget: ["Flexible", "Free or low-cost", "Moderate", "Open to a splurge"],
  movement: ["Mostly seated", "Easy walking", "Active and moving", "Transit is fine"],
};

// Deliberately exclude free text, locations, health notes and Lab history.
export function normalizePreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== Object.keys(CHOICES).length
    || Object.entries(CHOICES).some(([key, choices]) => !choices.includes(value[key]))) {
    return null;
  }
  return Object.fromEntries(Object.keys(CHOICES).map(key => [key, value[key]]));
}

export function createAccountPreferencesRouter(pool) {
  const router = Router();
  router.all("/", async (request, response) => {
    if (!["GET", "PUT", "DELETE"].includes(request.method)) {
      return response.status(405).set("Allow", "GET, PUT, DELETE").json({ message: "Method not supported." });
    }
    const preferences = request.method === "PUT" ? normalizePreferences(request.body?.preferences) : null;
    if (request.method === "PUT" && !preferences) {
      return response.status(400).json({ message: "Choose valid intention, discovery depth, budget and movement preferences only." });
    }
    try {
      const result = await withAccountTransaction(pool, request.accountUserId, async (client, state) => {
        assertAccountWritable(state, request.method === "GET" ? state.revision : request.body?.revision);
        if (request.method === "PUT") {
          await client.query("UPDATE open_door_account_state SET preferences = $2::jsonb WHERE clerk_user_id = $1",
            [request.accountUserId, JSON.stringify(preferences)]);
        } else if (request.method === "DELETE") {
          // Invalidate stale clients so an in-flight save cannot restore forgotten data.
          await client.query("UPDATE open_door_account_state SET preferences = NULL, revision = revision + 1 WHERE clerk_user_id = $1",
            [request.accountUserId]);
        }
        const { rows } = await client.query(
          "SELECT preferences, revision FROM open_door_account_state WHERE clerk_user_id = $1", [request.accountUserId]);
        return { preferences: normalizePreferences(rows[0].preferences), revision: rows[0].revision };
      });
      response.json(result);
    } catch (error) {
      const conflict = error?.code === "ACCOUNT_STATE_CHANGED";
      response.status(conflict ? 409 : 503).json({
        code: conflict ? error.code : "PREFERENCES_UNAVAILABLE",
        message: conflict ? error.message : "Preferences could not be loaded or saved. Please retry; no change is confirmed.",
      });
    }
  });
  return router;
}
