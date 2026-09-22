// Deterministic tests for the shared loop-data helper used by the Sleeper Detector.
// Row layout (array indices): 0 driver, 1 track, 2 year, 3 finish, 4 start,
// 5 lapsLed, 8 lapsCompleted, 9 raceDate, 11 fastestLaps, 12 raceTotalLaps,
// 13 passDiff, 14 qualityPasses, 15 driverRating, 16 avgRunningPos,
// 24 lapsInTop15Pct (0-1 fraction).
import test from "node:test";
import assert from "node:assert/strict";
import { loopAverages } from "../src/lib/loopMetrics.js";

function makeRow(o = {}) {
  const r = new Array(25).fill(0);
  const at = (i, v) => { if (v !== undefined) r[i] = v; };
  at(0, o.driver ?? "Test Driver");
  at(1, o.track ?? "Kansas Speedway");
  at(2, o.year ?? 2026);
  at(3, o.finish ?? 10);
  at(4, o.start ?? 12);
  at(5, o.lapsLed ?? 5);
  at(8, o.lapsCompleted ?? 250);
  at(9, o.raceDate ?? "2026-09-27");
  at(11, o.fastestLaps ?? 2);
  at(12, o.raceTotalLaps ?? 267);
  at(13, o.passDiff ?? 3);
  at(14, o.qualityPasses ?? 40);
  at(15, o.driverRating ?? 95.4);
  at(16, o.avgRunningPos ?? 12.5);
  at(24, o.top15Frac ?? 0.623);
  return r;
}

test("fraction to percent: r[24] = 0.623 over 2 rows -> top15Pct 62.3", () => {
  const rows = [makeRow({ top15Frac: 0.623 }), makeRow({ top15Frac: 0.623 })];
  const got = loopAverages(rows);
  assert.equal(got.top15Pct, 62.3);
  assert.equal(got.races, 2);
});

test("nulls when no rows have r[12] > 0", () => {
  const rows = [makeRow({ raceTotalLaps: 0 }), makeRow({ raceTotalLaps: 0 })];
  const got = loopAverages(rows);
  assert.equal(got.arp, null);
  assert.equal(got.top15Pct, null);
  assert.equal(got.driverRating, null);
  assert.equal(got.races, 0);
});

test("arp ignores rows with r[16] = 0 but top15Pct counts rows with r[12] > 0", () => {
  const rows = [
    makeRow({ avgRunningPos: 0, top15Frac: 0.5 }),
    makeRow({ avgRunningPos: 10, top15Frac: 0.7 }),
  ];
  const got = loopAverages(rows);
  assert.equal(got.arp, 10);
  assert.equal(got.top15Pct, 60);
  assert.equal(got.races, 2);
});

test("driverRating ignores r[15] = 0 rows", () => {
  const rows = [
    makeRow({ driverRating: 0 }),
    makeRow({ driverRating: 88.2 }),
  ];
  const got = loopAverages(rows);
  assert.equal(got.driverRating, 88.2);
  assert.equal(got.races, 2);
});

test("empty input yields nulls and zero races", () => {
  const got = loopAverages([]);
  assert.equal(got.arp, null);
  assert.equal(got.top15Pct, null);
  assert.equal(got.driverRating, null);
  assert.equal(got.races, 0);
});
