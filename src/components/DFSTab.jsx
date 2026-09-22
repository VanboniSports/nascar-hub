// DFS Optimizer tab + lineup engines. Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useEffect } from "react";
import { T, TC, TL } from "../theme.js";
import { InfoLegend } from "./ui.jsx";
import { SCHEDULE } from "../data/schedule.js";
import { trackEvent } from "../lib/analytics.js";
import { DFS_PLATFORMS } from "../data/siteMeta.js";
import { INITIAL_DRIVERS, FULL_TIMER_NAMES } from "../data/drivers.js";


// §2 SCORING ENGINES


export const DFS_SALARY_FLOOR_PCT = 0.90;
// Top-tier threshold: drivers at or above this salary are "studs"


export const DFS_TOP_TIER_THRESHOLD = 9000;
// Minimum number of top-tier drivers required per lineup


export const DFS_MIN_TOP_TIER = 1;

// Upgrade a lineup by swapping cheaper drivers for more expensive ones to meet salary floor


export function dfsScoreDK(fin, start, lapsLed, totalLaps, isMostLapsLed, projectedFL) {
  let finPts = 0;
  if (fin === 1)       finPts = 46;
  else if (fin === 2)  finPts = 42;
  else if (fin === 3)  finPts = 41;
  else if (fin <= 43)  finPts = 44 - fin;
  else                 finPts = 1;
  const placeDiff  = (start - fin) * 1.0;
  const ledPts     = lapsLed * 0.25;
  const fastLapPts = (projectedFL || 0) * 0.45;
  const mostBonus  = isMostLapsLed ? 5 : 0;
  return finPts + placeDiff + ledPts + fastLapPts + mostBonus;
}


export function dfsScoreFD(fin, start, lapsLed, totalLaps, lapsCompleted) {
  let finPts = 0;
  if (fin === 1)       finPts = 43;
  else if (fin === 2)  finPts = 40;
  else if (fin === 3)  finPts = 38;
  else if (fin <= 40)  finPts = 41 - fin;
  else                 finPts = 1;
  const placeDiff   = (start - fin) * 0.5;
  const ledPts      = lapsLed * 0.1;
  const compPts     = (lapsCompleted || totalLaps) * 0.1;
  return finPts + placeDiff + ledPts + compPts;
}

// §3 PROJECT DFS POINTS


