// ───────────────────────────────────────────────────────────
// RATINGS ALGORITHM - extracted from NASCARHub.jsx (phase 1)
// ───────────────────────────────────────────────────────────
import { TRACK_KEYS } from "../data/drivers.js";

// ─────────────────────────────────────────────────────────────
// PER-SERIES FIELD SIZE
// Typical starters per race (median 2026 field from each series' dataset:
// Xfinity 38, Trucks 36). Cup is 36 per Morgan (36 full-time drivers;
// actual 2026 Cup fields run 36-41, median 37). Note: Cup outputs shift
// slightly vs the legacy hardcoded 35.
// ─────────────────────────────────────────────────────────────
export const SERIES_FIELD_SIZE = { cup: 36, xfinity: 38, truck: 36 };
function fieldSizeFor(series) {
  return SERIES_FIELD_SIZE[series] || SERIES_FIELD_SIZE.cup;
}

export function perfScore(fin, st, led, totLaps, stagePts, series = "cup") {
  const fs = fieldSizeFor(series);
  const f = fin <= 5 ? 100-(fin-1)*2 : 100-((fin-1)/fs)*100;
  const g = Math.min(100, Math.max(0, 50+(st-fin)*2.5));
  const l = totLaps > 0 ? (led/totLaps)*100 : 0;
  const s = (stagePts/20)*100;
  return Math.round(f*0.45 + s*0.15 + g*0.15 + l*0.15 + 100*0.1);
}

export function processRace(driversIn, raceName, trackTypeIn, totalLaps, results, prevRanksIn, recentFinishesIn, series = "cup") {
  const fs = fieldSizeFor(series);
  const trackType = trackTypeIn === "dirt" ? "short" : trackTypeIn; // dirt races use short track ratings
  const drivers = JSON.parse(JSON.stringify(driversIn));
  const recentFinishes = JSON.parse(JSON.stringify(recentFinishesIn));

  const prevRanks = {};
  TRACK_KEYS.forEach(key => {
    const sorted = [...drivers].sort((a,b) => b[key]-a[key]);
    sorted.forEach((d,i) => {
      if (!prevRanks[d.num]) prevRanks[d.num] = {};
      prevRanks[d.num][key] = i+1;
    });
  });

  const preSnap = {};
  drivers.forEach(d => { preSnap[d.num] = { overall:d.overall, superspeedway:d.superspeedway, intermediate:d.intermediate, short:d.short, road:d.road }; });

  const seasonStatsOut = {};
  const topFinishers = [];

  results.forEach(r => {
    const d = drivers.find(x => x.num === r.num);
    if (!d) return;
    const { fin, st, led, sp } = r;
    const ps = perfScore(fin, st, led, totalLaps, sp);

    if (!recentFinishes[d.num]) recentFinishes[d.num] = [];
    recentFinishes[d.num].unshift(fin);
    if (recentFinishes[d.num].length > 3) recentFinishes[d.num].pop();

    const recent = recentFinishes[d.num];
    const recentTop5s  = recent.filter(f => f <= 5).length;
    const recentTop10s = recent.filter(f => f <= 10).length;
    const momentum = recentTop5s >= 3 ? 1.5 : recentTop5s >= 2 ? 1.25 : recentTop10s >= 2 ? 1.1 : 1.0;

    const oldTrack = d[trackType];
    const goingUp = ps > oldTrack;
    const decay = goingUp ? 0.70 : 0.88;
    const rawNew = oldTrack * decay + ps * (1 - decay);
    const change = rawNew - oldTrack;
    const boosted = goingUp ? oldTrack + change * momentum : rawNew;
    const winBonus = fin === 1 ? 5 : fin <= 3 ? 3 : fin <= 5 ? 1 : 0;
    // Backmarker penalty, scaled to series field size (Cup: fin>36 → -2, fin>=33 → -1).
    const penalty = fin > fs ? -2 : fin >= fs - 3 ? -1 : 0;

    d[trackType] = Math.max(30, Math.min(99, Math.round(boosted + winBonus + penalty)));

    const trackBlend = Math.round(
      d.superspeedway*0.15 + d.intermediate*0.25 + d.short*0.20 + d.road*0.15 + d[trackType]*0.25
    );
    const avgRecent = recent.reduce((a,b) => a+b, 0) / recent.length;
    const recentScore = Math.round(100 - ((avgRecent-1)/fs)*50);
    d.overall = Math.max(30, Math.min(99, Math.round(trackBlend*0.60 + recentScore*0.40)));

    seasonStatsOut[d.num] = { fin, st, led, sp };
    if (fin <= 5) topFinishers.push(`P${fin}: #${d.num} ${d.name}`);
  });

  const postSnap = {};
  drivers.forEach(d => { postSnap[d.num] = { overall:d.overall, superspeedway:d.superspeedway, intermediate:d.intermediate, short:d.short, road:d.road }; });

  return { drivers, prevRanks, recentFinishes, preSnap, postSnap, topFinishers, seasonStatsOut };
}

