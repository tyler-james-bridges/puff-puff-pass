import test from "node:test";
import assert from "node:assert/strict";
import { scoreFromStats, buildRankedRows, findRank } from "./leaderboard.mjs";

test("scoreFromStats follows configured weights", () => {
  const score = scoreFromStats({
    totalPasses: 3,
    longestStreak: 2,
    firstTakes: 1
  });

  assert.equal(score, 41);
});

test("buildRankedRows sorts by score then recent pass time", () => {
  const statsMap = new Map([
    [
      "alpha",
      {
        handle: "alpha",
        totalPasses: 1,
        longestStreak: 1,
        firstTakes: 0,
        lastPassAt: "2026-04-15T01:00:00.000Z"
      }
    ],
    [
      "bravo",
      {
        handle: "bravo",
        totalPasses: 1,
        longestStreak: 1,
        firstTakes: 0,
        lastPassAt: "2026-04-15T01:05:00.000Z"
      }
    ]
  ]);

  const rows = buildRankedRows(statsMap);
  assert.equal(rows[0].handle, "bravo");
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[1].rank, 2);
  assert.equal(findRank(rows, "alpha"), 2);
});

