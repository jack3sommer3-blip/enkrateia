"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const utils_1 = require("../lib/utils");
const goals_1 = require("../lib/goals");
function testWeekBoundaryMonday() {
    const sunday = (0, utils_1.getWeekWindowFromKey)("2026-02-08");
    strict_1.default.equal(sunday.startKey, "2026-02-02");
    strict_1.default.equal(sunday.endKey, "2026-02-08");
    const monday = (0, utils_1.getWeekWindowFromKey)("2026-02-09");
    strict_1.default.equal(monday.startKey, "2026-02-09");
    strict_1.default.equal(monday.endKey, "2026-02-15");
}
function testWeekBoundaryTimezone() {
    const chicago = (0, utils_1.getWeekWindowFromKey)("2026-03-08");
    strict_1.default.equal(chicago.startKey, "2026-03-02");
    strict_1.default.equal(chicago.endKey, "2026-03-08");
}
function testCustomSetupClearsSelectedDomainsOnly() {
    const base = (0, goals_1.getDefaultGoalConfig)();
    const withExtras = {
        ...base,
        enabledCategories: ["exercise", "reading"],
        categories: {
            ...base.categories,
            exercise: { enabled: ["minutes"], targets: { minutes: 60 } },
            reading: { enabled: ["pages"], targets: { pages: 20 } },
        },
    };
    const cleared = (0, goals_1.clearEnabledVariablesForDomains)(withExtras, ["exercise"]);
    strict_1.default.deepEqual(cleared.categories.exercise.enabled, []);
    strict_1.default.deepEqual(cleared.categories.reading.enabled, ["pages"]);
}
function testRejectsKnowledgeKey() {
    let threw = false;
    try {
        (0, goals_1.normalizeGoalConfig)({ enabledCategories: ["knowledge"] });
    }
    catch {
        threw = true;
    }
    strict_1.default.equal(threw, process.env.NODE_ENV !== "production");
}
function run() {
    testWeekBoundaryMonday();
    testWeekBoundaryTimezone();
    testCustomSetupClearsSelectedDomainsOnly();
    testRejectsKnowledgeKey();
    console.log("goal-logic tests passed");
}
run();
