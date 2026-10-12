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
