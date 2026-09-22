// Race Predictor tab. Extracted from NASCARHub.jsx (phase 2).
import React, { useState } from "react";
import { T, TC, TL } from "../theme.js";
import { InfoLegend } from "./ui.jsx";
import { SCHEDULE } from "../data/schedule.js";
import { getTier } from "../lib/tiers.js";
import { trackEvent } from "../lib/analytics.js";
import { INITIAL_DRIVERS } from "../data/drivers.js";
import { runPureStatsPrediction, runEnhancedPureStatsPrediction, runPowerRankingsPrediction } from "../models/predictors.js";

export const PRED_MODELS = [
  { id:"power",    label:"Power Rankings",     color:"#10b981", desc:"Supabase-connected live ratings", icon:"⚡" },
  { id:"pure",     label:"Pure Stats",         color:"#f59e0b", desc:"Track-type weighted statistics, no ML", icon:"📊" },
  { id:"enhanced", label:"Enhanced Pure Stats", color:"#e879f9", desc:"+ Manufacturer, momentum, dominance, win multipliers", icon:"🔬" },
];

// ─────────────────────────────────────────────────────────────
// PREDICTOR TAB — with model selector
// ─────────────────────────────────────────────────────────────


export function PredictorTab({ drivers, csvData, incrementTool }) {
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedModel, setSelectedModel] = useState("power");
  const [results, setResults] = useState([]);

  const race = selectedWeek === "allstar" ? SCHEDULE.find(r => r.allStar) : SCHEDULE.find(r => !r.allStar && r.week === parseInt(selectedWeek));
  const model = PRED_MODELS.find(m => m.id === selectedModel);
  const needsCsv = selectedModel === "pure" || selectedModel === "enhanced";
  const hasCsv = csvData.length > 0;

  const runPrediction = () => {
    if (!race) return;
    incrementTool?.("race_predictor");
    trackEvent("predictor_run", { model: selectedModel, race_week: race.week, race_name: race.name });

    if (selectedModel === "power") {
      // Deterministic power-ratings model (see src/models/predictors.js)
      setResults(runPowerRankingsPrediction(drivers, race));

    } else if (selectedModel === "pure") {
      const preds = runPureStatsPrediction(csvData, race.track, race.type);
      setResults(preds);

    } else if (selectedModel === "enhanced") {
      const preds = runEnhancedPureStatsPrediction(csvData, race.track, race.type);
      setResults(preds);
    }
  };

  const col = race ? TC[race.type] : T.accent;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Model Selector */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {PRED_MODELS.map(m => {
          const active = m.id === selectedModel;
          return (
            <button key={m.id} onClick={() => { setSelectedModel(m.id); setResults([]); }}
              style={{
                flex:"1 1 160px", padding:"12px 16px", borderRadius:10, cursor:"pointer",
                background: active ? `${m.color}18` : T.surface,
                border: `2px solid ${active ? m.color : T.border}`,
                textAlign:"left", transition:"all 0.15s",
              }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ fontSize:16 }}>{m.icon}</span>
                <span style={{ fontSize:13, fontWeight:800, color: active ? m.color : T.textMid, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" }}>{m.label}</span>
              </div>
              <div style={{ fontSize:10, color: active ? `${m.color}cc` : T.textDim, fontFamily:"'IBM Plex Mono',monospace", lineHeight:1.4 }}>{m.desc}</div>
            </button>
          );
        })}
      </div>

      {/* CSV status for Pure Stats / Enhanced models */}
      <InfoLegend title="Prediction Colors & Models">
        <div>
          <div style={{ fontWeight:700, color:T.text, marginBottom:6, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:1 }}>DRIVER COLORS IN RESULTS</div>
          <div style={{ display:"flex", flexDirection:"column", gap:3, marginBottom:10 }}>
            {[
              { label:"Gold border / rank circle", color:T.gold, desc:"Top 3 predicted finish (podium contenders)" },
              { label:"Track-type color border", color:T.accent, desc:"Colored by the track type of the selected race (blue = intermediate, red = short, green = superspeedway, purple = road)" },
              { label:"Tier-based border", color:T.textMid, desc:"Remaining drivers colored by their overall Power Rankings tier" },
            ].map(t => (
              <div key={t.label} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ width:10, height:10, borderRadius:3, background:t.color, flexShrink:0 }} />
                <span><span style={{ fontWeight:700, color:t.color }}>{t.label}</span> — {t.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ fontWeight:700, color:T.text, marginBottom:6, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:1 }}>ENHANCED PURE STATS BONUS TAGS</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
            {[
              { tag:"Mfr", desc:"Manufacturer track affinity" },
              { tag:"Qual", desc:"Strong qualifying history" },
              { tag:"Mom", desc:"Momentum (trending up or down)" },
              { tag:"Dom", desc:"Laps-led dominance at track" },
              { tag:"Win", desc:"Win multiplier active" },
              { tag:"PO", desc:"Playoff pressure bonus" },
            ].map(b => (
              <span key={b.tag} style={{ fontSize:10, padding:"2px 7px", borderRadius:4, background:`${T.accent}15`, border:`1px solid ${T.accent}30`, color:T.accentText }}>
                <span style={{ fontWeight:700 }}>{b.tag}</span> = {b.desc}
              </span>
            ))}
          </div>
          <div style={{ fontSize:11, color:T.textDim, borderTop:`1px solid ${T.border}`, paddingTop:8 }}>
            Pure Stats and Enhanced Pure Stats models read from CSV race history. Power Rankings model uses live Supabase ratings. Lower composite scores = better predicted finish.
          </div>
        </div>
      </InfoLegend>
      {needsCsv && (
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:T.surface, border:`1px solid ${T.border}`, borderRadius:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:2 }}>CSV Data Source</div>
            <div style={{ fontSize:12, color:hasCsv ? T.green : T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>
              {hasCsv ? `✓ ${csvData.length.toLocaleString()} records loaded` : "No data — CSV loads automatically from GitHub. Use Admin Panel to upload manually."}
            </div>
          </div>
        </div>
      )}

      {/* Race selector + generate button */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end" }}>
        <div style={{ flex:"1 1 300px" }}>
          <label style={{ fontSize:10, color:T.textDim, display:"block", marginBottom:6, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Select Race</label>
          <select value={selectedWeek} onChange={e=>{ setSelectedWeek(e.target.value); setResults([]); }}
            style={{ width:"100%", background:T.surface2, border:`1px solid ${T.border}`, color:T.text, borderRadius:8, padding:"9px 12px", fontSize:13, outline:"none" }}>
            <option value="">Choose a race...</option>
            {SCHEDULE.map(r => <option key={r.allStar ? "allstar" : r.week} value={r.allStar ? "allstar" : r.week}>{r.allStar ? "★" : `Week ${r.week}`} · {r.date} · {r.name}{r.allStar ? " (Non-Points)" : ""}</option>)}
          </select>
        </div>
        <button onClick={runPrediction} disabled={!race || (needsCsv && !hasCsv)} style={{ padding:"9px 24px", background:(race && (!needsCsv||hasCsv))?model.color:"#1a2d40", color:(race && (!needsCsv||hasCsv))?"#fff":T.textDim, border:"none", borderRadius:8, cursor:(race && (!needsCsv||hasCsv))?"pointer":"default", fontSize:13, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase", boxShadow:(race && (!needsCsv||hasCsv))?`0 4px 18px ${model.color}44`:"none" }}>
          Generate Prediction
        </button>
      </div>

      {/* Track info badge */}
      {race && (
        <div style={{ padding:"10px 16px", background:`${col}10`, border:`1px solid ${col}30`, borderRadius:8, fontSize:13, color:col, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, letterSpacing:0.5 }}>
          {race.track} &nbsp;·&nbsp; <span style={{ textTransform:"uppercase" }}>{TL[race.type]}</span> &nbsp;·&nbsp; {race.length} mi &nbsp;·&nbsp; {race.laps} laps
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontSize:10, color:model.color, letterSpacing:2, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, marginBottom:4 }}>
            {model.icon} {model.label} MODEL — {results.length} drivers ranked
          </div>
          {results.map((p, i) => {
            const dInfo = INITIAL_DRIVERS.find(d => d.num === p.num);
            const ovr = dInfo?.overall || 60;
            const tier = getTier(ovr);
            const medal = i===0?"🏆":i===1?"🥈":i===2?"🥉":"";
            const isStatModel = selectedModel !== "power";
            return (
              <div key={p.num+"-"+i} style={{ background:tier.bg, border:`1px solid ${i<3?col:tier.border}`, borderLeft:`3px solid ${i<3?col:tier.border}`, borderRadius:10, padding:"12px 16px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:34, height:34, borderRadius:"50%", background:`${i<3?col:tier.border}22`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, color:i<3?col:tier.border, flexShrink:0 }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{medal} #{p.num} {p.driver}{p.rookie&&<span style={{ fontSize:9, color:"#4ade80", marginLeft:6 }}>ROOKIE</span>}</div>
                    <div style={{ fontSize:11, color:T.textDim }}>{p.team} · {p.mfg}</div>
                    <div style={{ display:"flex", gap:14, marginTop:5, flexWrap:"wrap" }}>
                      {[
                        ["Win", p.winPct+"%", T.gold],
                        ["Top 5", p.top5Pct+"%", T.gold],
                        ["Top 10", p.top10Pct+"%", T.gold],
                      ].map(([l,v,c])=>(
                        <div key={l} style={{ fontSize:11 }}><span style={{ color:T.textDim }}>{l}: </span><span style={{ color:c, fontWeight:700 }}>{v}</span></div>
                      ))}
                      {isStatModel && p.trackAvg && (
                        <>
                          <div style={{ fontSize:11 }}><span style={{ color:T.textDim }}>Trk Avg: </span><span style={{ color:col, fontWeight:700 }}>{p.trackAvg}</span></div>
                          <div style={{ fontSize:11 }}><span style={{ color:T.textDim }}>Type Avg: </span><span style={{ color:T.accentText, fontWeight:700 }}>{p.typeAvg}</span></div>
                          <div style={{ fontSize:11 }}><span style={{ color:T.textDim }}>Recent: </span><span style={{ color:T.text, fontWeight:700 }}>{p.recentAvg}</span></div>
                        </>
                      )}
                      {!isStatModel && p.trackRating != null && (
                        <div style={{ fontSize:11 }}><span style={{ color:T.textDim }}>{race ? TL[race.type] : "Track"} Rtg: </span><span style={{ color:col, fontWeight:700 }}>{p.trackRating}</span></div>
                      )}
                    </div>
                    {isStatModel && p.bonuses && p.bonuses !== "—" && p.bonuses !== "" && (
                      <div style={{ marginTop:4, display:"flex", gap:4, flexWrap:"wrap" }}>
                        {p.bonuses.split(", ").map(b => (
                          <span key={b} style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:4, background:`${model.color}20`, color:model.color, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:0.5 }}>{b}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPARE TAB
// ─────────────────────────────────────────────────────────────

// Default export for React.lazy code-splitting.
export default PredictorTab;
