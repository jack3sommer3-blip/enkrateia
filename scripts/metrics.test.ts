import assert from "node:assert/strict";
import { getWindowMetrics } from "../lib/metrics";

function testNoScores() {
  const result = getWindowMetrics([], 7);
  assert.equal(result.currentAvg, null);
  assert.equal(result.delta, null);
}

function testFiveScores() {
  const result = getWindowMetrics([1, 2, 3, 4, 5], 7);
  assert.equal(result.currentAvg, 3);
  assert.equal(result.delta, null);
}

function testSevenScores() {
  const result = getWindowMetrics([1, 2, 3, 4, 5, 6, 7], 7);
  assert.equal(result.currentAvg, 4);
  assert.equal(result.delta, null);
}

function testFourteenScores() {
  const scores = [7, 7, 7, 7, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1];
  const result = getWindowMetrics(scores, 7);
  assert.equal(result.currentAvg, 7);
  assert.equal(result.previousAvg, 1);
  assert.equal(result.delta, 6);
}

function testThirtyScores() {
  const scores = Array.from({ length: 30 }, (_, i) => i + 1);
  const result = getWindowMetrics(scores, 30);
  assert.equal(result.currentAvg, 15.5);
  assert.equal(result.delta, null);
}

function testSixtyScores() {
  const scores = Array.from({ length: 60 }, (_, i) => i + 1);
  const result = getWindowMetrics(scores, 30);
  assert.equal(result.currentAvg, 15.5);
  assert.equal(result.previousAvg, 45.5);
  assert.equal(result.delta, -30);
}

function testNegativeDelta() {
  const scores = [1, 1, 1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5];
  const result = getWindowMetrics(scores, 7);
  assert.equal(result.delta, -4);
}

function run() {
  testNoScores();
  testFiveScores();
  testSevenScores();
  testFourteenScores();
  testThirtyScores();
  testSixtyScores();
  testNegativeDelta();
  console.log("metrics tests passed");
}

run();
