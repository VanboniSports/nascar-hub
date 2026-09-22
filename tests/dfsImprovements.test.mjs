// Tests for the DFS loop-data improvements in src/components/DFSTab.jsx:
//   1. dfsLapsLedShare — recent-season windowing (year >= currentYear - 2) + blend weights
//   2. The missing-import fix: dfsProjectPoints runs without a ReferenceError
//      (predBuildDriverIndex / predGetTrackType / predMatchTrack are imported)
//   3. dominatorTagQualifiers behavior from src/lib/loopMetrics.js
//   4. Scoring constants: DK laps-led = 0.25 pts/lap, FD laps-led = 0.1 pts/lap
//
// DFSTab.jsx contains JSX and a `.jsx` import chain, so plain Node cannot import
// it directly. This test bundles it with the repo's esbuild (vendored by vite),
// resolves bare imports from the repo's node_modules, then exercises the exports.
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, "..");
const BUNDLE = path.join(TESTS_DIR, ".dfs-test-bundle.mjs");

// --- Bundle DFSTab.jsx (JSX) to plain ESM Node can import -------------------
execFileSync(
  path.join(REPO_ROOT, "node_modules", ".bin", "esbuild"),
  [
    "src/components/DFSTab.jsx",
    "--bundle",
    "--format=esm",
    "--platform=node",
    "--external:react",
    "--external:react-dom",
    "--external:recharts",
    "--external:papaparse",
    "--external:@supabase/supabase-js",
    `--outfile=${BUNDLE}`,
  ],
  { cwd: REPO_ROOT, stdio: "pipe" }
);

let bundle;
try {
  bundle = await import(pathToFileURL(BUNDLE).href);
} finally {
  // Always clean up the transient bundle; tests do not leave artifacts behind.
  rmSync(BUNDLE, { force: true });
}
// loopMetrics.js is plain JS (no JSX) — import the real source file directly.
const loopMetrics = await import(pathToFileURL(path.join(REPO_ROOT, "src", "lib", "loopMetrics.js")).href);

const { dfsLapsLedShare, dfsProjectPoints, dfsScoreDK, dfsScoreFD } = bundle;
const { dominatorTagQualifiers } = loopMetrics;

// --- Synthetic CSV row builder --------------------------------------------
// Row array indices: [0 driver, 1 track, 2 year, 3 finish, 4 start, 5 lapsLed,
// 6 running, 7 mfg, 8 lapsCompleted, 9 raceDate "YYYY-MM-DD", 10 status,
// 11 fastestLaps, 12 raceTotalLaps, 13 passDiff, 14 qualityPasses,
// 15 driverRating, 16 avgRunningPos, 24 lapsInTop15Pct (0-1 fraction)]
function R(driver, track, year, finish, o = {}) {
  const row = new Array(26).fill(0);
  row[0] = driver;
  row[1] = track;
  row[2] = year;
  row[3] = finish;
  row[4] = o.start ?? 10;
  row[5] = o.led ?? 0;
  row[6] = 1;
  row[7] = o.mfg ?? "Chevrolet";
  row[8] = o.laps ?? 267;                 // lapsCompleted
  row[9] = o.date ?? `${year}-09-15`;
  row[10] = "Running";
  row[11] = o.fl ?? 3;                    // fastestLaps
  row[12] = o.total ?? 267;               // raceTotalLaps
  row[13] = o.passDiff ?? 4;
  row[14] = 0;
  row[15] = o.rating ?? 90;               // driverRating
  row[16] = o.arp ?? 8;                   // avgRunningPos
  row[24] = o.top15 ?? 0.6;               // lapsInTop15Pct fraction
  return row;
}

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

// --- Test A: recent-season windowing ---------------------------------------
// Old seasons (2021-2022): led 50% of laps. Recent seasons (2024-2026): led ~2%.
// With currentYear=2026 the window is year >= 2024, so typeLedPct must be ~0.02.
{
  const rows = [
    R("Kyle Larson", "Kansas Speedway", 2021, 4, { led: 134 }),
    R("Kyle Larson", "Las Vegas Motor Speedway", 2021, 6, { led: 133 }),
    R("Kyle Larson", "Kansas Speedway", 2022, 3, { led: 134 }),
    R("Kyle Larson", "Charlotte Motor Speedway", 2022, 8, { led: 134 }),
    R("Kyle Larson", "Kansas Speedway", 2024, 5, { led: 5 }),
    R("Kyle Larson", "Las Vegas Motor Speedway", 2024, 7, { led: 5 }),
    R("Kyle Larson", "Texas Motor Speedway", 2025, 6, { led: 5 }),
    R("Kyle Larson", "Kansas Speedway", 2025, 4, { led: 6 }),
    R("Kyle Larson", "Kansas Speedway", 2026, 3, { led: 5 }),
  ];
  check("A: old seasons excluded from laps-led share", () => {
    const share = dfsLapsLedShare(rows, "Kansas Speedway", "intermediate", 2026);
    const expected = (5 + 5 + 5 + 6 + 5) / (267 * 5); // 26/1335 ≈ 0.01948
    assert.ok(Math.abs(share.typeLedPct - expected) < 1e-9,
      `typeLedPct ${share.typeLedPct} != expected ${expected}`);
    assert.ok(share.typeLedPct < 0.1,
      `typeLedPct ${share.typeLedPct} looks polluted by the 50%-led old seasons`);
  });
}

