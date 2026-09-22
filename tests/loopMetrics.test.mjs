// Deterministic Node tests for src/lib/loopMetrics.js
// Run: node tests/loopMetrics.test.mjs (from the repo root)
import { strict as assert } from "node:assert";
import {
  LOOP_RECENT_WINDOW,
  LOOP_MIN_RACES,
  TRACK_FIT_MIN_RACES,
  TRACK_FIT_DELTA,
  DOMINATOR_CUTOFF,
  DOMINATOR_TOP_N,
  CONSISTENCY_STDDEV_FACTOR,
  TRACK_TYPE_ACE_LABELS,
  completedRows,
  sortRowsByDateAsc,
  lastNCompleted,
  luckIndex,
  consistencyScore,
  dominatorRatingsForField,
  dominatorTagQualifiers,
  loopAverages,
  trackFitTags,
} from "../src/lib/loopMetrics.js";

// Row indices: [0 name, 1 track, 2 year, 3 finish, 4 start, 5 lapsLed,
// 6 running, 7 manufacturer, 8 lapsDone, 9 date, 10 status, 11 fastestLaps,
// 12 totalLaps, 13 passDiff, 14 qualityPasses, 15 driverRating, 16 arp,
// 17 mid, 18 closer, 19 best, 20 worst, 21 greenPasses, 22 greenTimesPassed,
// 23 lapsInTop15, 24 top15Pct (0-1 fraction), 25 lapsLedPct]
function row(f = {}) {
  const r = new Array(26).fill(0);
  r[0] = f.name ?? "";
  r[1] = f.track ?? "";
  r[2] = f.year ?? 2026;
  r[3] = f.finish ?? 0;
  r[4] = f.start ?? 0;
  r[5] = f.lapsLed ?? 0;
  r[6] = f.running ?? 0;
  r[7] = f.mfr ?? "";
  r[8] = f.lapsDone ?? 0;
  r[9] = f.date ?? "";
  r[10] = f.status ?? "";
  r[11] = f.fastestLaps ?? 0;
  r[12] = f.totalLaps ?? 0;
  r[13] = f.passDiff ?? 0;
  r[14] = f.qualityPasses ?? 0;
  r[15] = f.driverRating ?? 0;
  r[16] = f.arp ?? 0;
  r[17] = 0;
  r[18] = 0;
  r[19] = 0;
  r[20] = 0;
  r[21] = 0;
  r[22] = 0;
  r[23] = 0;
  r[24] = f.top15Pct ?? 0;
  r[25] = 0;
  return r;
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log("ok - " + name);
}

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── 1. luckIndex ────────────────────────────────────────────────
test("luckIndex exact value on a hand-computed case", () => {
  // diffs: (10-8)=2, (20-14)=6, (5-10)=-5, (15-12)=3, (12-11)=1
  // mean = 7/5 = 1.4 (positive = unlucky, finishes worse than pace)
  const rows = [
    row({ finish: 10, arp: 8, date: "2026-01-01" }),
    row({ finish: 20, arp: 14, date: "2026-01-02" }),
    row({ finish: 5, arp: 10, date: "2026-01-03" }),
    row({ finish: 15, arp: 12, date: "2026-01-04" }),
    row({ finish: 12, arp: 11, date: "2026-01-05" }),
  ];
  const out = luckIndex(rows);
  assert.deepEqual(out, { value: 1.4, races: 5 });
});

test("luckIndex returns null with only 4 qualifying races", () => {
  const rows = [1, 2, 3, 4].map((i) =>
    row({ finish: 10, arp: 8, date: "2026-01-0" + i })
  );
  assert.equal(luckIndex(rows), null);
});

test("luckIndex ignores rows with arp = 0 and finish <= 0 rows", () => {
  const rows = [
    row({ finish: 10, arp: 8, date: "2026-01-01" }),
    row({ finish: 20, arp: 14, date: "2026-01-02" }),
    row({ finish: 5, arp: 0, date: "2026-01-03" }), // skipped: no arp
    row({ finish: 15, arp: 12, date: "2026-01-04" }),
    row({ finish: 12, arp: 11, date: "2026-01-05" }),
    row({ finish: 8, arp: 7, date: "2026-01-06" }),
    row({ finish: 0, arp: 5, date: "2026-01-07" }), // skipped: not completed
  ];
  // qualifying diffs: 2, 6, 3, 1, 1 -> mean 13/5 = 2.6
  const out = luckIndex(rows);
  assert.ok(close(out.value, 2.6));
  assert.equal(out.races, 5);
});

