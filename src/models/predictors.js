// ───────────────────────────────────────────────────────────
// PREDICTOR ENGINES - extracted from NASCARHub.jsx (phase 1)
// ───────────────────────────────────────────────────────────
import { INITIAL_DRIVERS, FULL_TIMER_NAMES } from "../data/drivers.js";

// ─────────────────────────────────────────────────────────────
// PREDICTOR ENGINES — Pure Stats & Enhanced Pure Stats
// Translated directly from pure_stats_predictor.py and
// nascar_enhanced_pure_stats.py
// ─────────────────────────────────────────────────────────────

// Track type classifier for predictor engines (matches Python)
const PRED_ROAD_COURSES = [
  'Circuit Of The Americas','Sonoma Raceway','Watkins Glen International Raceway',
  'Watkins Glen International','Road America','Chicago Street Course',
  'Indianapolis Motor Speedway','Autodromo Hermanos Rodriguez',
  'San Diego Road Course','Charlotte Motor Speedway (ROVAL)',
  'Naval Base Coronado Street Course',
];
const PRED_SHORT_TRACKS = ['Martinsville Speedway','Bristol Motor Speedway','Richmond Raceway','North Wilkesboro Speedway','Iowa Speedway','New Hampshire Motor Speedway'];
const PRED_SUPERSPEEDWAYS = ['Daytona International Speedway','Talladega Superspeedway','Echopark Speedway','Atlanta Motor Speedway'];
const PRED_DIRT_TRACKS = ['Bristol Motor Speedway (DIRT)'];

export function predGetTrackType(trackName, year) {
  const tl = (trackName||"").toLowerCase();
  // Indianapolis ran the road course in 2022-2023 and the oval from 2024 on.
  if (tl.includes("indianapolis motor speedway")) {
    return (year != null && year >= 2024) ? 'intermediate' : 'road_course';
  }
  if (PRED_DIRT_TRACKS.some(r => tl.includes(r.toLowerCase()))) return 'dirt';
  if (PRED_ROAD_COURSES.some(r => tl.includes(r.toLowerCase()))) return 'road_course';
  if (PRED_SHORT_TRACKS.some(r => tl.includes(r.toLowerCase()))) return 'short_track';
  if (PRED_SUPERSPEEDWAYS.some(r => tl.includes(r.toLowerCase()))) return 'superspeedway';
  return 'intermediate';
}

// Map SCHEDULE track names to CSV track names for fuzzy matching
// Schedule → CSV track name aliases (where names differ)
const PRED_TRACK_ALIASES = {
  "dover motor speedway": "dover international speedway",
  "atlanta motor speedway": "echopark speedway",
};

export function predMatchTrack(scheduleTrack, csvTrack) {
  const a = scheduleTrack.toLowerCase().replace(/[^a-z0-9 ]/g,"").trim();
  const b = csvTrack.toLowerCase().replace(/[^a-z0-9 ]/g,"").trim();
  // Check alias first
  const aliasA = PRED_TRACK_ALIASES[a] || a;
  const aliasB = PRED_TRACK_ALIASES[b] || b;
  const a2 = aliasA.replace(/[^a-z0-9]/g,"");
  const b2 = aliasB.replace(/[^a-z0-9]/g,"");
  return a2 === b2 || a2.includes(b2) || b2.includes(a2);
}

// CSV row indices: [0:driver, 1:track, 2:year, 3:finish, 4:start, 5:lapsLed, 6:running, 7:manufacturer, 8:lapsCompleted, 9:raceDate, 10:status,
//   11:fastestLaps, 12:raceTotalLaps, 13:passDifferential, 14:qualityPasses, 15:driverRating, 16:avgRunningPos,
//   17:midRunningPos, 18:closerRunningPos, 19:bestRunningPos, 20:worstRunningPos,
//   21:greenFlagPasses, 22:greenFlagTimesPassed, 23:lapsInTop15, 24:lapsInTop15Pct, 25:lapsLedPct]

export function predBuildDriverIndex(csvData) {
  const idx = {};
  for (const r of csvData) {
    const d = r[0];
    if (!d) continue;
    if (!idx[d]) idx[d] = [];
    idx[d].push(r);
  }
  return idx;
}

