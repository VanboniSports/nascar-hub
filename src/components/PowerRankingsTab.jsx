// Power Rankings tab (hosts Rankings/Compare/Trends sub-tabs). Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useRef } from "react";
import { T } from "../theme.js";
import { InfoLegend } from "./ui.jsx";
import { Ic } from "./icons.jsx";
import { RankingsTab } from "./RankingsTab.jsx";
import { normalizeSeries, seriesLabel } from "../data/series.js";
import { SeriesSwitcher } from "./SeriesSwitcher.jsx";
import { CompareTab } from "./CompareTab.jsx";
import { TrendsTab } from "./TrendsTab.jsx";

export const PR_SUBTABS = [
  { id:"rankings", label:"Rankings",    icon:"Trophy"  },
  { id:"compare",  label:"Compare",     icon:"Compare" },
  { id:"trends",   label:"Trends",      icon:"Trend"   },
];

// ─────────────────────────────────────────────────────────────
// SHARED UI ATOMS
// ─────────────────────────────────────────────────────────────


export function PowerRankingsTab({ drivers, prevRanks, ratingHistory, powerDrivers, powerPrevRanks, powerRatingHistory, powerHasData, incrementTool, series = "cup", onSeriesChange }) {
  const [subTab, setSubTab] = useState("rankings");
  const activeSeries = normalizeSeries(series);
  // Phase 3: lower series render from their own namespaced ratings state
  // (powerDrivers / powerPrevRanks / powerRatingHistory from NASCARHub),
  // never from the Cup props. Cup keeps using the legacy props exactly.
  // hasData is false until a stored per-series record exists (admin apply
  // or replay); until then the tab shows the "not built yet" notice and
  // the unranked roster, never a fake ranking from equal-70 starts.
  const tabDrivers = activeSeries === "cup" ? drivers : (powerDrivers || drivers);
  const tabPrevRanks = activeSeries === "cup" ? prevRanks : (powerPrevRanks || {});
  const tabRatingHistory = activeSeries === "cup" ? ratingHistory : (powerRatingHistory || []);
  const tabHasData = activeSeries === "cup" ? true : !!powerHasData;

  // Hooks must run unconditionally, before any early return. The Cup path
  // below uses prCounted, and the lower-series early return previously
  // skipped this useRef, so Cup renders used 2 hooks and lower-series
  // renders used 1: switching series changed the hook count, React threw,
  // and the whole app blanked. Declaring it here keeps hook order and
  // count identical for every series.
  const prCounted = useRef(false);

  // Lower-series power ratings do not exist yet. The per-series driver
  // lists in drivers.js carry no overall/track ratings (Phase 3 admin
  // work builds them by applying race results per series). Ranking them
  // anyway would sort on undefined values and present invented order, so
  // this tab shows the roster, unranked, with a plain explanation, and
  // does not render the Rankings/Compare/Trends sub-tabs for lower series.
  // Cup renders exactly as before.
  if (activeSeries !== "cup" && !tabHasData) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <SeriesSwitcher series={activeSeries} onSeriesChange={onSeriesChange} />
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"18px 20px", fontSize:13, color:T.textMid, lineHeight:1.7 }}>
          Power Rankings for the {seriesLabel(activeSeries)} Series are not built yet. Ratings are computed in the admin panel by applying race results per series (Phase 3), and that step has not run for this series. The list below is the full-time driver roster for this series, in alphabetical order, not a ranking. Season stats and model predictions for this series are on the Season Stats and Race Predictor tabs.
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[...tabDrivers].sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
            <div key={d.num} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:13, fontWeight:800, color:T.text, fontFamily:"'Barlow Condensed',sans-serif" }}>#{d.num} {d.name}</span>
              <span style={{ fontSize:12, color:T.textDim }}>{d.mfg}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Power Rankings is the default landing tab, so we do NOT auto-increment on
  // mount (that would inflate counts on every page load). Instead we count a
  // "use" when the visitor actively interacts — clicking any sub-tab counts.
  // (prCounted is declared above the early return; see the hook-order note.)
  const handleSubTab = (id) => {
    setSubTab(id);
    // Count one Power Rankings "use" on the first interaction per session
    if (!prCounted.current) {
      incrementTool?.("power_rankings");
      prCounted.current = true;
    }
    // Also track specific sub-tool views
    if (id === "compare") incrementTool?.("pr_compare");
    if (id === "trends") incrementTool?.("pr_trends");
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      <SeriesSwitcher series={activeSeries} onSeriesChange={onSeriesChange} />
      <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${T.border}`, marginBottom:20, overflowX:"auto" }}>
        {PR_SUBTABS.map(st => {
          const active = st.id === subTab;
          return (
            <button key={st.id} onClick={()=>handleSubTab(st.id)} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", fontSize:11, fontWeight:active?700:500, background:active?T.accentSoft:"transparent", color:active?T.accent:T.textDim, border:"none", borderBottom:`2px solid ${active?T.accent:"transparent"}`, marginBottom:-1, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" }}>
              <span style={{ opacity:active?1:0.5 }}>{Ic[st.icon]?.()}</span>
              {st.label}
            </button>
          );
        })}
      </div>
      <InfoLegend title="How Rankings Work">
        <div>
          <div style={{ fontWeight:700, color:T.text, marginBottom:6, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:1 }}>DRIVER COLOR TIERS</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:10 }}>
            {[
              { label:"Elite (85+)", color:T.gold, desc:"Championship contenders — consistently dominant across track types" },
              { label:"Strong (75–84)", color:T.accent, desc:"Playoff-caliber drivers with multiple strengths" },
              { label:"Solid (68–74)", color:T.textMid, desc:"Competitive mid-pack; capable of top-10 finishes regularly" },
              { label:"Developing (63–67)", color:"#4a7a9b", desc:"Showing flashes but inconsistent; upside potential" },
              { label:"Baseline (< 63)", color:"#3d6a85", desc:"Backmarkers or rookies still building a track record" },
            ].map(t => (
              <div key={t.label} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ width:10, height:10, borderRadius:3, background:t.color, flexShrink:0, border:`1px solid ${t.color}` }} />
                <span><span style={{ fontWeight:700, color:t.color }}>{t.label}</span> — {t.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:T.textDim, borderTop:`1px solid ${T.border}`, paddingTop:8, marginTop:4 }}>
            Ratings update after each race using an asymmetric decay algorithm with recency bias, win bonuses, and momentum multipliers. Overall rating blends all track-type ratings with recent form.
          </div>
        </div>
      </InfoLegend>
      <div key={subTab} style={{ animation:"fadeIn 0.2s ease" }}>
        {subTab === "rankings" && <RankingsTab drivers={tabDrivers} prevRanks={tabPrevRanks} />}
        {subTab === "compare"  && <CompareTab drivers={tabDrivers} />}
        {subTab === "trends"   && <TrendsTab drivers={tabDrivers} ratingHistory={tabRatingHistory} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// WELCOME MODAL
// ─────────────────────────────────────────────────────────────

// Default export for React.lazy code-splitting.
export default PowerRankingsTab;
