// Power Rankings tab (hosts Rankings/Compare/Trends sub-tabs). Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useRef } from "react";
import { T } from "../theme.js";
import { InfoLegend } from "./ui.jsx";
import { Ic } from "./icons.jsx";
import { RankingsTab } from "./RankingsTab.jsx";
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


export function PowerRankingsTab({ drivers, prevRanks, ratingHistory, incrementTool }) {
  const [subTab, setSubTab] = useState("rankings");

  // Power Rankings is the default landing tab, so we do NOT auto-increment on
  // mount (that would inflate counts on every page load). Instead we count a
  // "use" when the visitor actively interacts — clicking any sub-tab counts.
  const prCounted = useRef(false);

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
        {subTab === "rankings" && <RankingsTab drivers={drivers} prevRanks={prevRanks} />}
        {subTab === "compare"  && <CompareTab drivers={drivers} />}
        {subTab === "trends"   && <TrendsTab drivers={drivers} ratingHistory={ratingHistory} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// WELCOME MODAL
// ─────────────────────────────────────────────────────────────

// Default export for React.lazy code-splitting.
export default PowerRankingsTab;
