// All account writes and erasures share the same owner lock, across processes.
export async function withAccountTransaction(pool, userId, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))", [userId]);
    await client.query(
      "INSERT INTO open_door_account_state (clerk_user_id) VALUES ($1) ON CONFLICT DO NOTHING",
      [userId],
    );
    const result = await client.query(
      "SELECT revision, status FROM open_door_account_state WHERE clerk_user_id = $1",
      [userId],
    );
    const state = result.rows[0];
    if (!state) throw new Error("Account state unavailable.");
    const value = await operation(client, state);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function assertAccountWritable(state, revision) {
  if (state.status !== "active" || !Number.isSafeInteger(revision) || revision !== state.revision) {
    const error = new Error(state.status === "active"
      ? "Cloud data changed or was erased. Reload before making new saves."
      : "Account closure is in progress or complete. New cloud saves are blocked.");
    error.code = "ACCOUNT_STATE_CHANGED";
    throw error;
  }
}

export async function eraseAccountData(pool, userId, scope) {
  return withAccountTransaction(pool, userId, async (client, state) => {
    if (scope !== "close" && state.status !== "active") assertAccountWritable(state, state.revision);
    if (scope !== "progress") {
      await client.query("DELETE FROM open_door_saved_doors WHERE clerk_user_id = $1", [userId]);
    }
    if (scope !== "saved-doors") {
      await client.query("DELETE FROM open_door_progress_events WHERE clerk_user_id = $1", [userId]);
    }
    const result = await client.query(
      `UPDATE open_door_account_state SET revision = revision + 1,
         preferences = CASE WHEN $2 IN ('all', 'close') THEN NULL ELSE preferences END,
         status = CASE WHEN $2 = 'close' AND status <> 'closed' THEN 'closing' ELSE status END
       WHERE clerk_user_id = $1 RETURNING revision`,
      [userId, scope],
    );
    return result.rows[0].revision;
  });
}

const isMissingUser = error => error?.status === 404;

export async function finishAccountClosure(pool, userId, users) {
  // Durable "closing" state is committed before contacting Clerk. A timeout
  // must not reopen writes or lose the request; the worker retries it.
  try {
    await users.deleteUser(userId);
  } catch (error) {
    if (!isMissingUser(error)) throw error;
  }
  await eraseAccountData(pool, userId, "close");
  await pool.query(
    "UPDATE open_door_account_state SET status = 'closed' WHERE clerk_user_id = $1",
    [userId],
  );
}

export async function reconcileAccountClosures(pool, users, { batchSize = 25 } = {}) {
  // Include legacy owners that predate account_state. Oldest checks first
  // provide fair, bounded polling without requiring a Clerk webhook secret.
  const { rows } = await pool.query(
    `SELECT owners.clerk_user_id, COALESCE(state.status, 'active') AS status
       FROM (
         SELECT clerk_user_id FROM open_door_saved_doors
         UNION SELECT clerk_user_id FROM open_door_progress_events
         UNION SELECT clerk_user_id FROM open_door_account_state WHERE status <> 'closed'
       ) owners
       LEFT JOIN open_door_account_state state USING (clerk_user_id)
       WHERE COALESCE(state.status, 'active') <> 'closed'
       ORDER BY state.checked_at ASC NULLS FIRST, owners.clerk_user_id
       LIMIT $1`,
    [batchSize],
  );
  let failures = 0;
  for (const { clerk_user_id: userId, status } of rows) {
    try {
      if (status === "closing") {
        await finishAccountClosure(pool, userId, users);
      } else {
        try {
          await users.getUser(userId);
        } catch (error) {
          if (!isMissingUser(error)) throw error;
          await eraseAccountData(pool, userId, "close");
          await pool.query("UPDATE open_door_account_state SET status = 'closed' WHERE clerk_user_id = $1", [userId]);
        }
      }
    } catch {
      // A transient Clerk/network failure is never evidence of deletion.
      failures++;
    } finally {
      await pool.query(
        `INSERT INTO open_door_account_state (clerk_user_id, checked_at) VALUES ($1, now())
         ON CONFLICT (clerk_user_id) DO UPDATE SET checked_at = now()`,
        [userId],
      );
    }
  }
  return { checked: rows.length, failures };
}

export function startAccountCleanup(pool, users) {
  let running = false;
  async function run() {
    if (running) return;
    running = true;
    try {
      const result = await reconcileAccountClosures(pool, users);
      if (result.failures) console.warn("Account cleanup: some checks failed; they will be retried.");
    } catch {
      console.error("Account cleanup unavailable; check database schema and Clerk connectivity. Will retry.");
    } finally {
      running = false;
    }
  }
  void run();
  const timer = setInterval(() => void run(), 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