export function dfsProjectPoints(csvData, race, platformId, disabledDrivers, qualPracticeData) {
  if (!csvData?.length || !race) return [];
  const disabledSet = new Set((disabledDrivers || []).map(d => d.name));
  const driverIdx   = predBuildDriverIndex(csvData);
  const trackType   = predGetTrackType(race.track);
  const totalLaps   = race.laps || 200;
  // Extract qualifying/practice data if it matches the current race week
  const raceWeek = race.allStar ? "allstar" : race.week;
  const qualifyingData = (qualPracticeData && qualPracticeData.week === raceWeek) ? qualPracticeData.qualifying : null;
  const practiceData = (qualPracticeData && qualPracticeData.week === raceWeek) ? qualPracticeData.practice : null;
  const projections = [];
  for (const driverName of FULL_TIMER_NAMES) {
    if (disabledSet.has(driverName)) continue;
    const rows = driverIdx[driverName];
    if (!rows || rows.length === 0) continue;
    const sorted = [...rows].sort((a, b) => (a[9] || "").localeCompare(b[9] || ""));

    // Determine current season year from the most recent race in the dataset
    const currentYear = sorted.length > 0 ? sorted[sorted.length - 1][2] : new Date().getFullYear();

    // Full current season stats
    const seasonRows = sorted.filter(r => r[2] === currentYear);
    const seasonRaceCount = seasonRows.length;
    const seasonAvg = seasonRaceCount > 0
      ? seasonRows.reduce((s, r) => s + r[3], 0) / seasonRaceCount
      : 20.0;

    // Season track-type form: how they've done at THIS type of track THIS season
    const seasonTypeRows = seasonRows.filter(r => predGetTrackType(r[1]) === trackType);
    const seasonTypeAvg = seasonTypeRows.length > 0
      ? seasonTypeRows.reduce((s, r) => s + r[3], 0) / seasonTypeRows.length
      : null; // null signals "fall back to all-time typeAvg" below

    // Recency-weighted season average: more recent races count slightly more
    // Linear decay: most recent race gets weight N, second gets N-1, etc.
    let seasonWeightedAvg = seasonAvg; // fallback
    if (seasonRaceCount >= 3) {
      let weightedSum = 0;
      let totalWeight = 0;
      for (let i = 0; i < seasonRaceCount; i++) {
        const weight = i + 1; // oldest=1, newest=N
        weightedSum += seasonRows[i][3] * weight;
        totalWeight += weight;
      }
      seasonWeightedAvg = weightedSum / totalWeight;
    }

    // Keep last-5 as a fallback for early-season or cross-season edge cases
    const recent    = sorted.slice(-5);
    const recentAvg = recent.reduce((s, r) => s + r[3], 0) / recent.length;
    const trackRows       = rows.filter(r => predMatchTrack(race.track, r[1]));
    const trackAvg        = trackRows.length > 0 ? trackRows.reduce((s, r) => s + r[3], 0) / trackRows.length : 20.0;
    const trackWins       = trackRows.filter(r => r[3] === 1).length;
    const trackRaces      = trackRows.length;
    const trackBestFinish = trackRows.length > 0 ? Math.min(...trackRows.map(r => r[3])) : 40;
    const typeRows = rows.filter(r => predGetTrackType(r[1]) === trackType);
    const typeAvg  = typeRows.length > 0 ? typeRows.reduce((s, r) => s + r[3], 0) / typeRows.length : 20.0;
    const typeRowsSorted = [...typeRows].sort((a, b) => (a[9] || "").localeCompare(b[9] || ""));
    const recentType     = typeRowsSorted.slice(-3);
    const recentTypeAvg  = recentType.length > 0 ? recentType.reduce((s, r) => s + r[3], 0) / recentType.length : 20.0;
    const avgStart = trackRows.length > 0
      ? trackRows.reduce((s, r) => s + r[4], 0) / trackRows.length
      : typeRows.length > 0
        ? typeRows.reduce((s, r) => s + r[4], 0) / typeRows.length
        : 20.0;
    const trackLapsLed       = trackRows.reduce((s, r) => s + r[5], 0);
    const trackLapsCompleted = trackRows.reduce((s, r) => s + r[8], 0);
    const trackLedPct        = trackLapsCompleted > 0 ? trackLapsLed / trackLapsCompleted : 0;
    const typeLapsLed       = typeRows.reduce((s, r) => s + r[5], 0);
    const typeLapsCompleted = typeRows.reduce((s, r) => s + r[8], 0);
    const typeLedPct        = typeLapsCompleted > 0 ? typeLapsLed / typeLapsCompleted : 0;
    const blendedLedPct = trackRows.length >= 3
      ? trackLedPct * 0.7 + typeLedPct * 0.3
      : trackRows.length >= 1
        ? trackLedPct * 0.4 + typeLedPct * 0.6
        : typeLedPct;
    const projLapsLed = Math.round(blendedLedPct * totalLaps);
    let projFinish;
    const effectiveSeasonTypeAvg = seasonTypeAvg !== null ? seasonTypeAvg : typeAvg;
    if (trackRaces >= 5)      projFinish = trackAvg * 0.45 + typeAvg * 0.15 + effectiveSeasonTypeAvg * 0.15 + seasonWeightedAvg * 0.15 + recentAvg * 0.10;
    else if (trackRaces >= 2) projFinish = trackAvg * 0.25 + typeAvg * 0.20 + effectiveSeasonTypeAvg * 0.20 + seasonWeightedAvg * 0.20 + recentAvg * 0.15;
    else                      projFinish = typeAvg  * 0.25 + effectiveSeasonTypeAvg * 0.25 + seasonWeightedAvg * 0.30 + recentAvg * 0.20;
    if (trackWins >= 3)      projFinish *= 0.88;
    else if (trackWins >= 1) projFinish *= 0.93;
    // Practice adjustment: multi-component speed boost when practice data available
    if (practiceData && practiceData[driverName]) {
      const pd = practiceData[driverName];
      // pd may be a simple rank (legacy) or a rich object { speedRank, longRunRank, deltaRank, speedVsSalaryGap, totalDrivers }
      if (typeof pd === "object" && pd.speedRank != null) {
        const N = pd.totalDrivers || 36;
        const SPEED_WEIGHT = 5.0;
        const LONG_RUN_WEIGHT = 3.0;
        const DELTA_WEIGHT = 2.0;
        const VALUE_GAP_WEIGHT = 0.5;
        const MAX_VALUE_BOOST = 5.0;
        const speedPct = 1 - ((pd.speedRank - 1) / (N - 1));
        let practiceBoost = speedPct * SPEED_WEIGHT;
        if (pd.longRunRank != null) {
          const Nlr = pd.longRunTotal || N;
          practiceBoost += (1 - ((pd.longRunRank - 1) / (Nlr - 1))) * LONG_RUN_WEIGHT;
        }
        if (pd.deltaRank != null) {
          const Nd = pd.deltaTotal || N;
          practiceBoost += (1 - ((pd.deltaRank - 1) / (Nd - 1))) * DELTA_WEIGHT;
        }
        if (pd.speedVsSalaryGap != null && pd.speedVsSalaryGap > 0) {
          practiceBoost += Math.min(pd.speedVsSalaryGap * VALUE_GAP_WEIGHT, MAX_VALUE_BOOST);
        }
        // Convert boost into finish improvement (approx 1pt boost ≈ 0.4 finish improvement)
        projFinish = Math.max(1, projFinish - practiceBoost * 0.4);
      } else {
        // Legacy: simple rank number → light 8% blend
        const practiceRank = typeof pd === "number" ? pd : pd.speedRank || 20;
        const practiceFinish = Math.max(1, Math.min(40, practiceRank));
        projFinish = projFinish * 0.92 + practiceFinish * 0.08;
      }
    }
    projFinish = Math.max(1, Math.min(40, Math.round(projFinish * 10) / 10));

    // ═══ DNF RISK MODIFIER ═══
    const DNF_PENALTY_FINISH   = 36;  // Expected finish value for a DNF
    const DNF_RISK_WEIGHT      = 1.0; // Master dial: 1.0 = full effect, 0 = off

    // Hybrid DNF identification: explicit non-Running status OR P33+ finish as backstop
    // (scraper sometimes logs DNFs as "Running" so position-based fallback is necessary)
    const isDnf = r => {
      const status = (r[10] || "Running").trim();
      if (!/^running$/i.test(status)) return true;
      return r[3] >= 33;
    };

    const careerBadOutcomes = sorted.filter(isDnf).length;
    const careerDnfRate     = sorted.length > 0 ? careerBadOutcomes / sorted.length : 0;
    const seasonBadOutcomes = seasonRows.filter(isDnf).length;
    const seasonDnfRate     = seasonRaceCount > 0 ? seasonBadOutcomes / seasonRaceCount : 0;

    let dnfCareerWeight, dnfSeasonWeight;
    if (seasonRaceCount <= 5)       { dnfCareerWeight = 0.60; dnfSeasonWeight = 0.40; }
    else if (seasonRaceCount <= 10) { dnfCareerWeight = 0.40; dnfSeasonWeight = 0.60; }
    else                            { dnfCareerWeight = 0.30; dnfSeasonWeight = 0.70; }

    const blendedDnfRate = (careerDnfRate * dnfCareerWeight + seasonDnfRate * dnfSeasonWeight) * DNF_RISK_WEIGHT;

    // Apply finish penalty: expected value blend between clean finish and DNF
    const riskAdjustedFinish = projFinish * (1 - blendedDnfRate) + DNF_PENALTY_FINISH * blendedDnfRate;
    projFinish = Math.max(1, Math.min(40, Math.round(riskAdjustedFinish * 10) / 10));
    let projStart = Math.max(1, Math.min(40, Math.round(avgStart)));
    // Override projStart with actual qualifying position when available
    if (qualifyingData && qualifyingData[driverName]) {
      projStart = Math.max(1, Math.min(40, qualifyingData[driverName]));
    }

    // Deep starter bonus: driver starting P25+ projected to finish well gets upside boost
    // (the place differential points themselves are already captured in dfsScoreDK/FD,
    //  but we add a small projection uplift for the best deep-start scenarios)
    const isDeepStarter = qualifyingData && qualifyingData[driverName] && projStart >= 25 && projFinish <= 15;

    // Project fastest laps (DK only awards this; FD doesn't have FL points)
    // Every lap of the race awards 1 fastest lap (0.45 pts on DK), so totalLaps × share is the model.
    // Uses actual historical fastest-lap share from loop data (lagged: completed races only).
    // Backtested 2026-09-21 on Bristol: hist FL share correlates 0.599 with actual FL
    // vs 0.457 for laps-led share (the old heuristic's signal); MAE 8.35 laps.
    const flShareLast5 = (() => {
      const l5 = sorted.slice(-5).filter(r => (r[12] || 0) > 0);
      if (l5.length < 3) return null;
      return l5.reduce((s, r) => s + (r[11] || 0), 0) / l5.reduce((s, r) => s + r[12], 0);
    })();
    const flShareType = (() => {
      const tr = typeRows.filter(r => (r[12] || 0) > 0);
      if (tr.length < 3) return null;
      return tr.reduce((s, r) => s + (r[11] || 0), 0) / tr.reduce((s, r) => s + r[12], 0);
    })();
    let flShare;
    if (flShareLast5 != null && flShareType != null)      flShare = flShareLast5 * 0.5 + flShareType * 0.5;
    else if (flShareLast5 != null)                        flShare = flShareLast5;
    else if (flShareType != null)                         flShare = flShareType;
    else {
      // Fallback: old laps-led/finish heuristic (no loop data, e.g. uploaded CSV without loop columns)
      const lapsLedPct     = totalLaps > 0 ? projLapsLed / totalLaps : 0;
      const finishStrength = Math.max(0, (15 - Math.min(40, projFinish)) / 15); // 1.0 for P1, 0 for P15+
      flShare = (lapsLedPct * 0.6) + (finishStrength * 0.4 * 0.20); // top finishers split ~20% baseline
    }
    flShare               = Math.max(0, Math.min(0.40, flShare)); // cap at 40% — no driver realistically gets more
    const projectedFL     = Math.round(totalLaps * flShare);

    // Historical loop-data context (descriptive, lagged: completed races only).
    // NOTE: backtested 2026-09-21 — pass differential does NOT predict place
    // movement (r=0.08 deep starters, 0.05 overall) and is not persistent
    // (r=0.15 race-to-race), so it stays out of the points projection and is
    // shown for lineup decisions instead.
    const loopBlend = (c) => {
      const l5 = sorted.slice(-5).filter(r => (r[12] || 0) > 0);
      const s5 = l5.length >= 3 ? l5.reduce((s, r) => s + (r[c] || 0), 0) / l5.length : null;
      const tr = typeRows.filter(r => (r[12] || 0) > 0);
      const st = tr.length >= 3 ? tr.reduce((s, r) => s + (r[c] || 0), 0) / tr.length : null;
      if (s5 != null && st != null) return s5 * 0.5 + st * 0.5;
      return s5 != null ? s5 : st;
    };
    const histTop15Pct = loopBlend(24); // avg % of laps in top 15
    const histPassDiff = loopBlend(13); // avg net green-flag passes per race

    // Apply DNF discounts to laps-related inputs
    const adjustedLapsLed       = Math.round(projLapsLed  * (1 - blendedDnfRate * 0.7));
    const adjustedFL            = Math.round(projectedFL  * (1 - blendedDnfRate * 0.5));
    const adjustedLapsCompleted = Math.round(totalLaps    * (1 - blendedDnfRate * 0.5));

    let projectedPts;
    if (platformId === "dk") {
      const isMostLaps = adjustedLapsLed > totalLaps * 0.25;
      projectedPts = dfsScoreDK(Math.round(projFinish), projStart, adjustedLapsLed, totalLaps, isMostLaps, adjustedFL);
    } else {
      projectedPts = dfsScoreFD(Math.round(projFinish), projStart, adjustedLapsLed, totalLaps, adjustedLapsCompleted);
    }
    // Apply deep starter bonus after base scoring
    if (isDeepStarter) {
      const DEEP_STARTER_WEIGHT = 3.0;
      projectedPts += DEEP_STARTER_WEIGHT;
    }
    // diffPts: strip laps-completed floor for FD so value calc isn't inflated
    const lapsCompletedFloor = (platformId === "fd") ? (totalLaps * 0.1) : 0;
    const diffPts = Math.round((projectedPts - lapsCompletedFloor) * 10) / 10;
    const dInfo = INITIAL_DRIVERS.find(d => d.name === driverName);
    const tags = [];
    if (trackWins >= 2) tags.push("Track Ace");
    else if (trackWins >= 1) tags.push("Track Winner");
    if (trackAvg <= 8 && trackRaces >= 3) tags.push("Elite Trk Avg");
    if (recentAvg <= 8) tags.push("Hot Streak");
    if (projLapsLed > totalLaps * 0.10) tags.push("Dominator");
    if (projStart >= 25 && Math.round(projFinish) <= 15) tags.push("PD Play");
    if (isDeepStarter) tags.push("🚀 Deep Start");
    if (recentTypeAvg <= 10 && typeRows.length >= 5) tags.push("Type Specialist");
    if (platformId === "dk" && projectedFL >= totalLaps * 0.15) tags.push("Speed Demon");
    if (histPassDiff != null && histPassDiff >= 8) tags.push("Passing Ace");
    if (histTop15Pct != null && histTop15Pct >= 0.75) tags.push("Front Runner");
    if (blendedDnfRate >= 0.25) tags.push("⚠️ High DNF Risk");
    else if (blendedDnfRate >= 0.12) tags.push("DNF Risk");
    if (seasonDnfRate === 0 && seasonRaceCount >= 8) tags.push("Iron Man");
    projections.push({
      driver: driverName,
      num: dInfo?.num || "?",
      team: dInfo?.team || "",
      mfg: dInfo?.mfg || "",
      rookie: dInfo?.rookie || false,
      projectedPts: Math.round(projectedPts * 10) / 10,
      diffPts,
      projFinish: Math.round(projFinish * 10) / 10,
      projStart,
      projLapsLed,
      projectedFL,
      top15Pct: histTop15Pct != null ? Math.round(histTop15Pct * 100) : null,
      histPassDiff: histPassDiff != null ? Math.round(histPassDiff * 10) / 10 : null,
      trackAvg: trackAvg.toFixed(1),
      trackRaces,
      trackWins,
      trackBestFinish,
      typeAvg: typeAvg.toFixed(1),
      recentAvg: recentAvg.toFixed(1),
      recentTypeAvg: recentTypeAvg.toFixed(1),
      tags,
      salary: 0,
      value: 0,
    });
  }
  projections.sort((a, b) => b.diffPts - a.diffPts);
  return projections;
}

