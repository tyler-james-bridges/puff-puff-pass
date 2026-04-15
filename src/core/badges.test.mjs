import test from "node:test";
import assert from "node:assert/strict";
import { computeBadges } from "./badges.mjs";

test("computeBadges returns expected progression badges", () => {
  const badges = computeBadges({
    totalPasses: 12,
    currentStreak: 3,
    longestStreak: 4,
    rank: 2
  });

  assert.deepEqual(badges, [
    "spark-starter",
    "rotation-runner",
    "chief-mode",
    "hotbox-legend"
  ]);
});

