import assert from "node:assert/strict";
import { getWeekWindowFromKey } from "../lib/utils";
import { clearEnabledVariablesForDomains, getDefaultGoalConfig, normalizeGoalConfig } from "../lib/goals";

function testWeekBoundaryMonday() {
  const sunday = getWeekWindowFromKey("2026-02-08");
  assert.equal(sunday.startKey, "2026-02-02");
  assert.equal(sunday.endKey, "2026-02-08");

  const monday = getWeekWindowFromKey("2026-02-09");
  assert.equal(monday.startKey, "2026-02-09");
  assert.equal(monday.endKey, "2026-02-15");
}

function testWeekBoundaryTimezone() {
  const chicago = getWeekWindowFromKey("2026-03-08");
  assert.equal(chicago.startKey, "2026-03-02");
  assert.equal(chicago.endKey, "2026-03-08");
}

function testCustomSetupClearsSelectedDomainsOnly() {
  const base = getDefaultGoalConfig();
  const withExtras = {
    ...base,
    enabledCategories: ["exercise", "reading"],
    categories: {
      ...base.categories,
      exercise: { enabled: ["minutes"], targets: { minutes: 60 } },
      reading: { enabled: ["pages"], targets: { pages: 20 } },
    },
  };

  const cleared = clearEnabledVariablesForDomains(withExtras, ["exercise"]);
  assert.deepEqual(cleared.categories.exercise.enabled, []);
  assert.deepEqual(cleared.categories.reading.enabled, ["pages"]);
}

function testRejectsKnowledgeKey() {
  let threw = false;
  try {
    normalizeGoalConfig({ enabledCategories: ["knowledge"] as any });
  } catch {
    threw = true;
  }
  assert.equal(threw, process.env.NODE_ENV !== "production");
}

function run() {
  testWeekBoundaryMonday();
  testWeekBoundaryTimezone();
  testCustomSetupClearsSelectedDomainsOnly();
  testRejectsKnowledgeKey();
  console.log("goal-logic tests passed");
}

run();
