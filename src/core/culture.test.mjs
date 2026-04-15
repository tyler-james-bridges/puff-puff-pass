import test from "node:test";
import assert from "node:assert/strict";
import { fillTemplate, buildCultureLines } from "./culture.mjs";

test("fillTemplate replaces handle and rank tokens", () => {
  const line = fillTemplate("{handle} moved to #{rank}", {
    handle: "tmoney_145",
    rank: 3
  });

  assert.equal(line, "tmoney_145 moved to #3");
});

test("buildCultureLines returns gain line and optional loss line", () => {
  const result = buildCultureLines({
    winnerHandle: "alice",
    winnerRank: 1,
    loserHandle: "bob",
    loserRank: 2,
    seed: "evt_1"
  });

  assert.equal(typeof result.gainLine, "string");
  assert.equal(typeof result.lossLine, "string");
  assert.equal(typeof result.vibeTag, "string");
  assert.ok(result.gainLine.includes("alice"));
  assert.ok(result.lossLine.includes("bob"));
});

test("buildCultureLines supports events without displaced holder", () => {
  const result = buildCultureLines({
    winnerHandle: "solo",
    winnerRank: 1,
    loserHandle: null,
    loserRank: null,
    seed: "evt_2"
  });

  assert.equal(result.lossLine, null);
});