// ─────────────────────────────────────────────────────────────
// COMBO POWER SCORE (approved Oct 21, 2026; preview-only addition)
// Power Rankings should be a combo of who is hot right now AND who
// has been hot through the season: a leading indicator ahead of
// points, not a points duplicate. Points are cumulative and lag;
// this score moves first because older races fade with time.
//
//   raw = 0.5 * time-decayed season average perfScore
//       + 0.5 * last-6 races average perfScore
//   time decay: weight = 0.5^(age in races / 10), so a race 10 races
//   ago counts half as much as the latest race. Incremental form:
//   on each new race, for each driver who raced: S = S*0.93303 + ps,
//   W = W*0.93303 + 1, decayed average = S/W; last-6 queue pushes ps
//   and drops past 6. Drivers who did not race keep S/W/last6 as-is
//   (their score freezes, which the provisional flag marks below).
//   perfScore is called WITHOUT a series argument, exactly as
//   processRace does today (field size 36 for every series) — a
//   known pre-existing quirk, deliberately unchanged here.
//
// Displayed Power Score (PRESENTATION ONLY — it changes no order
// except for the 99 cap; rank order is by effective raw below):
//   stretched = 75 + (effectiveRaw - fieldMean) * 1.0, clamped 30-99
//   fieldMean = mean raw over drivers who have run at least one
//   race (zero-race drivers are excluded from the mean and the
//   board). Slope 1.0 is FIXED once, never recomputed from that
//   week's leader gap, so a normal leader lands near 93 while an
//   exceptional leader can reach 98-99 (the 99 cap is the ceiling).
//   A driver's stretched score can move in a week he did not race
//   if the field mean moves; his raw score never moves without a
//   race.
//
// Guards:
//   1) 3-race ramp: effectiveRaw = fieldMean + min(1, n/3) *
//      (raw - fieldMean), n = races run. Full score from race 3
//      onward. A one-race wonder can reach ~85, not 99; a three-win
//      start reaches 99 on its third win.
//   2) Provisional flag: a driver who has not raced in the last 3
//      series races is flagged provisional (his raw froze).
//      Boards with fewer than 6 races processed are labelled
//      provisional as a whole (earlyProvisional).
//
// This is stored SEPARATELY from drivers[].overall. The legacy
// track-rating overall (processRace above) is untouched and keeps
// feeding Predictor, Season Stats, Compare, and Trends. Only the
// Power Rankings Rankings sub-tab sorts/displays the combo score.
// ─────────────────────────────────────────────────────────────
export const COMBO_DECAY = Math.pow(0.5, 1 / 10); // 0.93303 per race
export const COMBO_ANCHOR = 75;
export const COMBO_SLOPE = 1.0; // FIXED — never recompute from leader gap

export function emptyComboState() {
  return { racesProcessed: 0, drivers: {}, prevRanks: {} };
}

// Apply one race's results to combo state. results are {num, fin,
// st, led, sp} as in processRace; totalLaps is that race's lap count.
// Returns a NEW state object (callers store it); the input is untouched.
// prevRanks in the returned state is the board rank BEFORE this race
// (computed from the pre-apply board), matching legacy prevRanks use.
export function applyComboRace(comboIn, totalLaps, results) {
  const prev = comboIn || emptyComboState();
  const state = JSON.parse(JSON.stringify(prev));
  const preBoard = computeComboBoard(state);
  const preRank = {};
  preBoard.ranked.forEach((d, i) => { preRank[d.num] = i + 1; });
  state.racesProcessed = (state.racesProcessed || 0) + 1;
  const raceIdx = state.racesProcessed;
  results.forEach(r => {
    const num = String(r.num);
    const ps = perfScore(r.fin, r.st, r.led, totalLaps, r.sp);
    if (!state.drivers[num]) state.drivers[num] = { S: 0, W: 0, last6: [], races: 0, lastRaceIdx: 0 };
    const c = state.drivers[num];
    c.S = c.S * COMBO_DECAY + ps;
    c.W = c.W * COMBO_DECAY + 1;
    c.last6.push(ps);
    if (c.last6.length > 6) c.last6.shift();
    c.races += 1;
    c.lastRaceIdx = raceIdx;
  });
  state.prevRanks = preRank;
  return state;
}

// Compute the display board from combo state (pure, no mutation).
// Returns { ranked: [{num, raw, effectiveRaw, score, races,
// provisional}], fieldMean, racesProcessed, earlyProvisional }.
// Rank order is by effectiveRaw descending (pre-cap, pre-rounding),
// so two drivers capped at 99 still order by their true gap.
export function computeComboBoard(comboIn) {
  const state = comboIn || emptyComboState();
  const racesProcessed = state.racesProcessed || 0;
  const raws = [];
  Object.entries(state.drivers || {}).forEach(([num, c]) => {
    if (!c || !c.races) return;
    const decayed = c.W > 0 ? c.S / c.W : 0;
    const last6 = c.last6.length ? c.last6.reduce((a, b) => a + b, 0) / c.last6.length : 0;
    raws.push({ num, raw: 0.5 * decayed + 0.5 * last6, races: c.races, lastRaceIdx: c.lastRaceIdx || 0 });
  });
  const fieldMean = raws.length ? raws.reduce((a, b) => a + b.raw, 0) / raws.length : 0;
  const ranked = raws.map(d => {
    const effectiveRaw = fieldMean + Math.min(1, d.races / 3) * (d.raw - fieldMean);
    const score = Math.max(30, Math.min(99, Math.round(COMBO_ANCHOR + (effectiveRaw - fieldMean) * COMBO_SLOPE)));
    return {
      ...d,
      effectiveRaw,
      score,
      provisional: (racesProcessed - d.lastRaceIdx) >= 3,
    };
  }).sort((a, b) => b.effectiveRaw - a.effectiveRaw || a.num.localeCompare(b.num));
  return { ranked, fieldMean, racesProcessed, earlyProvisional: racesProcessed < 6 };
}
