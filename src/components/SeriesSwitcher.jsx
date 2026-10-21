// Shared series switcher for the public data tabs (Phase 4).
// Rendered at the top of Predictor, Power Rankings, and Season Stats.
// Battle Tracker and DFS do not use it: Battle stays Cup-only for 2026
// and DFS salaries are Cup-only until per-series salaries exist in admin.
import React from "react";
import { T } from "../theme.js";
import { SERIES_IDS, SERIES_LABELS, normalizeSeries } from "../data/series.js";

export function SeriesSwitcher({ series, onSeriesChange }) {
  const current = normalizeSeries(series);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
      <span style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>
        Series
      </span>
      {SERIES_IDS.map((id) => {
        const active = id === current;
        return (
          <button
            key={id}
            onClick={() => onSeriesChange && onSeriesChange(id)}
            style={{
              padding: "6px 14px", borderRadius: 20, cursor: "pointer",
              fontSize: 11, fontWeight: active ? 800 : 500,
              fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase",
              background: active ? T.accentSoft : "transparent",
              color: active ? T.accent : T.textDim,
              border: `1px solid ${active ? T.accent : T.border}`,
            }}
          >
            {SERIES_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}

export default SeriesSwitcher;