// §4 LINEUP OPTIMIZER
// Salary floor: lineups must use at least this % of the cap


export function dfsUpgradeLineup(lineup, eligible, salaryCap) {
  if (!lineup || lineup.length === 0) return lineup;
  let current = [...lineup];
  let totalSalary = current.reduce((s, d) => s + d.salary, 0);
  const usedNums = () => new Set(current.map(d => d.num));

  // Candidate pool sorted by projected points (best first)
  const byPtsDesc = [...eligible].sort((a, b) => b.diffPts - a.diffPts);

  // Keep upgrading: swap cheapest lineup slot for a more expensive + better driver
  // Continue until we can't find any more beneficial swaps (not just until floor is met)
  let passes = 0;
  while (passes < 15) {
    passes++;
    let upgraded = false;
    // Try upgrading cheapest roster slot first
    const sorted = [...current].sort((a, b) => a.salary - b.salary);
    for (const slot of sorted) {
      const used = usedNums();
      const budget = salaryCap - (totalSalary - slot.salary);
      // Find a candidate: more expensive, better projected pts, within budget
      for (const candidate of byPtsDesc) {
        if (used.has(candidate.num)) continue;
        if (candidate.salary <= slot.salary) continue;
        if (candidate.salary > budget) continue;
        // Only require the candidate to project higher points (strict improvement)
        if (candidate.diffPts <= slot.diffPts) continue;
        // Swap
        const idx = current.findIndex(d => d.num === slot.num);
        totalSalary = totalSalary - slot.salary + candidate.salary;
        current[idx] = candidate;
        upgraded = true;
        break;
      }
      if (upgraded) break;
    }
    if (!upgraded) break;
  }
  return current;
}

// Check if lineup meets top-tier requirement


export function dfsHasTopTier(lineup, minCount, threshold) {
  return lineup.filter(d => d.salary >= threshold).length >= minCount;
}

// Force top-tier drivers into a lineup


export function dfsForceTopTier(lineup, eligible, rosterSize, salaryCap, minTopTier, threshold) {
  if (!lineup) return null;
  const topTierCount = lineup.filter(d => d.salary >= threshold).length;
  if (topTierCount >= minTopTier) return lineup;

  const current = [...lineup];
  let totalSalary = current.reduce((s, d) => s + d.salary, 0);
  const usedNums = () => new Set(current.map(d => d.num));

  // Get top-tier drivers not in lineup, sorted by projected pts
  const topTierPool = [...eligible]
    .filter(d => d.salary >= threshold)
    .sort((a, b) => b.diffPts - a.diffPts);

  // Sort current lineup by salary ascending (swap out cheapest)
  let needed = minTopTier - topTierCount;
  const nonTopTier = current.filter(d => d.salary < threshold).sort((a, b) => a.diffPts - b.diffPts);

  for (const slot of nonTopTier) {
    if (needed <= 0) break;
    const used = usedNums();
    const budget = salaryCap - (totalSalary - slot.salary);
    for (const candidate of topTierPool) {
      if (used.has(candidate.num)) continue;
      if (candidate.salary > budget) continue;
      const idx = current.findIndex(d => d.num === slot.num);
      totalSalary = totalSalary - slot.salary + candidate.salary;
      current[idx] = candidate;
      needed--;
      break;
    }
  }
  return current.length === rosterSize ? current : null;
}

// Validate and enhance a lineup: enforce salary floor + top-tier requirement


export function dfsValidateLineup(lineup, eligible, rosterSize, salaryCap) {
  if (!lineup || lineup.length !== rosterSize) return null;
  // Step 1: Force top-tier drivers
  let enhanced = dfsForceTopTier(lineup, eligible, rosterSize, salaryCap, DFS_MIN_TOP_TIER, DFS_TOP_TIER_THRESHOLD);
  if (!enhanced || enhanced.length !== rosterSize) return null;
  // Step 2: Upgrade to meet salary floor
  enhanced = dfsUpgradeLineup(enhanced, eligible, salaryCap);
  if (!enhanced || enhanced.length !== rosterSize) return null;
  const totalSalary = enhanced.reduce((s, d) => s + d.salary, 0);
  if (totalSalary > salaryCap) return null;
  return enhanced;
}


export function dfsGreedyLineup(pool, rosterSize, salaryCap) {
  const lineup = [];
  let remaining = salaryCap;
  const used = new Set();
  for (const d of pool) {
    if (used.has(d.num)) continue;
    if (d.salary <= 0) continue;
    if (d.salary > remaining) continue;
    if (lineup.length >= rosterSize) break;
    lineup.push(d);
    remaining -= d.salary;
    used.add(d.num);
  }
  return lineup.length === rosterSize ? lineup : null;
}

// Stars & Scrubs: Lock top studs (3 for FD/5-man, 2 for DK/6-man), fill rest with best value bargains


export function dfsStarsAndScrubs(eligible, rosterSize, salaryCap) {
  const byPts   = [...eligible].sort((a, b) => b.diffPts - a.diffPts);
  const highSalary = eligible.filter(d => d.salary >= DFS_TOP_TIER_THRESHOLD).sort((a, b) => b.diffPts - a.diffPts);
  const starCount = rosterSize <= 5 ? 3 : 2;  // FD: 3 studs of 5, DK: 2 studs of 6
  const stars = highSalary.slice(0, starCount);
  if (stars.length < starCount) {
    // Fallback: top by pts regardless of salary
    const fallbackStars = byPts.slice(0, starCount).filter(d => d.salary > 0);
    if (fallbackStars.length < starCount) return null;
    stars.length = 0;
    stars.push(...fallbackStars);
  }
  const starNums = new Set(stars.map(d => d.num));
  let remaining  = salaryCap - stars.reduce((s, d) => s + d.salary, 0);
  // Fill rest with best value (cheapest good drivers)
  const byValue = [...eligible].sort((a, b) => b.value - a.value);
  const scrubs = [];
  for (const d of byValue) {
    if (starNums.has(d.num)) continue;
    if (d.salary <= 0 || d.salary > remaining) continue;
    scrubs.push(d);
    remaining -= d.salary;
    if (stars.length + scrubs.length >= rosterSize) break;
  }
  const lineup = [...stars, ...scrubs];
  return lineup.length === rosterSize ? lineup : null;
}

// Balanced: One driver from each salary tier, picking best value within each tier


