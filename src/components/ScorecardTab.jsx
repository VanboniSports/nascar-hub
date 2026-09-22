// Model Scorecard tab. Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useEffect, useMemo } from "react";
import { T } from "../theme.js";
import { BATTLE_TRACK_COLORS, PREDICTORS, PREDICTOR_COLORS } from "../data/siteMeta.js";
import { BattleBadge } from "./ui.jsx";
import { scoreEntry } from "../models/battle.js";

export const SCORECARD_METRICS = [
  { id: "winner", label: "Winner %" },
  { id: "top10", label: "Top-10 hits" },
  { id: "points", label: "Avg pts" },
];


export function scorecardAggregates(battleRaces) {
  const scored = battleRaces.filter((r) => r.actualResults?.length > 0);
  const models = {};
  PREDICTORS.forEach((p) => {
    models[p] = { races: 0, wins: 0, top10Hits: 0, points: 0, byType: {} };
  });
  scored.forEach((race) => {
    const type = race.trackType || "Unknown";
    PREDICTORS.forEach((p) => {
      const preds = race.predictions?.[p];
      if (!preds?.length) return;
      const s = scoreEntry(preds, race.actualResults);
      if (!s) return;
      const m = models[p];
      m.races += 1;
      if (s.winCorrect) m.wins += 1;
      m.top10Hits += s.top10Overlap;
      m.points += s.points;
      const t = m.byType[type] || (m.byType[type] = { races: 0, wins: 0, top10Hits: 0, points: 0 });
      t.races += 1;
      if (s.winCorrect) t.wins += 1;
      t.top10Hits += s.top10Overlap;
      t.points += s.points;
    });
  });
  return { scoredCount: scored.length, models };
}


export function scorecardCellValue(agg, metric) {
  if (!agg || agg.races === 0) return null;
  if (metric === "winner") return { text: Math.round((agg.wins / agg.races) * 100) + "%", raw: agg.wins / agg.races };
  if (metric === "top10") return { text: (agg.top10Hits / agg.races).toFixed(1), raw: agg.top10Hits / agg.races };
  return { text: (agg.points / agg.races).toFixed(1), raw: agg.points / agg.races };
}


