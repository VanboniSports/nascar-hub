// ───────────────────────────────────────────────────────────
// PREDICTOR BATTLE SCORING - extracted from NASCARHub.jsx (phase 1)
// ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// PREDICTOR BATTLE — Scoring
// ─────────────────────────────────────────────────────────────
export function scoreEntry(predDrivers, actualResults) {
  if (!actualResults?.length || !predDrivers?.length) return null;
  const preds = predDrivers.map((d) => d.trim().toLowerCase());
  const actual = actualResults.map((d) => d.trim().toLowerCase());
  const top3 = actual.slice(0, 3);
  const top5 = actual.slice(0, 5);
  const top10 = actual.slice(0, 10);
  const winCorrect = preds[0] === actual[0];
  const winInTop3 = top3.includes(preds[0]);
  const winInTop5 = top5.includes(preds[0]);
  const top3Overlap = preds.slice(0, 3).filter((d) => top3.includes(d)).length;
  const top5Overlap = preds.slice(0, 5).filter((d) => top5.includes(d)).length;
  const top10Overlap = preds.slice(0, 10).filter((d) => top10.includes(d)).length;
  const points =
    (winCorrect ? 20 : winInTop3 ? 10 : winInTop5 ? 5 : 0) +
    top3Overlap * 6 + top5Overlap * 3 + top10Overlap * 1;
  return { winCorrect, winInTop3, winInTop5, top3Overlap, top5Overlap, top10Overlap, points };
}