import assert from "node:assert/strict";
import { computeLongestConsecutiveStreak, shouldAward007 } from "../lib/badges";

function testSevenDayRun() {
  const keys = [
    "2026-02-01",
    "2026-02-02",
    "2026-02-03",
    "2026-02-04",
    "2026-02-05",
    "2026-02-06",
    "2026-02-07",
  ];
  const result = computeLongestConsecutiveStreak(keys);
  assert.equal(result.longest, 7);
  assert.equal(result.has7, true);
}

function testBackfillRun() {
  const keys = [
    "2026-02-01",
    "2026-02-02",
    "2026-02-03",
    "2026-02-04",
    "2026-02-05",
  ];
  const laterKeys = [...keys, "2026-02-06", "2026-02-07"];
  const result = computeLongestConsecutiveStreak(laterKeys);
  assert.equal(result.longest, 7);
  assert.equal(result.has7, true);
}

function testNonConsecutive() {
  const keys = [
    "2026-02-01",
    "2026-02-02",
    "2026-02-04",
    "2026-02-05",
    "2026-02-06",
    "2026-02-08",
    "2026-02-09",
  ];
  const result = computeLongestConsecutiveStreak(keys);
  assert.equal(result.has7, false);
  assert.equal(result.longest, 3);
}

function testIdempotentAward() {
  assert.equal(shouldAward007(true, true), false);
  assert.equal(shouldAward007(false, true), true);
  assert.equal(shouldAward007(false, false), false);
}

function run() {
  testSevenDayRun();
  testBackfillRun();
  testNonConsecutive();
  testIdempotentAward();
  console.log("badge tests passed");
}

run();