test("luckIndex respects the 12-race window", () => {
  // 13 qualifying races: the oldest one must be dropped from the window.
  const rows = Array.from({ length: 13 }, (_, i) =>
    row({ finish: 10, arp: 5, date: "2026-01-" + String(i + 1).padStart(2, "0") })
  );
  rows[0] = row({ finish: 40, arp: 5, date: "2026-01-01" }); // oldest, outside window
  const out = luckIndex(rows);
  assert.equal(out.races, 12);
  assert.ok(close(out.value, 5)); // (10-5) each
});

// ── 2. consistencyScore ─────────────────────────────────────────
test("consistencyScore: identical finishes score 100", () => {
  const rows = [1, 2, 3, 4, 5].map((i) =>
    row({ finish: 8, date: "2026-02-0" + i })
  );
  const out = consistencyScore(rows);
  assert.equal(out.score, 100);
  assert.equal(out.stdDev, 0);
  assert.equal(out.avg, 8);
  assert.equal(out.races, 5);
  assert.equal(out.best, 8);
  assert.equal(out.worst, 8);
});

test("consistencyScore: hand-computed stddev case", () => {
  // finishes 10,12,14,16,18: mean 14, population variance 8,
  // stdDev = sqrt(8) ~ 2.828, score = round(100 - 4*2.828) = round(88.686) = 89
  const rows = [10, 12, 14, 16, 18].map((f, i) =>
    row({ finish: f, date: "2026-03-0" + (i + 1) })
  );
  const out = consistencyScore(rows);
  assert.ok(close(out.stdDev, Math.sqrt(8)));
  assert.equal(out.score, 89);
  assert.equal(out.avg, 14);
  assert.equal(out.best, 10);
  assert.equal(out.worst, 18);
});

test("consistencyScore returns null with only 4 races", () => {
  const rows = [1, 2, 3, 4].map((i) => row({ finish: i, date: "2026-04-0" + i }));
  assert.equal(consistencyScore(rows), null);
});

test("consistencyScore handles huge variance", () => {
  // finishes 1 and 40 alternating: mean 20.5, population stdDev 19.5
  // -> score = round(100 - 4*19.5) = round(22) = 22
  const rows = [1, 40, 1, 40, 1, 40].map((f, i) =>
    row({ finish: f, date: "2026-05-" + String(i + 1).padStart(2, "0") })
  );
  const out = consistencyScore(rows);
  assert.equal(out.score, 22);
  assert.ok(close(out.stdDev, 19.5));
});

// ── 3. dominatorRatingsForField ─────────────────────────────────
test("dominatorRatingsForField: clear dominator gets 100, empty driver gets 0", () => {
  const field = {
    Dom: [
      row({ finish: 1, lapsLed: 100, lapsDone: 200, fastestLaps: 20, totalLaps: 200, top15Pct: 0.9, date: "2026-01-01" }),
    ],
    Back: [
      row({ finish: 30, lapsLed: 0, lapsDone: 200, fastestLaps: 0, totalLaps: 200, top15Pct: 0.1, date: "2026-01-01" }),
    ],
    Empty: [],
  };
  const ratings = dominatorRatingsForField(field);
  assert.equal(ratings.Dom, 100);
  assert.equal(ratings.Empty, 0);
  assert.ok(ratings.Back > 0 && ratings.Back < 100);
});

test("dominatorRatingsForField: laps-led-only driver gets round(100*0.4)=40", () => {
  // Led: 50/100 = 0.5 (field max, nobody else leads any laps)
  // fl: 0, top15: 0 -> rating = round(100 * 0.4) = 40
  const field = {
    Leader: [
      row({ finish: 5, lapsLed: 50, lapsDone: 100, fastestLaps: 0, totalLaps: 200, top15Pct: 0, date: "2026-01-01" }),
    ],
    Other: [
      row({ finish: 10, lapsLed: 0, lapsDone: 200, fastestLaps: 5, totalLaps: 200, top15Pct: 0.5, date: "2026-01-01" }),
    ],
  };
  const ratings = dominatorRatingsForField(field);
  assert.equal(ratings.Leader, 40);
  // Other is field max in fl and top15 -> round(100 * (0.3 + 0.3)) = 60
  assert.equal(ratings.Other, 60);
});

test("dominatorRatingsForField: guards against divide-by-zero", () => {
  const field = {
    A: [row({ finish: 10, totalLaps: 0, lapsDone: 0, date: "2026-01-01" })],
    B: [row({ finish: 12, totalLaps: 0, lapsDone: 0, date: "2026-01-01" })],
  };
  const ratings = dominatorRatingsForField(field);
  assert.equal(ratings.A, 0);
  assert.equal(ratings.B, 0);
});

