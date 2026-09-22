// Predictor Battle Tracker tab. Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { T } from "../theme.js";
import { BATTLE_TRACK_COLORS, PREDICTORS, PREDICTOR_COLORS, PREDICTOR_DESCRIPTIONS } from "../data/siteMeta.js";
import { BattleBadge, BattleScoreBar, BattleChartTooltip, InfoLegend } from "./ui.jsx";
import { Ic } from "./icons.jsx";
import { scoreEntry } from "../models/battle.js";

export function BattleAccuracyChart({ races }) {
  const [metric, setMetric] = useState("cumulative");
  const scoredRaces = [...races]
    .filter((r) => r.actualResults?.length > 0)
    .sort((a, b) => ((a.date || a.createdAt || "") > (b.date || b.createdAt || "") ? 1 : -1));

  if (scoredRaces.length === 0) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 20px", marginBottom: 14, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Accuracy Over Time</div>
        <div style={{ color: T.textDim, fontSize: 13 }}>Chart appears once you enter actual race results.</div>
      </div>
    );
  }

  let cumulatives = Object.fromEntries(PREDICTORS.map((p) => [p, 0]));
  const chartData = scoredRaces.map((race) => {
    const name = race.raceName.length > 20 ? race.raceName.slice(0, 18) + "…" : race.raceName;
    const point = { name };
    PREDICTORS.forEach((predictor) => {
      const s = scoreEntry(race.predictions[predictor] || [], race.actualResults);
      const pts = s?.points ?? 0;
      if (metric === "cumulative") { cumulatives[predictor] += pts; point[predictor] = cumulatives[predictor]; }
      else { point[predictor] = pts; }
    });
    return point;
  });

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif" }}>Accuracy Over Time</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["cumulative", "Cumulative"], ["perrace", "Per Race"]].map(([val, lbl]) => (
            <button key={val} onClick={() => setMetric(val)} style={{
              padding: "4px 11px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "'IBM Plex Mono',monospace",
              background: metric === val ? `${T.gold}18` : T.surface2,
              border: metric === val ? `1px solid ${T.gold}55` : `1px solid ${T.border}`,
              color: metric === val ? T.gold : T.textDim, transition: "all 0.15s",
            }}>{lbl}</button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={chartData} margin={{ top: 4, right: 12, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: T.textDim, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: T.textDim, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }} axisLine={false} tickLine={false} />
          <Tooltip content={<BattleChartTooltip />} />
          <Legend formatter={(v) => <span style={{ color: T.textMid, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }}>{v}</span>} wrapperStyle={{ paddingTop: 10 }} />
          {PREDICTORS.map((p) => (
            <Line key={p} type="monotone" dataKey={p} stroke={PREDICTOR_COLORS[p] || T.textDim} strokeWidth={2.5}
              dot={{ r: 4, fill: PREDICTOR_COLORS[p] || T.textDim, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BATTLE RACE DETAIL VIEW
// ─────────────────────────────────────────────────────────────


export function BattleRaceDetail({ race, onBack }) {
  const hasResults = race.actualResults?.length > 0;
  const typeColor = BATTLE_TRACK_COLORS[race.trackType] || T.textDim;
  const scores = PREDICTORS.map((p) => ({
    predictor: p,
    score: hasResults ? scoreEntry(race.predictions[p] || [], race.actualResults) : null,
    drivers: race.predictions[p] || [],
  })).sort((a, b) => (b.score?.points || 0) - (a.score?.points || 0));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: "transparent", color: T.textMid, border: `1px solid ${T.border}`, padding: "7px 14px", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>← Back</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", color: T.text }}>{race.raceName}</h2>
          <div style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 2 }}>
            {race.track} · {race.date || "Date TBD"} · <span style={{ color: typeColor }}>{race.trackType}</span>
          </div>
        </div>
      </div>

      {/* Actual Results display */}
      <div style={{ background: T.surface, border: `1px solid ${hasResults ? `${T.green}33` : T.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: hasResults ? T.green : T.textDim, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: hasResults ? T.green : T.textDim, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, flex: 1, fontFamily: "'Barlow Condensed',sans-serif" }}>
            {hasResults ? "Actual Results" : "Actual Results — Pending"}
          </span>
        </div>
        {hasResults && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
            {race.actualResults.map((d, i) => (
              <span key={i} style={{
                padding: "3px 10px", borderRadius: 5, fontSize: 12, fontFamily: "'IBM Plex Mono',monospace",
                background: i === 0 ? `${T.gold}22` : i < 3 ? T.surface2 : T.surface3,
                border: i === 0 ? `1px solid ${T.gold}44` : `1px solid ${T.border}`,
                color: i === 0 ? T.gold : T.textMid,
              }}>
                <span style={{ color: T.textDim, marginRight: 4 }}>{i + 1}.</span>{d}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Predictor Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {scores.map(({ predictor, score, drivers }, rank) => (
          <div key={predictor} style={{ background: T.surface, border: `1px solid ${rank === 0 && hasResults ? `${T.gold}44` : T.border}`, borderRadius: 12, padding: 18, position: "relative" }}>
            {rank === 0 && hasResults && <div style={{ position: "absolute", top: 12, right: 12, color: T.gold }}><Ic.Trophy /></div>}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: PREDICTOR_COLORS[predictor] || T.textDim, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: "'Barlow Condensed',sans-serif" }}>{predictor}</span>
              </div>
              {PREDICTOR_DESCRIPTIONS[predictor] && <div style={{ fontSize: 10, color: T.textDim, marginBottom: 6, paddingLeft: 15 }}>{PREDICTOR_DESCRIPTIONS[predictor]}</div>}
              {score && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: T.gold, fontFamily: "'IBM Plex Mono',monospace" }}>{score.points} pts</span>
                  {score.winCorrect && <span style={{ fontSize: 11, background: `${T.green}22`, color: T.green, border: `1px solid ${T.green}33`, padding: "2px 7px", borderRadius: 4 }}>WIN ✓</span>}
                  {!score.winCorrect && score.winInTop3 && <span style={{ fontSize: 11, background: `${T.accent}22`, color: T.accent, border: `1px solid ${T.accent}33`, padding: "2px 7px", borderRadius: 4 }}>TOP 3</span>}
                  {!score.winInTop3 && score.winInTop5 && <span style={{ fontSize: 11, background: "#8b5cf622", color: "#8b5cf6", border: "1px solid #8b5cf633", padding: "2px 7px", borderRadius: 4 }}>TOP 5</span>}
                  <span style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>T3:{score.top3Overlap}/3 T5:{score.top5Overlap}/5 T10:{score.top10Overlap}/10</span>
                </div>
              )}
            </div>
            <div>
              {drivers.slice(0, 10).map((driver, i) => {
                if (!driver) return null;
                const dl = driver.toLowerCase();
                const actual = race.actualResults?.map((d) => d.toLowerCase()) || [];
                const isP1 = hasResults && actual[0] === dl;
                const isT3 = hasResults && actual.slice(0, 3).includes(dl);
                const isT5 = hasResults && actual.slice(0, 5).includes(dl);
                const isT10 = hasResults && actual.slice(0, 10).includes(dl);
                const hitColor = isP1 ? T.gold : isT3 ? T.green : isT5 ? T.accent : isT10 ? "#8b5cf6" : null;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ width: 18, fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13, color: hitColor || T.textMid, fontWeight: hitColor ? 600 : 400 }}>{driver}</span>
                    {hitColor && <span style={{ fontSize: 10, color: hitColor, fontFamily: "'IBM Plex Mono',monospace" }}>{isP1 ? "P1" : isT3 ? "T3" : isT5 ? "T5" : "T10"}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BATTLE TRACKER TAB — Dashboard
// ─────────────────────────────────────────────────────────────


export function BattleTrackerTab({ battleRaces, incrementTool }) {
  const [view, setView] = useState("dashboard");
  const [selectedRace, setSelectedRace] = useState(null);

  useEffect(() => { incrementTool?.("battle_tracker"); }, []);

  const leaderboard = PREDICTORS.map((predictor) => {
    let totalPoints = 0, racesScored = 0, wins = 0, top3 = 0, top5 = 0;
    battleRaces.forEach((race) => {
      if (!race.predictions[predictor]?.length || !race.actualResults?.length) return;
      const s = scoreEntry(race.predictions[predictor], race.actualResults);
      if (!s) return;
      totalPoints += s.points; racesScored++;
      if (s.winCorrect) wins++;
      if (s.winInTop3) top3++;
      if (s.winInTop5) top5++;
    });
    return { predictor, totalPoints, racesScored, wins, top3, top5, avgPoints: racesScored > 0 ? (totalPoints / racesScored).toFixed(1) : "—" };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  const maxPoints = leaderboard[0]?.totalPoints || 1;

  if (view === "race" && selectedRace) {
    return <BattleRaceDetail race={selectedRace} onBack={() => setView("dashboard")} />;
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <InfoLegend title="How the Battle Tracker Works">
        <div>
          <div style={{ fontWeight:700, color:T.text, marginBottom:6, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:1 }}>THE 4 PREDICTORS</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:10 }}>
            {PREDICTORS.map(p => (
              <div key={p} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ width:10, height:10, borderRadius:"50%", background:PREDICTOR_COLORS[p], flexShrink:0 }} />
                <span><span style={{ fontWeight:700, color:PREDICTOR_COLORS[p] }}>{p}</span> — {PREDICTOR_DESCRIPTIONS[p]}</span>
              </div>
            ))}
          </div>
          <div style={{ fontWeight:700, color:T.text, marginBottom:6, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:1 }}>SCORING SYSTEM</div>
          <div style={{ display:"flex", flexDirection:"column", gap:2, marginBottom:10 }}>
            {[
              { pts:"+20", desc:"Predicted the exact race winner" },
              { pts:"+10", desc:"Predicted winner finished in actual top 3" },
              { pts:"+5",  desc:"Predicted winner finished in actual top 5" },
              { pts:"+6",  desc:"Per correct driver in your top-3 picks" },
              { pts:"+3",  desc:"Per correct driver in your top-5 picks" },
              { pts:"+1",  desc:"Per correct driver in your top-10 picks" },
            ].map(s => (
              <div key={s.pts+s.desc} style={{ display:"flex", gap:8 }}>
                <span style={{ fontWeight:700, color:T.gold, minWidth:28, textAlign:"right" }}>{s.pts}</span>
                <span>{s.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ fontWeight:700, color:T.text, marginBottom:4, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:1 }}>READING RESULTS</div>
          <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
            <span><span style={{ color:T.green }}>●</span> Green dot = actual race results entered &nbsp;|&nbsp; <span style={{ color:T.textDim }}>●</span> Gray dot = results pending</span>
            <span>Leaderboard ranks predictors by cumulative points across all scored races.</span>
            <span>Click any race in the sidebar to see per-predictor breakdowns and which picks hit.</span>
          </div>
        </div>
      </InfoLegend>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
      {/* Races sidebar */}
      <div>
        <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8, paddingLeft: 4, fontFamily: "'Barlow Condensed',sans-serif" }}>
          Races ({battleRaces.length})
        </div>
        {battleRaces.length === 0 ? (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, textAlign: "center", padding: 28, color: T.textDim }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🏁</div>
            <div style={{ fontSize: 13 }}>No races yet. Add your first race in the Admin panel below.</div>
          </div>
        ) : (
          [...battleRaces].reverse().map((race) => {
            const hasResults = race.actualResults?.length > 0;
            const typeColor = BATTLE_TRACK_COLORS[race.trackType] || T.textDim;
            return (
              <div key={race.id} onClick={() => { setSelectedRace(race); setView("race"); }}
                style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s", border: `1px solid ${selectedRace?.id === race.id ? `${T.gold}40` : "transparent"}`, background: selectedRace?.id === race.id ? `${T.gold}08` : "transparent", display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}
                onMouseEnter={e => { if (selectedRace?.id !== race.id) e.currentTarget.style.background = T.surface2; }}
                onMouseLeave={e => { if (selectedRace?.id !== race.id) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ width: 3, height: 30, borderRadius: 2, background: typeColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{race.raceName}</div>
                  <div style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 1 }}>{race.date || "Date TBD"} · {race.trackType}</div>
                </div>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: hasResults ? T.green : T.textDim, flexShrink: 0 }} />
              </div>
            );
          })
        )}
      </div>

      {/* Main content */}
      <div>
        <BattleAccuracyChart races={battleRaces} />
        <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8, paddingLeft: 4, fontFamily: "'Barlow Condensed',sans-serif" }}>Predictor Leaderboard</div>

        {/* Scoring legend */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 10, padding: "11px 16px" }}>
          <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, fontFamily: "'Barlow Condensed',sans-serif" }}>Scoring</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
            <span><span style={{ color: T.gold }}>+20</span> Exact winner</span>
            <span><span style={{ color: T.gold }}>+10</span> Winner in top 3</span>
            <span><span style={{ color: T.gold }}>+5</span> Winner in top 5</span>
            <span><span style={{ color: T.gold }}>+6</span> each correct top-3 pick</span>
            <span><span style={{ color: T.gold }}>+3</span> each correct top-5 pick</span>
            <span><span style={{ color: T.gold }}>+1</span> each correct top-10 pick</span>
          </div>
        </div>

        {/* Leaderboard cards */}
        {leaderboard.map((row, idx) => (
          <div key={row.predictor} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 10, padding: "13px 16px" }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: PREDICTOR_COLORS[row.predictor] || T.textDim, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: "'Barlow Condensed',sans-serif" }}>{row.predictor}</div>
                    {PREDICTOR_DESCRIPTIONS[row.predictor] && <div style={{ fontSize: 10, color: T.textDim }}>{PREDICTOR_DESCRIPTIONS[row.predictor]}</div>}
                  </div>
                  <BattleScoreBar score={row.totalPoints} maxScore={maxPoints} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: T.gold, fontFamily: "'IBM Plex Mono',monospace", minWidth: 40, textAlign: "right" }}>{row.totalPoints}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <BattleBadge label="Races" value={row.racesScored} />
                  <BattleBadge label="Wins✓" value={row.wins} color={T.green} />
                  <BattleBadge label="Top3✓" value={row.top3} color={T.accent} />
                  <BattleBadge label="Top5✓" value={row.top5} color="#8b5cf6" />
                  <BattleBadge label="Avg" value={row.avgPoints} color={T.gold} />
                </div>
              </div>
            </div>
          </div>
        ))}
        {battleRaces.length === 0 && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, textAlign: "center", padding: 28, color: T.textDim, fontSize: 13 }}>
            Leaderboard appears once you add races with results.
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODEL SCORECARD — public accuracy page
// Winner accuracy %, top-10 hit rate and track-type splits per
// model, computed from scored battle races via scoreEntry().
// ─────────────────────────────────────────────────────────────

// Default export for React.lazy code-splitting.
export default BattleTrackerTab;
