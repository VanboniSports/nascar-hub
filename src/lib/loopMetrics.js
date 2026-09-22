// ───────────────────────────────────────────────────────────
// LOOP METRICS - shared pure-computation library for loop-data features
// Pure JS (no JSX, no React, no DOM) so it can be imported by Node tests.
// Consumers: DFSTab (dominator rating, laps-led projections), DriverAnalyticsTab
// (luck index, consistency score, dominator rating, track-fit ace tags),
// StatsTab (sleeper ARP / Top15% / rating columns).
//
// Formula and threshold reference (all thresholds are exported constants):
//  - Luck Index: mean(finish - avgRunningPos) over the last 12 completed
//    races that have avgRunningPos > 0. Positive = finishes worse than pace
//    (unlucky), negative = lucky.
//  - Consistency Score: population std dev of finishes over the last 12
//    completed races; score = clamp(round(100 - 4 * stdDev), 0, 100).
//  - Dominator Rating: 0-100 per driver, normalized against the field.
//    rating = round(100 * (0.4 * led/maxLed + 0.3 * fl/maxFl
//                         + 0.3 * top15/maxTop15)).
//  - Loop Averages: per-window loop-data averages; the 0-1 top15 fraction
//    is converted to a 0-100 percent here.
//  - Track Fit Tags: a driver earns the "<Type> Ace" label when they have at
//    least TRACK_FIT_MIN_RACES completed races of that track type and their
//    mean finish at that type is at least TRACK_FIT_DELTA positions better
//    than their overall mean finish.
// No em dashes used anywhere in this file.
// ───────────────────────────────────────────────────────────
import { predGetTrackType } from "../models/predictors.js";

// Most recent N completed races used by the luck index and consistency score.
export const LOOP_RECENT_WINDOW = 12;
// Minimum qualifying races required for the luck index and consistency score.
export const LOOP_MIN_RACES = 5;
// Minimum completed races at a track type to earn a Track Fit Ace tag.
export const TRACK_FIT_MIN_RACES = 3;
// Mean-finish improvement (positions better than overall baseline) needed to earn an Ace tag.
export const TRACK_FIT_DELTA = 3.0;
// Dominator rating at or above this earns the Dominator tag.
export const DOMINATOR_CUTOFF = 75;
// ...or being in the top N of the field by rating (ties at rank N included).
export const DOMINATOR_TOP_N = 3;
// Consistency score = 100 - factor * stdDev of finishes.
export const CONSISTENCY_STDDEV_FACTOR = 4;

// Row indices in the parsed race-results CSV row arrays.
const I_FINISH = 3;      // finish position (0 or negative = did not complete)
const I_TRACK = 1;       // track name
const I_YEAR = 2;        // year
const I_LAPS_LED = 5;    // laps led
const I_LAPS_DONE = 8;   // laps completed
const I_DATE = 9;        // raceDate "YYYY-MM-DD"
const I_FASTEST_LAPS = 11; // fastest laps
const I_TOTAL_LAPS = 12; // race total laps
const I_DRIVER_RATING = 15; // driver rating
const I_ARP = 16;        // avg running position
const I_TOP15_PCT = 24;  // lapsInTop15Pct as a 0-1 FRACTION (not percent)

export const TRACK_TYPE_ACE_LABELS = {
  superspeedway: "Superspeedway Ace",
  intermediate: "Intermediate Ace",
  short_track: "Short Track Ace",
  road_course: "Road Course Ace",
  dirt: "Dirt Ace",
};

// Rows with finish position > 0 count as completed races.
export function completedRows(rows) {
  return rows.filter((r) => r[I_FINISH] > 0);
}

// New array sorted ascending by raceDate (string compare, null-safe).
export function sortRowsByDateAsc(rows) {
  return [...rows].sort((a, b) => {
    const da = a[I_DATE] || "";
    const db = b[I_DATE] || "";
    if (da < db) return -1;
    if (da > db) return 1;
    return 0;
  });
}