// --- Test B: blend weights (exact, hand-computed) ---------------------------
// 3 windowed Kansas rows -> 0.7 track / 0.3 type.
{
  const rows = [
    R("William Byron", "Kansas Speedway", 2024, 6, { led: 20 }),
    R("William Byron", "Kansas Speedway", 2025, 5, { led: 27 }),
    R("William Byron", "Kansas Speedway", 2026, 4, { led: 13 }),
    R("William Byron", "Las Vegas Motor Speedway", 2025, 8, { led: 40 }),
    R("William Byron", "Charlotte Motor Speedway", 2026, 9, { led: 10 }),
  ];
  check("B: blend weights 0.7/0.3 with >= 3 track races", () => {
    const share = dfsLapsLedShare(rows, "Kansas Speedway", "intermediate", 2026);
    const trackLedPct = (20 + 27 + 13) / (267 * 3);                 // 60/801
    const typeLedPct = (20 + 27 + 13 + 40 + 10) / (267 * 5);        // 110/1335
    assert.ok(Math.abs(share.trackLedPct - trackLedPct) < 1e-12, "trackLedPct");
    assert.ok(Math.abs(share.typeLedPct - typeLedPct) < 1e-12, "typeLedPct");
    const expected = trackLedPct * 0.7 + typeLedPct * 0.3;
    assert.ok(Math.abs(share.blendedLedPct - expected) < 1e-12,
      `blended ${share.blendedLedPct} != 0.7*track + 0.3*type ${expected}`);
  });
}

// --- Test C: dfsProjectPoints runs without ReferenceError -------------------
// Before the import fix, this threw `ReferenceError: predBuildDriverIndex is not defined`.
{
  const csvData = [
    R("Kyle Larson", "Kansas Speedway", 2025, 4, { led: 30 }),
    R("Kyle Larson", "Las Vegas Motor Speedway", 2025, 6, { led: 10 }),
    R("Kyle Larson", "Texas Motor Speedway", 2026, 3, { led: 20 }),
    R("Kyle Larson", "Kansas Speedway", 2026, 5, { led: 15 }),
    R("Denny Hamlin", "Kansas Speedway", 2025, 8, { led: 5 }),
    R("Denny Hamlin", "Charlotte Motor Speedway", 2026, 7, { led: 8 }),
    R("Denny Hamlin", "Kansas Speedway", 2026, 6, { led: 12 }),
  ];
  const race = { track: "Kansas Speedway", laps: 267, week: 30 };
  check("C: dfsProjectPoints returns projections without throwing", () => {
    const out = dfsProjectPoints(csvData, race, "dk", [], null, 2026);
    assert.ok(Array.isArray(out), "returns an array");
    assert.ok(out.length === 2, `expected 2 projections, got ${out.length}`);
    for (const p of out) {
      assert.ok(typeof p.projLapsLed === "number", "projLapsLed is a number");
      assert.ok(Array.isArray(p.tags), "tags is an array");
      assert.ok(typeof p.dominatorRating === "number",
        "dominatorRating is present on the projection");
    }
  });
}

// --- Test D: dominatorTagQualifiers ------------------------------------------
check("D: rating 80 (>= 75 cutoff) qualifies", () => {
  const names = dominatorTagQualifiers({ "Kyle Larson": 80 });
  assert.ok(names.includes("Kyle Larson"), `got ${JSON.stringify(names)}`);
});
check("D: top 3 of {a:10, b:20, c:30, d:5} are a, b, c", () => {
  const names = dominatorTagQualifiers({ a: 10, b: 20, c: 30, d: 5 });
  assert.deepStrictEqual(new Set(names), new Set(["a", "b", "c"]),
    `got ${JSON.stringify(names)}`);
});

// --- Test E: scoring constants -----------------------------------------------
// DK: laps-led = 0.25 pts/lap. FD: laps-led = 0.1 pts/lap.
check("E: DK laps-led worth 0.25 pts/lap", () => {
  // fin 10 -> 44-10=34 pts; start 10 -> 0 place diff; 40 led * 0.25 = 10
  const pts = dfsScoreDK(10, 10, 40, 267, false, 0);
  assert.ok(Math.abs(pts - 44) < 1e-9, `got ${pts}, expected 44`);
});
check("E: FD laps-led worth 0.1 pts/lap", () => {
  // fin 10 -> 41-10=31 pts; start 10 -> 0 place diff; 40 led * 0.1 = 4; 267*0.1=26.7 comp
  const pts = dfsScoreFD(10, 10, 40, 267, 267);
  assert.ok(Math.abs(pts - 61.7) < 1e-9, `got ${pts}, expected 61.7`);
});

console.log(`\n${passed} tests passed.`);