export function dfsBalancedLineup(eligible, rosterSize, salaryCap) {
  const bySalary = [...eligible].filter(d => d.salary > 0).sort((a, b) => b.salary - a.salary);
  if (bySalary.length < rosterSize) return null;
  const tierSize = Math.ceil(bySalary.length / rosterSize);
  const tiers = [];
  for (let i = 0; i < rosterSize; i++) {
    tiers.push(bySalary.slice(i * tierSize, (i + 1) * tierSize));
  }
  const lineup = [];
  let remaining = salaryCap;
  const used = new Set();
  // First pass: pick best pts from each tier
  for (const tier of tiers) {
    const tierByPts = [...tier].sort((a, b) => b.diffPts - a.diffPts);
    let picked = false;
    for (const d of tierByPts) {
      if (used.has(d.num) || d.salary > remaining) continue;
      lineup.push(d);
      remaining -= d.salary;
      used.add(d.num);
      picked = true;
      break;
    }
    if (!picked) {
      // Fallback: any eligible driver
      for (const d of [...eligible].sort((a, b) => b.diffPts - a.diffPts)) {
        if (used.has(d.num) || d.salary <= 0 || d.salary > remaining) continue;
        lineup.push(d);
        remaining -= d.salary;
        used.add(d.num);
        break;
      }
    }
  }
  return lineup.length === rosterSize ? lineup : null;
}

// Contrarian: Skip top chalk picks, build from mid-tier for low-ownership upside


export function dfsContrarianLineup(eligible, rosterSize, salaryCap) {
  const byPts = [...eligible].sort((a, b) => b.diffPts - a.diffPts);
  const skipCount = rosterSize <= 5 ? 3 : 5;  // FD: skip top 3, DK: skip top 5
  const topNums = new Set(byPts.slice(0, skipCount).map(d => d.num));
  const pool = [...eligible].filter(d => !topNums.has(d.num));
  // Pick by value among non-chalk
  const byValue = [...pool].sort((a, b) => b.value - a.value);
  return dfsGreedyLineup(byValue, rosterSize, salaryCap);
}

// Max Points: Simply take highest projected pts drivers that fit under cap


export function dfsMaxPointsLineup(eligible, rosterSize, salaryCap) {
  const byPts = [...eligible].sort((a, b) => b.diffPts - a.diffPts);
  return dfsGreedyLineup(byPts, rosterSize, salaryCap);
}

// Build a lineup enforcing locked drivers, then filling remaining spots from pool


export function dfsLockedLineup(locked, eligible, rosterSize, salaryCap, fillStrategy) {
  if (!locked || locked.length === 0) return null;
  const lockedNums = new Set(locked.map(d => d.num));
  const lockedSal = locked.reduce((s, d) => s + d.salary, 0);
  const remainingCap = salaryCap - lockedSal;
  const remainingSpots = rosterSize - locked.length;
  if (remainingSpots <= 0 || remainingCap < 0) return null;
  const pool = eligible.filter(d => !lockedNums.has(d.num));
  let fill = null;
  if (fillStrategy === "maxPts") {
    const byPts = [...pool].sort((a, b) => b.diffPts - a.diffPts);
    fill = dfsGreedyLineup(byPts, remainingSpots, remainingCap);
  } else if (fillStrategy === "value") {
    const byVal = [...pool].sort((a, b) => b.value - a.value);
    fill = dfsGreedyLineup(byVal, remainingSpots, remainingCap);
  } else if (fillStrategy === "contrarian") {
    // Skip top chalk among non-locked
    const byPts = [...pool].sort((a, b) => b.diffPts - a.diffPts);
    const skipCt = Math.min(3, pool.length - remainingSpots);
    const topNums = new Set(byPts.slice(0, skipCt).map(d => d.num));
    const nonChalk = pool.filter(d => !topNums.has(d.num));
    const byVal = [...nonChalk].sort((a, b) => b.value - a.value);
    fill = dfsGreedyLineup(byVal, remainingSpots, remainingCap) || dfsGreedyLineup([...pool].sort((a,b)=>b.value-a.value), remainingSpots, remainingCap);
  } else if (fillStrategy === "balanced") {
    const withCap = pool.filter(d => d.salary > 0 && d.salary <= remainingCap);
    withCap.sort((a, b) => b.salary - a.salary);
    const tierSize = Math.max(1, Math.ceil(withCap.length / remainingSpots));
    const picks = []; let usedCap = 0; const used = new Set();
    for (let i = 0; i < remainingSpots; i++) {
      const tier = withCap.slice(i * tierSize, (i + 1) * tierSize).sort((a, b) => b.diffPts - a.diffPts);
      for (const d of tier) {
        if (!used.has(d.num) && d.salary <= remainingCap - usedCap) {
          picks.push(d); used.add(d.num); usedCap += d.salary; break;
        }
      }
    }
    fill = picks.length === remainingSpots ? picks : null;
    if (!fill) { const byVal = [...pool].sort((a,b)=>b.value-a.value); fill = dfsGreedyLineup(byVal, remainingSpots, remainingCap); }
  } else {
    // scrubs (stars & scrubs fill)
    const byVal = [...pool].sort((a, b) => b.value - a.value);
    fill = dfsGreedyLineup(byVal, remainingSpots, remainingCap);
  }
  if (!fill) return null;
  return [...locked, ...fill];
}


export function dfsOptimizeLineups(projections, rosterSize, salaryCap, count, lockedDrivers) {
  const eligible = projections.filter(p => p.salary > 0 && p.diffPts > 0);
  if (eligible.length < rosterSize) return [];
  const locked = (lockedDrivers || []).filter(p => eligible.some(e => e.num === p.num));
  const hasLocks = locked.length > 0;
  const lineups = [];
  const seen    = new Set();
  const tryAdd = (rawLineup, strategy) => {
    if (!rawLineup) return;
    // For locked lineups, skip dfsValidateLineup's top-tier check since locked drivers are user choice
    let lineup;
    if (hasLocks) {
      // Only enforce salary cap and floor; don't force additional studs on top of locks
      lineup = dfsUpgradeLineup(rawLineup, eligible.filter(d => !locked.some(l => l.num === d.num)), salaryCap);
      if (!lineup || lineup.length !== rosterSize) lineup = rawLineup.length === rosterSize ? rawLineup : null;
      if (lineup && lineup.reduce((s, d) => s + d.salary, 0) > salaryCap) lineup = null;
    } else {
      lineup = dfsValidateLineup(rawLineup, eligible, rosterSize, salaryCap);
    }
    if (!lineup) return;
    const key = lineup.map(d => d.num).sort().join(",");
    if (seen.has(key)) return;
    seen.add(key);
    const totalSalary  = lineup.reduce((s, d) => s + d.salary, 0);
    const totalPts     = lineup.reduce((s, d) => s + d.projectedPts, 0);
    const totalDiffPts = lineup.reduce((s, d) => s + d.diffPts, 0);
    lineups.push({
      drivers: lineup.sort((a, b) => b.diffPts - a.diffPts),
      strategy,
      totalSalary,
      totalPts: Math.round(totalPts * 10) / 10,
      totalDiffPts: Math.round(totalDiffPts * 10) / 10,
      remaining: salaryCap - totalSalary,
      hasLocks,
    });
  };

  if (hasLocks) {
    // Generate strategies around locked drivers
    tryAdd(dfsLockedLineup(locked, eligible, rosterSize, salaryCap, "maxPts"), "Max Points 🔒");
    tryAdd(dfsLockedLineup(locked, eligible, rosterSize, salaryCap, "scrubs"), "Stars & Scrubs 🔒");
    tryAdd(dfsLockedLineup(locked, eligible, rosterSize, salaryCap, "balanced"), "Balanced 🔒");
    tryAdd(dfsLockedLineup(locked, eligible, rosterSize, salaryCap, "contrarian"), "Contrarian 🔒");
    tryAdd(dfsLockedLineup(locked, eligible, rosterSize, salaryCap, "value"), "Best Value 🔒");
  } else {
    // Generate diverse strategies
    tryAdd(dfsMaxPointsLineup(eligible, rosterSize, salaryCap), "Max Points");
    tryAdd(dfsStarsAndScrubs(eligible, rosterSize, salaryCap), "Stars & Scrubs");
    tryAdd(dfsBalancedLineup(eligible, rosterSize, salaryCap), "Balanced");
    tryAdd(dfsContrarianLineup(eligible, rosterSize, salaryCap), "Contrarian");
    const byValue = [...eligible].sort((a, b) => b.value - a.value);
    tryAdd(dfsGreedyLineup(byValue, rosterSize, salaryCap), "Best Value");
  }

  // If we still have few lineups, try variations with different stud anchors
  if (lineups.length < 3) {
    const topDrivers = [...eligible].sort((a, b) => b.diffPts - a.diffPts).slice(0, 6);
    for (let i = 0; i < topDrivers.length && lineups.length < 5; i++) {
      const anchor = topDrivers[i];
      if (hasLocks && locked.some(l => l.num === anchor.num)) continue;
      const anchorSet = hasLocks ? [...locked, anchor] : [anchor];
      const anchorSal = anchorSet.reduce((s, d) => s + d.salary, 0);
      if (anchorSal > salaryCap) continue;
      const rest = eligible.filter(d => !anchorSet.some(a => a.num === d.num));
      const byVal = [...rest].sort((a, b) => b.value - a.value);
      const fill = dfsGreedyLineup(byVal, rosterSize - anchorSet.length, salaryCap - anchorSal);
      if (fill) {
        tryAdd([...anchorSet, ...fill], `Anchor: ${anchor.driver.split(" ").pop()}${hasLocks ? " 🔒" : ""}`);
      }
    }
  }

  lineups.sort((a, b) => b.totalDiffPts - a.totalDiffPts);
  return lineups.slice(0, count || 5);
}

