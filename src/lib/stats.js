// ───────────────────────────────────────────────────────────
// LEADERBOARD HELPERS - extracted from NASCARHub.jsx (phase 1)
// ───────────────────────────────────────────────────────────
export function lbAvg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null; }
export function lbGetRank(value, allValues, lowerIsBetter) {
  const sorted = [...allValues].filter(v => v != null).sort((a,b) => lowerIsBetter ? a-b : b-a);
  const idx = sorted.indexOf(value);
  if (idx < 0) return "mid";
  const pct = idx / Math.max(sorted.length - 1, 1);
  if (pct <= 0.15) return "elite";
  if (pct <= 0.35) return "good";
  if (pct <= 0.65) return "mid";
  if (pct <= 0.85) return "poor";
  return "bad";
}