// ── Pure Stats Predictor (from pure_stats_predictor.py) ──
export function runPureStatsPrediction(csvData, scheduleTrack, scheduleType, scheduleYear) {
  const driverIdx = predBuildDriverIndex(csvData);
  const trackType = predGetTrackType(scheduleTrack, scheduleYear);
  const predictions = [];

  for (const driverName of FULL_TIMER_NAMES) {
    const rows = driverIdx[driverName];
    if (!rows || rows.length === 0) continue;

    // Sort by date (index 9) to get recent races
    const sorted = [...rows].sort((a,b) => (a[9]||"").localeCompare(b[9]||""));

    // Recent form (last 5)
    const recent = sorted.slice(-5);
    const recentAvg = recent.reduce((s,r)=>s+r[3],0)/recent.length;

    // Track-specific
    const trackRows = rows.filter(r => predMatchTrack(scheduleTrack, r[1]));
    const trackAvg = trackRows.length > 0 ? trackRows.reduce((s,r)=>s+r[3],0)/trackRows.length : 20.0;
    const trackWins = trackRows.filter(r => r[3]===1).length;
    const trackRaces = trackRows.length;

    // Track-type performance
    const typeRows = rows.filter(r => predGetTrackType(r[1], r[2]) === trackType);
    const typeAvg = typeRows.length > 0 ? typeRows.reduce((s,r)=>s+r[3],0)/typeRows.length : 20.0;
    const typeWins = typeRows.filter(r => r[3]===1).length;
    const typeRaces = typeRows.length;

    // Calculate score (lower = better) — exact Python logic
    let score;
    if (trackRaces >= 3) {
      score = trackAvg*0.6 + typeAvg*0.3 + recentAvg*0.1;
    } else if (typeRaces >= 5) {
      score = typeAvg*0.7 + recentAvg*0.3;
    } else {
      score = typeAvg*0.5 + recentAvg*0.5;
    }

    // Win bonuses (exact Python logic)
    if (trackWins > 0) score *= 0.8;
    if (typeWins > 2) score *= 0.9;

    // Convert to probabilities (exact Python logic)
    const winProb  = Math.max(5, Math.min(95, 100 - score*2.5)) / 100;
    const top5Prob = Math.max(10, Math.min(95, 110 - score*2.0)) / 100;
    const top10Prob = Math.max(20, Math.min(95, 120 - score*1.5)) / 100;

    // Find driver info from INITIAL_DRIVERS for display
    const dInfo = INITIAL_DRIVERS.find(d => d.name === driverName);

    predictions.push({
      driver: driverName,
      num: dInfo?.num || "?",
      team: dInfo?.team || "",
      mfg: dInfo?.mfg || "",
      rookie: dInfo?.rookie || false,
      score,
      winPct: (winProb*100).toFixed(1),
      top5Pct: (top5Prob*100).toFixed(1),
      top10Pct: (top10Prob*100).toFixed(1),
      trackAvg: trackAvg.toFixed(1),
      trackWins,
      typeAvg: typeAvg.toFixed(1),
      typeWins,
      recentAvg: recentAvg.toFixed(1),
      bonuses: "",
    });
  }

  predictions.sort((a,b) => a.score - b.score);
  return predictions;
}

// ── Enhanced Pure Stats Predictor (from nascar_enhanced_pure_stats.py) ──
const ENH_MFR_STRONG_TRACKS = {
  'Chevrolet': ['Martinsville Speedway','Phoenix Raceway','Richmond Raceway'],
  'Ford': ['Daytona International Speedway','Talladega Superspeedway','Michigan International Speedway'],
  'Toyota': ['Bristol Motor Speedway','Darlington Raceway','Richmond Raceway'],
};
const ENH_PLAYOFF_TRACKS = [
  'Darlington Raceway','World Wide Technology Raceway','Bristol Motor Speedway','Kansas Speedway',
  'Las Vegas Motor Speedway','Charlotte Motor Speedway','Phoenix Raceway',
  'Talladega Superspeedway','Martinsville Speedway','Homestead-Miami Speedway',
];

