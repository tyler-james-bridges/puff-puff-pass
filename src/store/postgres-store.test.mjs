import test from "node:test";
import assert from "node:assert/strict";
import { newDb } from "pg-mem";
import { PostgresStore } from "./postgres-store.mjs";

function createTestDbClient() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  return {
    async query(text, values = []) {
      return pool.query(text, values);
    },
    async close() {
      await pool.end();
    }
  };
}

test("PostgresStore applyPass updates holder, feed, and leaderboard", async () => {
  const store = new PostgresStore(createTestDbClient());
  await store.init();

  const first = await store.applyPass({
    handle: "alpha",
    amountUsd: "0.00402",
    txHash: "0xaaa",
    paymentSignature: "sig-a",
    message: "first"
  });

  assert.equal(first.event.status, "new_holder");
  assert.equal(first.event.displacedHandle, null);

  const second = await store.applyPass({
    handle: "alpha",
    amountUsd: "0.00402",
    txHash: "0xaab",
    paymentSignature: "sig-b",
    message: "defend"
  });

  assert.equal(second.event.status, "defended");

  const third = await store.applyPass({
    handle: "bravo",
    amountUsd: "0.00402",
    txHash: "0xaac",
    paymentSignature: "sig-c",
    message: "takeover"
  });

  assert.equal(third.event.status, "displaced_someone");
  assert.equal(third.event.displacedHandle, "alpha");

  const current = await store.getCurrent();
  assert.deepEqual(current, {
    currentHolder: "bravo",
    totalPasses: 3
  });

  const leaderboard = await store.getLeaderboard();
  assert.equal(leaderboard.length, 2);
  assert.equal(leaderboard[0].handle, "alpha");
  assert.equal(leaderboard[0].totalPasses, 2);

  const alphaStats = await store.getHandleStats("alpha");
  assert.equal(alphaStats.currentStreak, 0);
  assert.equal(alphaStats.longestStreak, 2);
  assert.equal(alphaStats.firstTakes, 1);

  const feed = await store.getFeed(2);
  assert.equal(feed.length, 2);
  assert.equal(feed[0].handle, "bravo");
  assert.equal(feed[1].handle, "alpha");

  await store.close();
});

test("PostgresStore backfillLatestPendingTxHash updates most recent pending pass", async () => {
  const store = new PostgresStore(createTestDbClient());
  await store.init();

  await store.applyPass({
    handle: "alpha",
    amountUsd: "0.00402",
    txHash: "pending",
    paymentSignature: "sig-a",
    message: "first"
  });

  await store.applyPass({
    handle: "alpha",
    amountUsd: "0.00402",
    txHash: "pending",
    paymentSignature: "sig-b",
    message: "second"
  });

  const updatedId = await store.backfillLatestPendingTxHash("alpha", "0xfeedbeef");
  assert.ok(updatedId);

  const feed = await store.getFeed(2);
  assert.equal(feed[0].txHash, "0xfeedbeef");
  assert.equal(feed[1].txHash, "pending");

  await store.close();
});