test("dominatorRatingsForField: DNF rows excluded from components", () => {
  const field = {
    A: [
      row({ finish: 0, lapsLed: 200, lapsDone: 50, fastestLaps: 30, totalLaps: 200, top15Pct: 0.9, date: "2026-01-01" }),
    ],
  };
  const ratings = dominatorRatingsForField(field);
  assert.equal(ratings.A, 0); // only row is a DNF -> no components
});

// ── 4. dominatorTagQualifiers ───────────────────────────────────
test("dominatorTagQualifiers: cutoff logic and top-3 inclusion", () => {
  // A=90, B=75 hit cutoff; C=74 misses cutoff but is rank 3; D,E out.
  const q = dominatorTagQualifiers({ A: 90, B: 75, C: 74, D: 60, E: 50 });
  assert.deepEqual(new Set(q), new Set(["A", "B", "C"]));
});

test("dominatorTagQualifiers: top-3 included when nobody hits 75", () => {
  const q = dominatorTagQualifiers({ A: 60, B: 50, C: 40, D: 30 });
  assert.deepEqual(new Set(q), new Set(["A", "B", "C"]));
});

test("dominatorTagQualifiers: tie at rank 3 is included", () => {
  const q = dominatorTagQualifiers({ A: 90, B: 70, C: 70, D: 70, E: 50 });
  assert.deepEqual(new Set(q), new Set(["A", "B", "C", "D"]));
});

test("dominatorTagQualifiers: 74 does not qualify on cutoff alone", () => {
  const q = dominatorTagQualifiers({ A: 74 });
  // A is rank 1, so it qualifies via top-3 only; cutoff alone would not do it.
  assert.ok(q.includes("A"));
  assert.deepEqual(new Set(q), new Set(["A"]));
});

// ── 5. trackFitTags ─────────────────────────────────────────────
test("trackFitTags: short-track ace earned with >= 3 races and >= 3 better", () => {
  // short avg 6, intermediate avg 16, baseline 11 -> delta 5 >= 3
  const rows = [
    row({ finish: 5, track: "Martinsville Speedway", year: 2026, date: "2026-01-01" }),
    row({ finish: 6, track: "Bristol Motor Speedway", year: 2026, date: "2026-02-01" }),
    row({ finish: 7, track: "Richmond Raceway", year: 2026, date: "2026-03-01" }),
    row({ finish: 15, track: "Kansas Speedway", year: 2026, date: "2026-04-01" }),
    row({ finish: 16, track: "Charlotte Motor Speedway", year: 2026, date: "2026-05-01" }),
    row({ finish: 17, track: "Las Vegas Motor Speedway", year: 2026, date: "2026-06-01" }),
  ];
  const tags = trackFitTags(rows);
  assert.deepEqual(tags, [TRACK_TYPE_ACE_LABELS.short_track]);
});

test("trackFitTags: only 2 short-track races earns nothing", () => {
  const rows = [
    row({ finish: 5, track: "Martinsville Speedway", year: 2026, date: "2026-01-01" }),
    row({ finish: 6, track: "Bristol Motor Speedway", year: 2026, date: "2026-02-01" }),
    row({ finish: 15, track: "Kansas Speedway", year: 2026, date: "2026-04-01" }),
    row({ finish: 16, track: "Charlotte Motor Speedway", year: 2026, date: "2026-05-01" }),
    row({ finish: 17, track: "Las Vegas Motor Speedway", year: 2026, date: "2026-06-01" }),
  ];
  assert.deepEqual(trackFitTags(rows), []);
});

test("trackFitTags: Indianapolis year-awareness (2022 road course, 2024 intermediate)", () => {
  // 3 great Indy road-course runs in 2022 vs 3 mediocre intermediates elsewhere.
  // road_course avg = 2, baseline = (2+2+2+14+15+16)/6 = 8.5 -> delta 6.5 >= 3.
  // The 2024 Indy row must count as intermediate, not road_course.
  const rows = [
    row({ finish: 2, track: "Indianapolis Motor Speedway", year: 2022, date: "2022-07-31" }),
    row({ finish: 2, track: "Indianapolis Motor Speedway", year: 2022, date: "2022-07-31" }),
    row({ finish: 2, track: "Indianapolis Motor Speedway", year: 2022, date: "2022-07-31" }),
    row({ finish: 14, track: "Indianapolis Motor Speedway", year: 2024, date: "2024-07-21" }),
    row({ finish: 15, track: "Kansas Speedway", year: 2024, date: "2024-05-05" }),
    row({ finish: 16, track: "Charlotte Motor Speedway", year: 2024, date: "2024-05-26" }),
  ];
  const tags = trackFitTags(rows);
  assert.deepEqual(tags, [TRACK_TYPE_ACE_LABELS.road_course]);
});