export function runEnhancedPureStatsPrediction(csvData, scheduleTrack, scheduleType, scheduleYear) {
  const driverIdx = predBuildDriverIndex(csvData);
  const trackType = predGetTrackType(scheduleTrack, scheduleYear);
  const predictions = [];

  for (const driverName of FULL_TIMER_NAMES) {
    const rows = driverIdx[driverName];
    if (!rows || rows.length === 0) continue;

    const sorted = [...rows].sort((a,b) => (a[9]||"").localeCompare(b[9]||""));

    // Recent 5 overall
    const recent = sorted.slice(-5);
    const recentAvg = recent.reduce((s,r)=>s+r[3],0)/recent.length;
    const recentWins = recent.filter(r=>r[3]===1).length;

    // Track-specific
    const trackRows = rows.filter(r => predMatchTrack(scheduleTrack, r[1]));
    const trackAvg = trackRows.length > 0 ? trackRows.reduce((s,r)=>s+r[3],0)/trackRows.length : 20.0;
    const trackWins = trackRows.filter(r=>r[3]===1).length;
    const trackRaces = trackRows.length;

    // Track-type
    const typeRows = rows.filter(r => predGetTrackType(r[1], r[2]) === trackType);
    const typeAvg = typeRows.length > 0 ? typeRows.reduce((s,r)=>s+r[3],0)/typeRows.length : 20.0;
    const typeWins = typeRows.filter(r=>r[3]===1).length;
    const typeRaces = typeRows.length;

    // Starting position
    const avgStartTrack = trackRows.length > 0 ? trackRows.reduce((s,r)=>s+r[4],0)/trackRows.length : 20.0;
    const avgStartType = typeRows.length > 0 ? typeRows.reduce((s,r)=>s+r[4],0)/typeRows.length : 20.0;

    // Recent at track type (last 3)
    const typeRowsSorted = [...typeRows].sort((a,b)=>(a[9]||"").localeCompare(b[9]||""));
    const recentType = typeRowsSorted.slice(-3);
    const recentTypeAvg = recentType.length > 0 ? recentType.reduce((s,r)=>s+r[3],0)/recentType.length : 20.0;

    // Trend: previous avg - last race (positive = improving)
    let recentTypeTrend = 0;
    if (recentType.length >= 2) {
      const lastRace = recentType[recentType.length-1][3];
      const prevAvg = recentType.slice(0,-1).reduce((s,r)=>s+r[3],0)/(recentType.length-1);
      recentTypeTrend = prevAvg - lastRace;
    }

    // Laps led dominance
    const trackLapsLed = trackRows.reduce((s,r)=>s+r[5],0);
    const trackLapsCompleted = trackRows.reduce((s,r)=>s+r[8],0);
    const trackLapsLedPct = trackLapsCompleted > 0 ? (trackLapsLed/trackLapsCompleted)*100 : 0;

    // Manufacturer
    const mfrCounts = {};
    rows.forEach(r => { const m = r[7]; if(m) mfrCounts[m] = (mfrCounts[m]||0)+1; });
    const manufacturer = Object.entries(mfrCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "Unknown";

    // === BASELINE SCORE (exact Python weights) ===
    // Base inputs blend finish position with avg running position (loop data):
    // finishes are noisy (wrecks, late restarts), ARP measures true pace.
    // Backtested 2026-09-21 on 101 races (2024-2026): 0.7/0.3 blend lifts
    // top-5 hits 1.62 -> 1.79/race and top-10 4.74 -> 4.86/race, winners unchanged.
    let trackWeight, typeWeight, recentWeight;
    if (trackRaces >= 5) {
      trackWeight=0.60; typeWeight=0.30; recentWeight=0.10;
    } else if (trackRaces >= 2) {
      trackWeight=0.40; typeWeight=0.40; recentWeight=0.20;
    } else {
      trackWeight=0.0; typeWeight=0.70; recentWeight=0.30;
    }
    const arpR = recent.map(r => r[16]).filter(v => v > 0);
    const arpRecent = arpR.length >= 3 ? arpR.reduce((s,v)=>s+v,0)/arpR.length : null;
    const arpT = trackRows.map(r => r[16]).filter(v => v > 0);
    const arpTrack = arpT.length ? arpT.reduce((s,v)=>s+v,0)/arpT.length : null;
    const arpTy = typeRows.map(r => r[16]).filter(v => v > 0);
    const arpType = arpTy.length ? arpTy.reduce((s,v)=>s+v,0)/arpTy.length : null;
    const inTrackAvg = arpTrack != null ? trackAvg*0.7 + arpTrack*0.3 : trackAvg;
    const inTypeAvg = arpType != null ? typeAvg*0.7 + arpType*0.3 : typeAvg;
    const inRecentAvg = arpRecent != null ? recentAvg*0.7 + arpRecent*0.3 : recentAvg;
    const baseScore = inTrackAvg*trackWeight + inTypeAvg*typeWeight + inRecentAvg*recentWeight;

    // === ENHANCEMENTS (exact Python logic) ===
    const bonusTags = [];

    // E1: Manufacturer Track Bonus
    let mfrBonus = 0;
    if (ENH_MFR_STRONG_TRACKS[manufacturer]) {
      if (ENH_MFR_STRONG_TRACKS[manufacturer].some(t => predMatchTrack(scheduleTrack, t))) {
        mfrBonus = -0.5;
        bonusTags.push("Mfr");
      }
    }

    // E2: Starting Position Consistency
    let startBonus = 0;
    if (avgStartTrack < 10.0) { startBonus = -0.3; bonusTags.push("Qual"); }
    else if (avgStartType < 10.0) { startBonus = -0.2; bonusTags.push("Qual"); }

    // E3: Momentum
    let momBonus = 0;
    if (recentTypeTrend > 3.0) { momBonus = -0.4; bonusTags.push("Mom"); }
    else if (recentTypeTrend < -3.0) { momBonus = 0.3; bonusTags.push("Mom"); }

    // E4: Dominance (Laps Led)
    let domBonus = 0;
    if (trackLapsLedPct > 15.0) { domBonus = -0.6; bonusTags.push("Dom"); }
    else if (trackLapsLedPct > 5.0) { domBonus = -0.3; bonusTags.push("Dom"); }

    // E5: Win Multiplier
    let winMult = 1.0;
    if (trackWins >= 3) { winMult = 0.85; bonusTags.push("Win"); }
    else if (trackWins >= 1) { winMult = 0.92; bonusTags.push("Win"); }
    else if (typeWins >= 5) { winMult = 0.94; bonusTags.push("Win"); }

    // E6: Playoff Pressure
    let playoffBonus = 0;
    const isPlayoff = ENH_PLAYOFF_TRACKS.some(pt => predMatchTrack(scheduleTrack, pt));
    if (isPlayoff) {
      if (recentWins >= 1) { playoffBonus = -0.4; bonusTags.push("PO"); }
    }

    // E8: Closer (late-race running position vs mid-race)
    // Drivers who come alive late win races; drivers who fade are overvalued.
    let closerBonus = 0;
    const midVals = recent.map(r => r[17]).filter(v => v > 0);
    const closerVals = recent.map(r => r[18]).filter(v => v > 0);
    if (midVals.length >= 3 && closerVals.length >= 3) {
      const midAvg = midVals.reduce((s,v)=>s+v,0)/midVals.length;
      const closerAvg = closerVals.reduce((s,v)=>s+v,0)/closerVals.length;
      const lateKick = midAvg - closerAvg; // >0 means improves late
      if (lateKick > 2.0) { closerBonus = -0.3; bonusTags.push("Close"); }
      else if (lateKick < -2.0) { closerBonus = 0.2; bonusTags.push("Fade"); }
    }

    // Final enhanced score
    const enhancedScore = (baseScore + mfrBonus + startBonus + momBonus + domBonus + playoffBonus + closerBonus) * winMult;

    // Convert to probabilities (use same formula as Pure Stats for consistency)
    const winProb  = Math.max(5, Math.min(95, 100 - enhancedScore*2.5)) / 100;
    const top5Prob = Math.max(10, Math.min(95, 110 - enhancedScore*2.0)) / 100;
    const top10Prob = Math.max(20, Math.min(95, 120 - enhancedScore*1.5)) / 100;

    const dInfo = INITIAL_DRIVERS.find(d => d.name === driverName);

    predictions.push({
      driver: driverName,
      num: dInfo?.num || "?",
      team: dInfo?.team || "",
      mfg: dInfo?.mfg || "",
      rookie: dInfo?.rookie || false,
      score: enhancedScore,
      winPct: (winProb*100).toFixed(1),
      top5Pct: (top5Prob*100).toFixed(1),
      top10Pct: (top10Prob*100).toFixed(1),
      trackAvg: trackAvg.toFixed(1),
      trackWins,
      typeAvg: typeAvg.toFixed(1),
      typeWins,
      recentAvg: recentAvg.toFixed(1),
      bonuses: bonusTags.length > 0 ? bonusTags.join(", ") : "—",
    });
  }

  predictions.sort((a,b) => a.score - b.score);
  return predictions;
}


// ── Power Rankings Predictor ──
// Deterministic: scores drivers from the live ratings (updated weekly by the
// decay algorithm in ratings.js and synced from Supabase), blended for track
// type. Identical ratings always produce identical picks. The old random
// score swing was removed 2026-09-22.
export function runPowerRankingsPrediction(drivers, race) {
  const preds = drivers.map(d => {
    const trackRating = d[race.type];
    const overallRating = d.overall;
    let relatedBonus = 0;
    if (race.type === "superspeedway") relatedBonus = d.intermediate*0.5 + d.road*0.2;
    else if (race.type === "intermediate") relatedBonus = d.short*0.4 + d.superspeedway*0.3;
    else if (race.type === "short") relatedBonus = d.intermediate*0.4 + d.road*0.3;
    else if (race.type === "road") relatedBonus = d.short*0.3 + d.intermediate*0.3;
    relatedBonus = relatedBonus / 0.7;
    const composite = trackRating*0.60 + overallRating*0.25 + relatedBonus*0.15;
    const norm = composite/100;
    return {
      driver: d.name, num: d.num, team: d.team, mfg: d.mfg, rookie: d.rookie,
      score: composite, trackRating,
      winPct: Math.min(30, Math.max(0.3, Math.pow(norm,4)*35)).toFixed(1),
      top5Pct: Math.min(60, Math.max(3, Math.pow(norm,2.5)*60)).toFixed(1),
      top10Pct: Math.min(82, Math.max(10, Math.pow(norm,1.8)*82)).toFixed(1),
      trackAvg: "", trackWins: "", typeAvg: "", typeWins: "", recentAvg: "", bonuses: "",
    };
  }).sort((a,b) => b.score - a.score || b.trackRating - a.trackRating || a.driver.localeCompare(b.driver));
  return preds;
}