// Last n of the completed rows, ordered by date.
export function lastNCompleted(rows, n) {
  return sortRowsByDateAsc(completedRows(rows)).slice(-n);
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// Feature 2, Luck Index.
// mean(finish - avgRunningPos) over the last LOOP_RECENT_WINDOW completed
// races that have avgRunningPos > 0. Positive = finishes worse than pace
// (unlucky), negative = lucky. Returns { value, races }, or null when fewer
// than LOOP_MIN_RACES qualifying races.
export function luckIndex(rows) {
  const recent = lastNCompleted(rows, LOOP_RECENT_WINDOW);
  const diffs = recent
    .filter((r) => r[I_ARP] > 0)
    .map((r) => r[I_FINISH] - r[I_ARP]);
  if (diffs.length < LOOP_MIN_RACES) return null;
  return { value: mean(diffs), races: diffs.length };
}

// Feature 3, Consistency Score 0-100 (higher = more consistent).
// Population std dev of finishes over the last LOOP_RECENT_WINDOW completed
// races; score = clamp(round(100 - CONSISTENCY_STDDEV_FACTOR * stdDev), 0, 100).
// Returns { score, stdDev, avg, races, best, worst }, or null when fewer than
// LOOP_MIN_RACES completed races.
export function consistencyScore(rows) {
  const recent = lastNCompleted(rows, LOOP_RECENT_WINDOW);
  if (recent.length < LOOP_MIN_RACES) return null;
  const finishes = recent.map((r) => r[I_FINISH]);
  const avg = mean(finishes);
  const variance =
    finishes.reduce((s, f) => s + (f - avg) * (f - avg), 0) / finishes.length;
  const stdDev = Math.sqrt(variance);
  const score = Math.max(
    0,
    Math.min(100, Math.round(100 - CONSISTENCY_STDDEV_FACTOR * stdDev))
  );
  return {
    score,
    stdDev,
    avg,
    races: finishes.length,
    best: Math.min(...finishes),
    worst: Math.max(...finishes),
  };
}

// Feature 4, Dominator rating 0-100 per driver, normalized against the field.
// Per driver: ledRate = sum(lapsLed) / sum(lapsCompleted) (div0 guard -> 0),
// flRate = sum(fastestLaps) / sum(totalLaps) (guard -> 0),
// top15Rate = mean(lapsInTop15Pct || 0) over rows with totalLaps > 0
// (0 when no such rows). Each component is normalized by the field max
// (guard max = 0 -> 0), rating = round(100 * (0.4 * led/maxLed
// + 0.3 * fl/maxFl + 0.3 * top15/maxTop15)).
// rowsByDriver: { driverName: rows[] }. Drivers with no rows get 0.
export function dominatorRatingsForField(rowsByDriver) {
  const perDriver = {};
  for (const [name, rows] of Object.entries(rowsByDriver)) {
    const usable = completedRows(rows);
    let ledSum = 0;
    let lapsSum = 0;
    let flSum = 0;
    let totalSum = 0;
    const top15Vals = [];
    for (const r of usable) {
      ledSum += r[I_LAPS_LED] || 0;
      lapsSum += r[I_LAPS_DONE] || 0;
      flSum += r[I_FASTEST_LAPS] || 0;
      totalSum += r[I_TOTAL_LAPS] || 0;
      if (r[I_TOTAL_LAPS] > 0) top15Vals.push(r[I_TOP15_PCT] || 0);
    }
    perDriver[name] = {
      led: lapsSum > 0 ? ledSum / lapsSum : 0,
      fl: totalSum > 0 ? flSum / totalSum : 0,
      top15: mean(top15Vals) || 0,
    };
  }
  const names = Object.keys(perDriver);
  const maxOf = (key) => Math.max(0, ...names.map((n) => perDriver[n][key]));
  const maxLed = maxOf("led");
  const maxFl = maxOf("fl");
  const maxTop15 = maxOf("top15");
  const ratings = {};
  for (const name of names) {
    const d = perDriver[name];
    const nLed = maxLed > 0 ? d.led / maxLed : 0;
    const nFl = maxFl > 0 ? d.fl / maxFl : 0;
    const nTop15 = maxTop15 > 0 ? d.top15 / maxTop15 : 0;
    ratings[name] = Math.round(100 * (0.4 * nLed + 0.3 * nFl + 0.3 * nTop15));
  }
  return ratings;
}

// Feature 4, Dominator tag qualifiers: drivers with rating >= DOMINATOR_CUTOFF,
// UNION the top DOMINATOR_TOP_N by rating (ties at the Nth rank included).
// Returns an array of driver names.
export function dominatorTagQualifiers(ratings) {
  const names = Object.keys(ratings);
  const cutoffSet = new Set(names.filter((n) => ratings[n] >= DOMINATOR_CUTOFF));
  // Rank drivers by rating desc; find the rating at rank DOMINATOR_TOP_N
  // (1-based); everyone with rating >= that threshold is in the top N.
  const sorted = names
    .map((n) => ({ name: n, rating: ratings[n] }))
    .sort((a, b) => b.rating - a.rating);
  if (sorted.length > 0) {
    const rankN = sorted[Math.min(DOMINATOR_TOP_N, sorted.length) - 1].rating;
    for (const { name, rating } of sorted) {
      if (rating >= rankN) cutoffSet.add(name);
      else break;
    }
  }
  return [...cutoffSet];
}

// Feature 5 helper: loop averages over a row set (e.g. current-season rows).
// arp = mean(r[16]) over rows with r[12] > 0 and r[16] > 0, else null.
// top15Pct = 100 * mean(r[24] || 0) over rows with r[12] > 0, else null
// (converts the 0-1 fraction to a 0-100 percent).
// driverRating = mean(r[15]) over rows with r[12] > 0 and r[15] > 0, else null.
// Returns { arp, top15Pct, driverRating, races }.
export function loopAverages(rows) {
  const usable = rows.filter((r) => r[I_TOTAL_LAPS] > 0);
  const arpVals = usable.filter((r) => r[I_ARP] > 0).map((r) => r[I_ARP]);
  const top15Vals = usable.map((r) => r[I_TOP15_PCT] || 0);
  const ratingVals = usable
    .filter((r) => r[I_DRIVER_RATING] > 0)
    .map((r) => r[I_DRIVER_RATING]);
  return {
    arp: mean(arpVals),
    top15Pct: usable.length > 0 ? 100 * mean(top15Vals) : null,
    driverRating: mean(ratingVals),
    races: usable.length,
  };
}

// Feature 6, track-fit Ace tags.
// baseline = mean finish over all completed rows. For each track type in
// TRACK_TYPE_ACE_LABELS, typeRows = completed rows where
// predGetTrackType(r[1], r[2]) === type (the row's own year is passed so
// Indianapolis is classified correctly: road_course pre-2024, intermediate
// from 2024 on). The label is earned when typeRows.length >= TRACK_FIT_MIN_RACES
// and (baseline - mean(typeRows finish)) >= TRACK_FIT_DELTA, i.e. the driver
// finishes at least TRACK_FIT_DELTA positions better at that track type.
// Returns an array of labels (possibly empty, possibly multiple).
export function trackFitTags(rows) {
  const completed = completedRows(rows);
  if (completed.length === 0) return [];
  const baseline = mean(completed.map((r) => r[I_FINISH]));
  const tags = [];
  for (const [type, label] of Object.entries(TRACK_TYPE_ACE_LABELS)) {
    const typeRows = completed.filter(
      (r) => predGetTrackType(r[I_TRACK], r[I_YEAR]) === type
    );
    if (typeRows.length < TRACK_FIT_MIN_RACES) continue;
    const typeAvg = mean(typeRows.map((r) => r[I_FINISH]));
    if (baseline - typeAvg >= TRACK_FIT_DELTA) tags.push(label);
  }
  return tags;
}