export function ScorecardTab({ battleRaces, incrementTool }) {
  const [metric, setMetric] = useState("winner");

  useEffect(() => { incrementTool?.("scorecard"); }, []);

  const { scoredCount, models } = useMemo(() => scorecardAggregates(battleRaces), [battleRaces]);

  const rows = PREDICTORS.map((p) => {
    const m = models[p];
    // Relative edge: the track type where this model beats the other models
    // by the most (avg pts vs. the field average on that type).
    let edgeType = null, edgeVal = 0;
    Object.keys(m.byType).forEach((type) => {
      const t = m.byType[type];
      if (!t.races) return;
      const myAvg = t.points / t.races;
      const others = PREDICTORS.filter((q) => q !== p)
        .map((q) => models[q].byType[type])
        .filter((ot) => ot && ot.races)
        .map((ot) => ot.points / ot.races);
      if (!others.length) return;
      const fieldAvg = others.reduce((a, b) => a + b, 0) / others.length;
      const edge = myAvg - fieldAvg;
      if (edge > edgeVal) { edgeVal = edge; edgeType = type; }
    });
    return {
      predictor: p,
      races: m.races,
      winPct: m.races ? (m.wins / m.races) * 100 : 0,
      avgTop10: m.races ? m.top10Hits / m.races : 0,
      avgPts: m.races ? m.points / m.races : 0,
      edgeType,
      edgeVal,
    };
  }).sort((a, b) => b.winPct - a.winPct || b.avgPts - a.avgPts);

  // Track types ordered by total scored races across models
  const typeCounts = {};
  battleRaces.filter((r) => r.actualResults?.length > 0).forEach((r) => {
    const t = r.trackType || "Unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const typeOrder = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a]);

  // Column max per metric for heat shading
  const colMax = {};
  PREDICTORS.forEach((p) => {
    let mx = 0;
    typeOrder.forEach((t) => {
      const v = scorecardCellValue(models[p].byType[t], metric);
      if (v && v.raw > mx) mx = v.raw;
    });
    colMax[p] = mx;
  });

  if (scoredCount === 0) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "40px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", color: T.text, marginBottom: 8 }}>Model Scorecard</div>
        <div style={{ color: T.textDim, fontSize: 13 }}>The scorecard appears once race results are entered in the Battle Tracker.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", color: T.text, letterSpacing: 0.5 }}>Model Scorecard</div>
        <div style={{ fontSize: 13, color: T.textDim, marginTop: 4, maxWidth: 720 }}>
          Every model picks a top 10 before each race. This page grades them against the actual results,
          updated after every race. Winner accuracy is the marquee number: how often the model's No. 1
          pick takes the checkered flag. Edge is the track type where a model beats the other models
          (the field) by the most, measured in average points per race. Based on {scoredCount} scored {scoredCount === 1 ? "race" : "races"}.
        </div>
      </div>

      {/* Headline cards, ranked by winner accuracy */}
      <div>
        <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8, paddingLeft: 4, fontFamily: "'Barlow Condensed',sans-serif" }}>
          Season Accuracy — ranked by winner %
        </div>
        {rows.map((row, idx) => (
          <div key={row.predictor} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: idx === 0 ? `${T.gold}22` : idx === 1 ? "rgba(156,163,175,0.10)" : "#cd7c2318",
                border: `1px solid ${idx === 0 ? `${T.gold}55` : idx === 1 ? "rgba(156,163,175,0.25)" : "#cd7c2333"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace",
                color: idx === 0 ? T.gold : idx === 1 ? "#9ca3af" : "#cd7c23",
              }}>{idx + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: PREDICTOR_COLORS[row.predictor] || T.textDim, flexShrink: 0 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "'Barlow Condensed',sans-serif" }}>{row.predictor}</div>
                  {row.edgeType && (
                    <span style={{ fontSize: 10, color: BATTLE_TRACK_COLORS[row.edgeType] || T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
                      Edge: {row.edgeType} (+{row.edgeVal.toFixed(1)} vs field)
                    </span>
                  )}
                  <span style={{ fontSize: 20, fontWeight: 700, color: T.gold, fontFamily: "'IBM Plex Mono',monospace", marginLeft: "auto" }}>
                    {row.races ? Math.round(row.winPct) + "%" : "—"}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, fontFamily: "'Barlow Condensed',sans-serif" }}>Winner accuracy</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <BattleBadge label="Top-10 hits" value={row.races ? row.avgTop10.toFixed(1) + "/10" : "—"} color={T.accent} />
                  <BattleBadge label="Avg pts" value={row.races ? row.avgPts.toFixed(1) : "—"} color="#8b5cf6" />
                  <BattleBadge label="Races" value={row.races} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Track-type splits */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, paddingLeft: 4, fontFamily: "'Barlow Condensed',sans-serif" }}>
            Track-Type Splits
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {SCORECARD_METRICS.map((m) => (
              <button key={m.id} onClick={() => setMetric(m.id)} style={{
                padding: "4px 11px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer",
                fontFamily: "'IBM Plex Mono',monospace",
                background: metric === m.id ? `${T.gold}18` : T.surface2,
                border: metric === m.id ? `1px solid ${T.gold}55` : `1px solid ${T.border}`,
                color: metric === m.id ? T.gold : T.textDim, transition: "all 0.15s",
              }}>{m.label}</button>
            ))}
          </div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, color: T.textDim, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif", borderBottom: `1px solid ${T.border}` }}>Track type</th>
                {PREDICTORS.map((p) => (
                  <th key={p} style={{ textAlign: "center", padding: "8px 10px", fontSize: 10, color: T.textDim, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: PREDICTOR_COLORS[p], marginRight: 5 }} />{p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {typeOrder.map((type) => (
                <tr key={type}>
                  <td style={{ padding: "9px 10px", borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 3, height: 22, borderRadius: 2, background: BATTLE_TRACK_COLORS[type] || T.textDim, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{type}</div>
                        <div style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{typeCounts[type]} {typeCounts[type] === 1 ? "race" : "races"}</div>
                      </div>
                    </div>
                  </td>
                  {PREDICTORS.map((p) => {
                    const v = scorecardCellValue(models[p].byType[type], metric);
                    const max = colMax[p];
                    const alpha = v && max > 0 ? 0.10 + 0.45 * (v.raw / max) : 0;
                    return (
                      <td key={p} style={{ padding: "9px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}` }}>
                        {v ? (
                          <span style={{
                            display: "inline-block", minWidth: 56, padding: "4px 10px", borderRadius: 6,
                            fontSize: 13, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace",
                            color: T.text, background: `${PREDICTOR_COLORS[p]}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`,
                          }}>{v.text}</span>
                        ) : (
                          <span style={{ color: T.textDim, fontSize: 12 }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 8, paddingLeft: 4 }}>
          Cells shaded by column: darker means stronger for that model. Winner % is share of races where the model's No. 1 pick won.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SEASON POINTS ADMIN — Manual entry of NASCAR official points
// ─────────────────────────────────────────────────────────────