test("trackFitTags: 2024 Indy row counts as intermediate", () => {
  // 3 strong 2024 Indy oval runs + 3 mediocre road-course runs elsewhere.
  // intermediate avg = 4, baseline = (4+4+4+16+17+18)/6 = 10.5 -> delta 6.5.
  const rows = [
    row({ finish: 4, track: "Indianapolis Motor Speedway", year: 2024, date: "2024-07-21" }),
    row({ finish: 4, track: "Indianapolis Motor Speedway", year: 2024, date: "2024-07-21" }),
    row({ finish: 4, track: "Indianapolis Motor Speedway", year: 2024, date: "2024-07-21" }),
    row({ finish: 16, track: "Sonoma Raceway", year: 2024, date: "2024-06-09" }),
    row({ finish: 17, track: "Watkins Glen International", year: 2024, date: "2024-09-15" }),
    row({ finish: 18, track: "Circuit Of The Americas", year: 2024, date: "2024-03-24" }),
  ];
  const tags = trackFitTags(rows);
  assert.deepEqual(tags, [TRACK_TYPE_ACE_LABELS.intermediate]);
});

// ── 6. loopAverages ─────────────────────────────────────────────
test("loopAverages: fraction-to-percent conversion", () => {
  const rows = [
    row({ totalLaps: 267, arp: 10, top15Pct: 0.623, driverRating: 100, date: "2026-01-01" }),
    row({ totalLaps: 267, arp: 14, top15Pct: 0.377, driverRating: 90, date: "2026-02-01" }),
  ];
  const out = loopAverages(rows);
  assert.ok(close(out.top15Pct, 50)); // 100 * mean(0.623, 0.377)
  assert.ok(close(out.arp, 12));
  assert.ok(close(out.driverRating, 95));
  assert.equal(out.races, 2);
});

test("loopAverages: single 0.623 fraction becomes 62.3", () => {
  const out = loopAverages([
    row({ totalLaps: 267, top15Pct: 0.623, date: "2026-01-01" }),
  ]);
  assert.ok(close(out.top15Pct, 62.3));
});

test("loopAverages: nulls when no rows have totalLaps > 0", () => {
  const out = loopAverages([
    row({ totalLaps: 0, arp: 10, top15Pct: 0.5, driverRating: 100, date: "2026-01-01" }),
  ]);
  assert.equal(out.arp, null);
  assert.equal(out.top15Pct, null);
  assert.equal(out.driverRating, null);
  assert.equal(out.races, 0);
});

test("loopAverages: nulls on empty input", () => {
  const out = loopAverages([]);
  assert.deepEqual(out, { arp: null, top15Pct: null, driverRating: null, races: 0 });
});

// ── 7. completedRows / lastNCompleted ───────────────────────────
test("completedRows filters finish <= 0", () => {
  const rows = [
    row({ finish: 5 }),
    row({ finish: 0 }),
    row({ finish: -1 }),
    row({ finish: 10 }),
  ];
  const out = completedRows(rows);
  assert.deepEqual(out.map((r) => r[3]), [5, 10]);
});

test("lastNCompleted orders by date ascending", () => {
  const rows = [
    row({ finish: 3, date: "2026-03-01" }),
    row({ finish: 1, date: "2026-01-01" }),
    row({ finish: 2, date: "2026-02-01" }),
    row({ finish: 4, date: "2026-04-01" }),
  ];
  const out = lastNCompleted(rows, 3);
  assert.deepEqual(out.map((r) => r[3]), [2, 3, 4]); // last 3 by date
});

test("lastNCompleted returns all when n exceeds count", () => {
  const rows = [row({ finish: 1, date: "2026-01-01" })];
  assert.equal(lastNCompleted(rows, 12).length, 1);
});

// ── 8. exported constants ───────────────────────────────────────
test("threshold constants match the spec", () => {
  assert.equal(LOOP_RECENT_WINDOW, 12);
  assert.equal(LOOP_MIN_RACES, 5);
  assert.equal(TRACK_FIT_MIN_RACES, 3);
  assert.equal(TRACK_FIT_DELTA, 3.0);
  assert.equal(DOMINATOR_CUTOFF, 75);
  assert.equal(DOMINATOR_TOP_N, 3);
  assert.equal(CONSISTENCY_STDDEV_FACTOR, 4);
  assert.deepEqual(TRACK_TYPE_ACE_LABELS, {
    superspeedway: "Superspeedway Ace",
    intermediate: "Intermediate Ace",
    short_track: "Short Track Ace",
    road_course: "Road Course Ace",
    dirt: "Dirt Ace",
  });
});

console.log("\n" + passed + " tests passed");