// §5 DFS TAB — Public-facing component


export function DFSTab({ csvData, dfsSalaries, dfsDisabled, qualPractice, incrementTool }) {
  const [platform, setPlatform]         = useState("dk");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [viewMode, setViewMode]         = useState("top");
  const [lineups, setLineups]           = useState([]);
  const [allProjections, setAllProjections] = useState([]);
  const [customLineup, setCustomLineup] = useState([]);
  const [customSearch, setCustomSearch] = useState("");
  const [lockedDrivers, setLockedDrivers] = useState(new Set()); // driver nums (strings)

  useEffect(() => { incrementTool?.("dfs_optimizer"); }, []);

  const plat = DFS_PLATFORMS[platform];
  const race = selectedWeek === "allstar"
    ? SCHEDULE.find(r => r.allStar)
    : SCHEDULE.find(r => !r.allStar && r.week === parseInt(selectedWeek));

  const hasCsv     = csvData.length > 0;
  const salaryData = dfsSalaries?.[platform] || {};
  const hasSalary  = Object.keys(salaryData).length > 0;
  const salaryUpdatedAt = dfsSalaries?.[`${platform}_updated`] || null;

  const maxLocks = plat.rosterSize <= 5 ? 3 : 4; // FD: max 3 of 5, DK: max 4 of 6

  const toggleLock = (num) => {
    setLockedDrivers(prev => {
      const next = new Set(prev);
      if (next.has(num)) { next.delete(num); return next; }
      if (next.size >= maxLocks) return prev; // enforce max
      next.add(num);
      return next;
    });
  };

  const runOptimizer = () => {
    if (!race || !hasCsv) return;
    trackEvent("dfs_optimizer_run", { platform: platform, race_week: race.week, race_name: race.name });
    let projections = dfsProjectPoints(csvData, race, platform, dfsDisabled, qualPractice);
    projections = projections.map(p => {
      const sal = salaryData[p.driver] || 0;
      return { ...p, salary: sal, value: sal > 0 ? Math.round((p.diffPts / (sal / 1000)) * 100) / 100 : 0 };
    });
    setAllProjections(projections);
    if (!hasSalary) { setLineups([]); return; }
    const lockedProjs = projections.filter(p => lockedDrivers.has(p.num) && p.salary > 0);
    const results = dfsOptimizeLineups(projections, plat.rosterSize, plat.salaryCap, 5, lockedProjs);
    setLineups(results);
  };

  const fmtSalary = (s) => "$" + (s || 0).toLocaleString();
  const fmtPts    = (p) => (p || 0).toFixed(1);
  const pctBar    = (used, cap) => Math.min(100, Math.round((used / cap) * 100));
  const col = plat.color;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* DISCLAIMER */}
      <div style={{ padding: "10px 14px", background: "rgba(255,193,7,0.06)", border: `1px solid ${T.gold}25`, borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>⚠</span>
        <div style={{ fontSize: 11, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 700, color: T.gold }}>For entertainment purposes only.</span> This tool is not gambling or betting advice. Projections are based on historical statistics and carry no guarantee of accuracy. Daily fantasy sports involve financial risk — never play with money you cannot afford to lose. Please play responsibly.
        </div>
      </div>

      {/* PLATFORM TOGGLE */}
      <div style={{ display: "flex", gap: 8 }}>
        {Object.values(DFS_PLATFORMS).map(p => {
          const active = platform === p.id;
          return (
            <button key={p.id} onClick={() => { setPlatform(p.id); setLineups([]); setAllProjections([]); }}
              style={{
                flex: "1 1 200px", padding: "14px 18px", borderRadius: 10, cursor: "pointer",
                background: active ? p.colorSoft : T.surface,
                border: `2px solid ${active ? p.color : T.border}`,
                textAlign: "left", transition: "all 0.15s",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: active ? p.color : T.textDim, fontFamily: "'Barlow Condensed',sans-serif" }}>{p.abbr}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: active ? p.color : T.textMid, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: active ? `${p.color}cc` : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
                    {p.rosterSize} drivers · {p.salaryLabel} cap
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* INFO LEGEND */}
      <InfoLegend title="DFS Optimizer Guide">
        <div>
          <div style={{ fontWeight: 700, color: T.text, marginBottom: 6, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, letterSpacing: 1 }}>HOW IT WORKS</div>
          <div style={{ marginBottom: 10, lineHeight: 1.7 }}>
            The optimizer projects DFS fantasy points for each driver using track history, track-type performance, recent form, and laps-led dominance from the CSV data. It then finds the best combination of drivers that maximizes total projected points while staying under the salary cap.
          </div>
          <div style={{ fontWeight: 700, color: T.text, marginBottom: 6, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, letterSpacing: 1 }}>LINEUP STRATEGIES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
            {[
              ["Max Points", "Prioritizes highest raw projected points"],
              ["Stars & Scrubs", platform === "fd"
                ? "Locks in 3 top-salary studs, fills rest with best value"
                : "Locks in 2 top-salary studs, fills rest with bargains"],
              ["Balanced", "Picks one driver from each salary tier"],
              ["Contrarian", platform === "fd"
                ? "Skips the top-3 chalk picks for low-ownership upside"
                : "Skips the top-5 chalk picks for low-ownership upside"],
              ["Best Value", "Fills roster by highest points-per-$1K salary"],
            ].map(([l, d]) => (
              <div key={l}><span style={{ fontWeight: 700, color: col }}>{l}</span> — {d}</div>
            ))}
          </div>
          <div style={{ fontWeight: 700, color: T.text, marginBottom: 6, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, letterSpacing: 1 }}>LINEUP CONSTRAINTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
            {[
              ["Salary Floor", "Lineups must use 90%+ of the salary cap — no wasted budget"],
              ["Top-Tier Stud", "Every lineup requires at least 1 driver from the $9,000+ salary tier"],
              ["Auto-Upgrade", "Cheap slots are swapped for better drivers until salary floor is met"],
            ].map(([l, d]) => (
              <div key={l}><span style={{ fontWeight: 700, color: T.gold }}>{l}</span> — {d}</div>
            ))}
          </div>
          <div style={{ fontWeight: 700, color: T.text, marginBottom: 6, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, letterSpacing: 1 }}>DRIVER VALUE TAGS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {[
              ["Track Ace", "2+ wins at this track"],
              ["Track Winner", "1 win at this track"],
              ["Elite Trk Avg", "Avg finish ≤ 8 (3+ track races)"],
              ["Hot Streak", "Last 5 overall avg ≤ 8"],
              ["Dominator", "Projected 10%+ laps led"],
              ["PD Play", "Place diff upside"],
              ["Type Specialist", "Strong recent type avg"],
              ...(platform === "dk" ? [["Speed Demon", "Projected 15%+ fastest laps (DK only)"]] : []),
            ].map(([tag, desc]) => (
              <span key={tag} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: `${col}15`, border: `1px solid ${col}30`, color: col }}>
                <span style={{ fontWeight: 700 }}>{tag}</span> = {desc}
              </span>
            ))}
          </div>
          <div style={{ fontWeight: 700, color: T.text, marginBottom: 6, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, letterSpacing: 1 }}>
            {platform === "dk" ? "DRAFTKINGS" : "FANDUEL"} SCORING
          </div>
          <div style={{ lineHeight: 1.7, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
            {platform === "dk" ? (
              <>Finish: 1st=46, 2nd=42, 3rd=41…40th=4 · Place Diff: ±1.0/pos · Laps Led: 0.25/lap · Fastest Laps: 0.45/lap · Most Laps Led Bonus: 5pts</>
            ) : (
              <>Finish: 1st=43, 2nd=40, 3rd=38, 4th=37…40th=1 · Place Diff: ±0.5/pos · Laps Led: 0.1/lap · Laps Completed: 0.1/lap</>
            )}
          </div>
        </div>
      </InfoLegend>

      {/* STATUS BADGES */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px", padding: "10px 14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 2 }}>CSV Data</div>
          <div style={{ fontSize: 12, color: hasCsv ? T.green : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
            {hasCsv ? `✓ ${csvData.length.toLocaleString()} records` : "No data loaded"}
          </div>
        </div>
        <div style={{ flex: "1 1 200px", padding: "10px 14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 2 }}>{plat.abbr} Salaries</div>
          <div style={{ fontSize: 12, color: hasSalary ? T.green : T.gold, fontFamily: "'IBM Plex Mono',monospace" }}>
            {hasSalary
              ? `✓ ${Object.keys(salaryData).length} drivers${salaryUpdatedAt ? ` · ${salaryUpdatedAt}` : ""}`
              : "⚠ Upload via Admin Panel"
            }
          </div>
        </div>
        {(() => {
          const raceWeek = race ? (race.allStar ? "allstar" : race.week) : null;
          const qpMatch = qualPractice && raceWeek != null && qualPractice.week === raceWeek;
          const qpQualCount = qpMatch && qualPractice.qualifying ? Object.keys(qualPractice.qualifying).length : 0;
          const qpPracCount = qpMatch && qualPractice.practice ? Object.keys(qualPractice.practice).length : 0;
          return (
            <div style={{ flex: "1 1 200px", padding: "10px 14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 2 }}>🏁 Qualifying</div>
              <div style={{ fontSize: 12, color: qpMatch && qpQualCount > 0 ? T.green : T.gold, fontFamily: "'IBM Plex Mono',monospace" }}>
                {qpMatch && qpQualCount > 0
                  ? `✓ ${raceWeek === "allstar" ? "All-Star" : `Wk ${raceWeek}`} · ${qpQualCount} drivers${qpPracCount > 0 ? ` + Practice${qualPractice?.practiceIsTiming ? " 📊" : ""}` : ""}`
                  : "⚠ No data — using historical estimates"
                }
              </div>
            </div>
          );
        })()}
      </div>

      {/* EXCLUDED DRIVERS */}
      {dfsDisabled?.length > 0 && (
        <div style={{ padding: "8px 14px", background: T.redBg, border: `1px solid ${T.red}30`, borderRadius: 8, fontSize: 11, color: T.red, fontFamily: "'IBM Plex Mono',monospace" }}>
          <span style={{ fontWeight: 700 }}>Excluded drivers:</span>{" "}
          {dfsDisabled.map((d, i) => (
            <span key={d.name}>{i > 0 ? ", " : ""}{d.name}{d.reason ? ` (${d.reason})` : ""}</span>
          ))}
        </div>
      )}

      {/* LOCKED DRIVERS SUMMARY */}
      {lockedDrivers.size > 0 && (() => {
        const lockedList = allProjections.filter(p => lockedDrivers.has(p.num));
        const lockedSal = lockedList.reduce((s, d) => s + d.salary, 0);
        const remainingCap = plat.salaryCap - lockedSal;
        const remainingSpots = plat.rosterSize - lockedDrivers.size;
        return (
          <div style={{ padding: "10px 14px", background: "rgba(251,191,36,0.06)", border: `1px solid ${T.gold}40`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14 }}>🔒</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.gold, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>
                {lockedDrivers.size} DRIVER{lockedDrivers.size !== 1 ? "S" : ""} LOCKED
              </span>
              {lockedList.map(d => (
                <span key={d.num} style={{ fontSize: 11, color: T.text, background: `${T.gold}15`, border: `1px solid ${T.gold}40`, borderRadius: 4, padding: "2px 7px", fontFamily: "'IBM Plex Mono',monospace" }}>
                  {d.driver}
                  <button onClick={() => toggleLock(d.num)} style={{ background: "none", border: "none", color: T.gold, cursor: "pointer", marginLeft: 4, padding: 0, fontSize: 11 }}>✕</button>
                </span>
              ))}
              <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
                ${remainingCap.toLocaleString()} remaining for {remainingSpots} spot{remainingSpots !== 1 ? "s" : ""}
              </span>
            </div>
            <button onClick={() => setLockedDrivers(new Set())}
              style={{ fontSize: 10, padding: "3px 10px", background: "none", border: `1px solid ${T.gold}40`, color: T.gold, borderRadius: 4, cursor: "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
              Clear All
            </button>
          </div>
        );
      })()}

      {/* RACE SELECTOR + RUN */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 300px" }}>
          <label style={{ fontSize: 10, color: T.textDim, display: "block", marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif" }}>Select Race</label>
          <select value={selectedWeek} onChange={e => { setSelectedWeek(e.target.value); setLineups([]); setAllProjections([]); }}
            style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none" }}>
            <option value="">Choose a race…</option>
            {SCHEDULE.map(r => (
              <option key={r.allStar ? "allstar" : r.week} value={r.allStar ? "allstar" : r.week}>
                {r.allStar ? "★" : `Wk ${r.week}`} · {r.date} · {r.name}{r.allStar ? " (Non-Points)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button onClick={runOptimizer} disabled={!race || !hasCsv}
          style={{
            padding: "9px 24px", background: (race && hasCsv) ? col : "#1a2d40",
            color: (race && hasCsv) ? "#fff" : T.textDim, border: "none", borderRadius: 8,
            cursor: (race && hasCsv) ? "pointer" : "default", fontSize: 13, fontWeight: 700,
            fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase",
            boxShadow: (race && hasCsv) ? `0 4px 18px ${plat.colorGlow}` : "none",
          }}>
          {hasSalary ? "Optimize Lineups" : "Preview Projections"}
        </button>
      </div>

      {/* TRACK INFO */}
      {race && (
        <div style={{ padding: "10px 16px", background: `${TC[race.type] || T.accent}10`, border: `1px solid ${TC[race.type] || T.accent}30`, borderRadius: 8, fontSize: 13, color: TC[race.type] || T.accent, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 0.5 }}>
          {race.track} · <span style={{ textTransform: "uppercase" }}>{TL[race.type]}</span> · {race.length} mi · {race.laps} laps
        </div>
      )}

      {/* VIEW MODE TABS */}
      {allProjections.length > 0 && hasSalary && (
        <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${T.border}`, paddingBottom: 0 }}>
          {[
            { id: "top",  label: "Top Lineups" },
            { id: "best", label: "Best Lineup" },
            { id: "custom", label: "Build Your Own" },
            { id: "all",  label: "All Drivers" },
          ].map(tab => {
            const active = viewMode === tab.id;
            return (
              <button key={tab.id} onClick={() => setViewMode(tab.id)}
                style={{ padding: "7px 14px", fontSize: 11, fontWeight: active ? 700 : 500, background: active ? plat.colorSoft : "transparent", color: active ? col : T.textDim, border: "none", borderBottom: `2px solid ${active ? col : "transparent"}`, marginBottom: -1, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* NO SALARY WARNING */}
      {allProjections.length > 0 && !hasSalary && (
        <div style={{ padding: "16px 20px", background: `${T.gold}10`, border: `1px solid ${T.gold}30`, borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.gold, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 6, letterSpacing: 1 }}>SALARY DATA REQUIRED</div>
          <div style={{ fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace" }}>
            Upload {plat.name} salary CSV in the Admin Panel to unlock lineup optimization. Projections below are preview only.
          </div>
        </div>
      )}

      {/* BUILD YOUR OWN LINEUP */}
      {viewMode === "custom" && allProjections.length > 0 && hasSalary && (() => {
        const customPool = allProjections.filter(d => d.salary > 0);
        const customNums = new Set(customLineup.map(d => d.num));
        const totalSalary = customLineup.reduce((s, d) => s + d.salary, 0);
        const totalPts = customLineup.reduce((s, d) => s + d.projectedPts, 0);
        const remaining = plat.salaryCap - totalSalary;
        const isFull = customLineup.length >= plat.rosterSize;
        const bestPts = lineups.length > 0 ? lineups[0].totalPts : 0;
        const filtered = customPool.filter(d => {
          if (customNums.has(d.num)) return false;
          if (customSearch && !d.driver.toLowerCase().includes(customSearch.toLowerCase())) return false;
          return true;
        }).sort((a, b) => b.diffPts - a.diffPts);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Summary bar */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: col, fontFamily: "'Barlow Condensed',sans-serif" }}>
                    {customLineup.length} / {plat.rosterSize}
                  </span>
                  <span style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>drivers selected</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {isFull && (
                    <span style={{ fontSize: 20, fontWeight: 900, color: col, fontFamily: "'Barlow Condensed',sans-serif" }}>{fmtPts(totalPts)} pts</span>
                  )}
                  {customLineup.length > 0 && (
                    <button onClick={() => { setCustomLineup([]); setCustomSearch(""); }}
                      style={{ padding: "4px 10px", fontSize: 10, fontWeight: 700, color: T.red, background: T.redBg, border: `1px solid ${T.red}30`, borderRadius: 6, cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 0.5 }}>
                      Clear All
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginBottom: 4, letterSpacing: 1 }}>
                <span>SALARY: {fmtSalary(totalSalary)} / {fmtSalary(plat.salaryCap)}</span>
                <span>{fmtSalary(remaining)} remaining</span>
              </div>
              <div style={{ height: 6, background: T.surface3, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pctBar(totalSalary, plat.salaryCap)}%`, background: pctBar(totalSalary, plat.salaryCap) >= 90 ? `linear-gradient(90deg, ${T.green}, ${T.green}88)` : `linear-gradient(90deg, ${col}, ${col}88)`, borderRadius: 3, transition: "width 0.3s ease" }} />
              </div>
              {/* Selected drivers mini-list */}
              {customLineup.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[...customLineup].sort((a, b) => b.diffPts - a.diffPts).map(d => (
                    <div key={d.num} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", background: `${col}12`, border: `1px solid ${col}30`, borderRadius: 6, fontSize: 11, color: T.text, fontFamily: "'IBM Plex Mono',monospace" }}>
                      <span style={{ fontWeight: 700, color: col }}>#{d.num}</span> {d.driver.split(" ").pop()}
                      <span style={{ color: T.textDim, fontSize: 9 }}>{fmtSalary(d.salary)}</span>
                      <button onClick={() => setCustomLineup(prev => prev.filter(p => p.num !== d.num))}
                        style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completed lineup card */}
            {isFull && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: `${col}08` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: col, fontFamily: "'Barlow Condensed',sans-serif" }}>✎</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>Your Lineup</div>
                      <div style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
                        {customLineup.length} drivers · {fmtSalary(totalSalary)} used · {fmtSalary(remaining)} left
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: col, fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1 }}>{fmtPts(totalPts)}</div>
                    <div style={{ fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1 }}>PROJ PTS</div>
                  </div>
                </div>
                <div style={{ padding: "8px 16px", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginBottom: 4, letterSpacing: 1 }}>
                    <span>SALARY CAP {pctBar(totalSalary, plat.salaryCap) >= 90 ? "" : "⚠ BELOW FLOOR"}</span>
                    <span>{pctBar(totalSalary, plat.salaryCap)}% used</span>
                  </div>
                  <div style={{ height: 6, background: T.surface3, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pctBar(totalSalary, plat.salaryCap)}%`, background: pctBar(totalSalary, plat.salaryCap) >= 90 ? `linear-gradient(90deg, ${T.green}, ${T.green}88)` : `linear-gradient(90deg, ${col}, ${col}88)`, borderRadius: 3, transition: "width 0.3s ease" }} />
                  </div>
                </div>
                <div>
                  {[...customLineup].sort((a, b) => b.diffPts - a.diffPts).map((d, di) => {
                    const tierColor = di === 0 ? T.gold : di < 3 ? col : T.textMid;
                    return (
                      <div key={d.num} style={{ padding: "10px 16px", borderBottom: di < customLineup.length - 1 ? `1px solid ${T.border}` : "none", display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${tierColor}18`, border: `1px solid ${tierColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: tierColor, flexShrink: 0, fontFamily: "'Barlow Condensed',sans-serif" }}>{di + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>#{d.num} {d.driver}</span>
                            {d.rookie && <span style={{ fontSize: 8, fontWeight: 700, color: "#4ade80", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 3, padding: "1px 5px", letterSpacing: 0.8 }}>ROOKIE</span>}
                          </div>
                          <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{d.team} · {d.mfg}</div>
                          <div style={{ display: "flex", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
                            {[
                              ["Proj Fin", d.projFinish, col],
                              ["Trk Avg", d.trackAvg, TC[race?.type] || T.accent],
                              ["Recent", d.recentAvg, T.accentText],
                              ["Laps Led", d.projLapsLed, T.gold],
                              ...(platform === "dk" ? [["Fast Laps", d.projectedFL || 0, T.green]] : []),
                            ].map(([l, v, c]) => (
                              <div key={l} style={{ fontSize: 10 }}>
                                <span style={{ color: T.textDim }}>{l}: </span>
                                <span style={{ color: c, fontWeight: 700 }}>{v}</span>
                              </div>
                            ))}
                          </div>
                          {d.tags?.length > 0 && (
                            <div style={{ marginTop: 4, display: "flex", gap: 3, flexWrap: "wrap" }}>
                              {d.tags.map(t => (
                                <span key={t} style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${col}18`, color: col, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 0.5 }}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: col, fontFamily: "'Barlow Condensed',sans-serif" }}>{fmtPts(d.projectedPts)}</div>
                          <div style={{ fontSize: 11, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace" }}>{fmtSalary(d.salary)}</div>
                          <div style={{ fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{d.value.toFixed(1)} pts/$K</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Comparison line */}
            {isFull && bestPts > 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 16, padding: "10px 0", fontSize: 12, fontFamily: "'IBM Plex Mono',monospace" }}>
                <span style={{ color: T.textDim }}>Optimizer Best: <span style={{ fontWeight: 700, color: T.text }}>{fmtPts(bestPts)}</span></span>
                <span style={{ color: T.textDim }}>Your Lineup: <span style={{ fontWeight: 700, color: col }}>{fmtPts(totalPts)}</span></span>
                <span style={{ color: totalPts >= bestPts ? T.green : T.red, fontWeight: 700 }}>
                  {totalPts >= bestPts ? "+" : ""}{fmtPts(totalPts - bestPts)}
                </span>
              </div>
            )}

            {/* Driver picker */}
            {!isFull && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.border}` }}>
                  <input
                    type="text" placeholder="Search drivers…" value={customSearch} onChange={e => setCustomSearch(e.target.value)}
                    style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "8px 12px", fontSize: 12, outline: "none", fontFamily: "'IBM Plex Mono',monospace", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ maxHeight: 420, overflowY: "auto" }}>
                  {filtered.map(d => {
                    const tooExpensive = d.salary > remaining;
                    return (
                      <div key={d.num} style={{ padding: "8px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, opacity: tooExpensive ? 0.4 : 1 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>#{d.num} {d.driver}{d.rookie && <span style={{ fontSize: 8, color: "#4ade80", marginLeft: 5 }}>ROOKIE</span>}</div>
                          <div style={{ fontSize: 10, color: T.textDim }}>{d.team} · {d.mfg}</div>
                          <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 9, color: T.textDim }}>Proj: <span style={{ color: col, fontWeight: 700 }}>{fmtPts(d.projectedPts)}</span></span>
                            <span style={{ fontSize: 9, color: T.textDim }}>Fin: <span style={{ fontWeight: 700, color: T.text }}>{d.projFinish}</span></span>
                            <span style={{ fontSize: 9, color: T.textDim }}>Val: <span style={{ fontWeight: 700, color: T.text }}>{d.value.toFixed(1)}</span></span>
                          </div>
                          {d.tags?.length > 0 && (
                            <div style={{ marginTop: 3, display: "flex", gap: 3, flexWrap: "wrap" }}>
                              {d.tags.map(t => (
                                <span key={t} style={{ fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: `${col}18`, color: col, fontFamily: "'IBM Plex Mono',monospace" }}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginRight: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace" }}>{fmtSalary(d.salary)}</div>
                        </div>
                        <button onClick={() => { if (!tooExpensive) setCustomLineup(prev => [...prev, d]); }}
                          disabled={tooExpensive}
                          style={{ padding: "5px 12px", fontSize: 10, fontWeight: 700, color: tooExpensive ? T.textDim : "#fff", background: tooExpensive ? T.surface2 : col, border: "none", borderRadius: 6, cursor: tooExpensive ? "default" : "pointer", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase", flexShrink: 0 }}>
                          Add
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* LINEUP CARDS */}
      {viewMode !== "all" && viewMode !== "custom" && lineups.length > 0 && (() => {
        const displayLineups = viewMode === "best" ? lineups.slice(0, 1) : lineups;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {displayLineups.map((lu, idx) => (
              <div key={idx} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                {/* Header */}
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: `${col}08` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: col, fontFamily: "'Barlow Condensed',sans-serif" }}>#{idx + 1}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>{lu.strategy}</div>
                      <div style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
                        {lu.drivers.length} drivers · {fmtSalary(lu.totalSalary)} used · {fmtSalary(lu.remaining)} left
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: col, fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1 }}>{fmtPts(lu.totalPts)}</div>
                    <div style={{ fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1 }}>PROJ PTS</div>
                  </div>
                </div>
                {/* Salary cap bar */}
                <div style={{ padding: "8px 16px", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginBottom: 4, letterSpacing: 1 }}>
                    <span>SALARY CAP {pctBar(lu.totalSalary, plat.salaryCap) >= 90 ? "" : "⚠ BELOW FLOOR"}</span>
                    <span>{pctBar(lu.totalSalary, plat.salaryCap)}% used</span>
                  </div>
                  <div style={{ height: 6, background: T.surface3, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pctBar(lu.totalSalary, plat.salaryCap)}%`, background: pctBar(lu.totalSalary, plat.salaryCap) >= 90 ? `linear-gradient(90deg, ${T.green}, ${T.green}88)` : `linear-gradient(90deg, ${col}, ${col}88)`, borderRadius: 3, transition: "width 0.3s ease" }} />
                  </div>
                </div>
                {/* Driver rows */}
                <div>
                  {lu.drivers.map((d, di) => {
                    const tierColor = di === 0 ? T.gold : di < 3 ? col : T.textMid;
                    return (
                      <div key={d.num} style={{ padding: "10px 16px", borderBottom: di < lu.drivers.length - 1 ? `1px solid ${T.border}` : "none", display: "flex", alignItems: "center", gap: 12, background: lockedDrivers.has(d.num) ? `${T.gold}05` : "transparent" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${tierColor}18`, border: `1px solid ${tierColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: tierColor, flexShrink: 0, fontFamily: "'Barlow Condensed',sans-serif" }}>{di + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>#{d.num} {d.driver}</span>
                            {d.rookie && <span style={{ fontSize: 8, fontWeight: 700, color: "#4ade80", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 3, padding: "1px 5px", letterSpacing: 0.8 }}>ROOKIE</span>}
                            {lockedDrivers.has(d.num) && <span style={{ fontSize: 8, fontWeight: 700, color: T.gold, background: `${T.gold}15`, border: `1px solid ${T.gold}40`, borderRadius: 3, padding: "1px 5px", letterSpacing: 0.8 }}>🔒 LOCKED</span>}
                          </div>
                          <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{d.team} · {d.mfg}</div>
                          <div style={{ display: "flex", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
                            {[
                              ["Proj Fin", d.projFinish, col],
                              ["Trk Avg", d.trackAvg, TC[race?.type] || T.accent],
                              ["Recent", d.recentAvg, T.accentText],
                              ["Laps Led", d.projLapsLed, T.gold],
                              ...(platform === "dk" ? [["Fast Laps", d.projectedFL || 0, T.green]] : []),
                            ].map(([l, v, c]) => (
                              <div key={l} style={{ fontSize: 10 }}>
                                <span style={{ color: T.textDim }}>{l}: </span>
                                <span style={{ color: c, fontWeight: 700 }}>{v}</span>
                              </div>
                            ))}
                          </div>
                          {d.tags?.length > 0 && (
                            <div style={{ marginTop: 4, display: "flex", gap: 3, flexWrap: "wrap" }}>
                              {d.tags.map(t => (
                                <span key={t} style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${col}18`, color: col, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 0.5 }}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: col, fontFamily: "'Barlow Condensed',sans-serif" }}>{fmtPts(d.projectedPts)}</div>
                          <div style={{ fontSize: 11, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace" }}>{fmtSalary(d.salary)}</div>
                          <div style={{ fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{d.value.toFixed(1)} pts/$K</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ALL DRIVERS TABLE */}
      {(viewMode === "all" || (allProjections.length > 0 && !hasSalary)) && allProjections.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: col, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>
              {plat.abbr} PROJECTIONS — {allProjections.length} drivers
            </div>
            {hasSalary && (
              <div style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
                🔒 Lock up to {maxLocks} drivers · forces inclusion in every lineup
              </div>
            )}
          </div>
          {allProjections.map((d, i) => {
            const tierColor = i === 0 ? T.gold : i < 3 ? col : i < 10 ? T.accentText : T.textMid;
            const isLocked = lockedDrivers.has(d.num);
            const canLock = hasSalary && (isLocked || lockedDrivers.size < maxLocks);
            return (
              <div key={d.num} style={{ background: isLocked ? `${T.gold}0a` : (i < 3 ? `${col}08` : T.surface), border: `1px solid ${isLocked ? T.gold + "50" : (i < 3 ? `${col}40` : T.border)}`, borderLeft: `3px solid ${isLocked ? T.gold : tierColor}`, borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${tierColor}18`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: tierColor, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>#{d.num} {d.driver}{d.rookie && <span style={{ fontSize: 8, color: "#4ade80", marginLeft: 5 }}>ROOKIE</span>}</div>
                    <div style={{ fontSize: 10, color: T.textDim }}>{d.team} · {d.mfg}</div>
                    <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                      {[
                        ["Proj Fin", d.projFinish],
                        ["Trk Avg", d.trackAvg],
                        ["Type Avg", d.typeAvg],
                        ["Recent", d.recentAvg],
                        ["Led", d.projLapsLed],
                        ...(platform === "dk" ? [["FL", d.projectedFL || 0]] : []),
                        ...(d.top15Pct != null ? [["Top15%", d.top15Pct + "%"]] : []),
                        ...(d.histPassDiff != null ? [["Pass +/-", (d.histPassDiff > 0 ? "+" : "") + d.histPassDiff]] : []),
                      ].map(([l, v]) => (
                        <span key={l} style={{ fontSize: 10 }}><span style={{ color: T.textDim }}>{l}: </span><span style={{ fontWeight: 700, color: T.text }}>{v}</span></span>
                      ))}
                    </div>
                    {d.tags?.length > 0 && (
                      <div style={{ marginTop: 3, display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {d.tags.map(t => (
                          <span key={t} style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${col}18`, color: col, fontFamily: "'IBM Plex Mono',monospace" }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: col, fontFamily: "'Barlow Condensed',sans-serif" }}>{fmtPts(d.projectedPts)}</div>
                      <div style={{ fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>PROJ PTS</div>
                      {d.salary > 0 && (
                        <>
                          <div style={{ fontSize: 11, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", marginTop: 2 }}>{fmtSalary(d.salary)}</div>
                          <div style={{ fontSize: 9, color: T.green, fontFamily: "'IBM Plex Mono',monospace" }}>{d.value.toFixed(1)} pts/$K</div>
                        </>
                      )}
                    </div>
                    {hasSalary && (
                      <button onClick={() => canLock && toggleLock(d.num)}
                        disabled={!canLock}
                        title={isLocked ? "Unlock driver" : (lockedDrivers.size >= maxLocks ? `Max ${maxLocks} locks` : "Lock this driver")}
                        style={{
                          padding: "3px 9px", fontSize: 11, fontWeight: 700,
                          background: isLocked ? `${T.gold}20` : "transparent",
                          border: `1px solid ${isLocked ? T.gold : (canLock ? T.border2 : T.border)}`,
                          color: isLocked ? T.gold : (canLock ? T.textMid : T.textDim),
                          borderRadius: 5, cursor: canLock ? "pointer" : "default",
                          fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5,
                          transition: "all 0.15s",
                        }}>
                        {isLocked ? "🔒 Locked" : "🔓 Lock"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EMPTY STATE */}
      {allProjections.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: T.textDim, fontSize: 13, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, fontFamily: "'IBM Plex Mono',monospace" }}>
          Select a race and click "{hasSalary ? "Optimize Lineups" : "Preview Projections"}" to generate {plat.name} DFS lineups
        </div>
      )}
    </div>
  );
}

// §6 DFS ADMIN SECTION
