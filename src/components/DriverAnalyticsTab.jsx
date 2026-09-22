// Driver Analytics tab family. Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useEffect, useRef, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../theme.js";
import { CSV_TRACK_TYPES, CSV_TYPE_COLORS, H2H_COLORS } from "../data/siteMeta.js";
import { FinishBadge, StatCard } from "./ui.jsx";
import { Ic } from "./icons.jsx";
import { INITIAL_DRIVERS, FULL_TIMER_NAMES } from "../data/drivers.js";

export const DA_TRACKS_2026 = [
  "Bristol Motor Speedway","Charlotte Motor Speedway","Chicagoland Speedway","Circuit Of The Americas",
  "Darlington Raceway","Daytona International Speedway","Dover International Speedway","Echopark Speedway",
  "Homestead-Miami Speedway","Indianapolis Motor Speedway","Iowa Speedway","Kansas Speedway",
  "Las Vegas Motor Speedway","Martinsville Speedway","Michigan International Speedway",
  "Nashville Superspeedway","Naval Base Coronado Street Course","New Hampshire Motor Speedway",
  "North Wilkesboro Speedway","Phoenix Raceway","Pocono Raceway","Richmond Raceway","Sonoma Raceway",
  "Talladega Superspeedway","Texas Motor Speedway","Watkins Glen International Raceway",
  "World Wide Technology Raceway",
];


export const DA_TRACK_ALIASES = {
  "Watkins Glen International":"Watkins Glen International Raceway",
};


export const TEAM_ROSTER_2026 = {
  "Hendrick Motorsports":["Kyle Larson","Chase Elliott","William Byron","Alex Bowman"],
  "Joe Gibbs Racing":["Denny Hamlin","Christopher Bell","Ty Gibbs","Chase Briscoe"],
  "Team Penske":["Joey Logano","Ryan Blaney","Austin Cindric"],
  "Trackhouse Racing":["Ross Chastain","Shane van Gisbergen","Connor Zilisch"],
  "23XI Racing":["Bubba Wallace","Tyler Reddick","Riley Herbst"],
  "RFK Racing":["Chris Buescher","Brad Keselowski","Ryan Preece"],
  "Haas Factory Team":["Cole Custer"],
  "Front Row Motorsports":["Michael McDowell","Todd Gilliland","Noah Gragson"],
  "Spire Motorsports":["Carson Hocevar","Zane Smith","Daniel Suarez"],
  "Legacy Motor Club":["Erik Jones","John Hunter Nemechek"],
  "Hyak Motorsports":["Ricky Stenhouse Jr"],
  "Richard Childress Racing":["Austin Dillon"],
  "Wood Brothers Racing":["Harrison Burton"],
  "Rick Ware Racing":["Cody Ware"],
  "Kaulig Racing":["AJ Allmendinger","Ty Dillon"],
};


export const TEAM_NAMES_2026 = Object.keys(TEAM_ROSTER_2026).sort();


export const DA_SUBTABS = [
  { id:"breakdown",   label:"Driver Track Breakdown", icon:"Flag"    },
  { id:"h2h",         label:"Head to Head",            icon:"Compare" },
  { id:"teamh2h",     label:"Team H2H",                icon:"Compare" },
  { id:"consistency", label:"Consistency Score",       icon:"Chart"   },
  { id:"dnfrisk",     label:"Bad / Good Day",            icon:"Alert"   },
  { id:"loop",        label:"Loop Data",               icon:"Trend"   },
];


export function daGradeChip(val, allVals, lowerBetter) {
  if (val == null) return null;
  const valid = allVals.filter(v => v != null);
  if (valid.length < 2) return { grade:"—", bg:T.surface2, color:T.textDim };
  const sorted = [...valid].sort((a,b) => lowerBetter ? a-b : b-a);
  const idx = sorted.indexOf(val);
  const pct = idx / Math.max(sorted.length - 1, 1);
  if (pct <= 0.10) return { grade:"A+", bg:"rgba(255,193,7,0.18)", color:"#ffc107" };
  if (pct <= 0.25) return { grade:"A",  bg:"rgba(76,175,80,0.18)", color:"#4caf50" };
  if (pct <= 0.40) return { grade:"B+", bg:"rgba(30,144,255,0.18)", color:"#60b8ff" };
  if (pct <= 0.55) return { grade:"B",  bg:"rgba(106,155,191,0.14)", color:"#6a9bbf" };
  if (pct <= 0.70) return { grade:"C",  bg:"rgba(100,100,120,0.12)", color:"#999" };
  if (pct <= 0.85) return { grade:"D",  bg:"rgba(244,67,54,0.12)", color:"#f59e0b" };
  return { grade:"F", bg:"rgba(244,67,54,0.18)", color:"#f44336" };
}


export function DaGrade({ val, allVals, lowerBetter }) {
  const g = daGradeChip(val, allVals, lowerBetter);
  if (!g) return <span style={{ color:T.textDim }}>—</span>;
  return <span style={{ background:g.bg, color:g.color, padding:"2px 7px", borderRadius:4, fontWeight:800, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:0.5 }}>{g.grade}</span>;
}


export function DaTrackBreakdown({ csvData }) {
  const [selDriver, setSelDriver] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortCol, setSortCol] = useState("avgFinish");
  const [sortAsc, setSortAsc] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [viewMode, setViewMode] = useState("career_2026"); // "career_all" | "career_2026" | "season"

  // Build index: BY_DRIVER[name] = [race rows]
  const byDriver = useMemo(() => {
    const bd = {};
    for (const r of csvData) {
      const driver = r[0];
      if (!driver) continue;
      if (!bd[driver]) bd[driver] = [];
      bd[driver].push(r);
    }
    return bd;
  }, [csvData]);

  // Driver list: only full-timers from INITIAL_DRIVERS
  const driverList = useMemo(() => {
    return FULL_TIMER_NAMES.filter(n => byDriver[n]);
  }, [byDriver]);

  // Helper: build stats for a set of races at a given track
  function buildTrackStat(track, tRaces) {
    const finishes = tRaces.map(r => r[3]).filter(v => v > 0);
    const starts = tRaces.map(r => r[4]).filter(v => v > 0);
    const avgFinish = finishes.length ? finishes.reduce((a,b)=>a+b,0)/finishes.length : null;
    const avgStart = starts.length ? starts.reduce((a,b)=>a+b,0)/starts.length : null;
    const wins = finishes.filter(f=>f===1).length;
    const top5 = finishes.filter(f=>f<=5).length;
    const top10 = finishes.filter(f=>f<=10).length;
    const bestFinish = finishes.length ? Math.min(...finishes) : null;
    const lapsLed = tRaces.reduce((a,r)=>a+(r[5]||0),0);
    const trackType = CSV_TRACK_TYPES[track] || "Unknown";

    // Year breakdown for expansion
    const byYear = {};
    for (const r of tRaces) { const yr = r[2]; if (!byYear[yr]) byYear[yr]=[]; byYear[yr].push(r); }
    const yearData = Object.entries(byYear).sort((a,b)=>Number(a[0])-Number(b[0])).map(([yr,rs]) => ({
      year: Number(yr),
      finishes: rs.map(r=>r[3]).filter(v=>v>0),
      lapsLed: rs.reduce((a,r)=>a+(r[5]||0),0),
      starts: rs.map(r=>r[4]).filter(v=>v>0),
    }));

    return { track, trackType, races:tRaces.length, avgFinish, avgStart, wins, top5, top10, bestFinish, lapsLed, yearData };
  }

  // Compute all track stats for selected driver based on viewMode
  const { trackStats, summary, noHistory } = useMemo(() => {
    if (!selDriver || !byDriver[selDriver]) return { trackStats:[], summary:null, noHistory:[] };
    let races = byDriver[selDriver];

    // For "season" mode, filter to only 2026 races
    if (viewMode === "season") {
      races = races.filter(r => r[2] === 2026);
      if (races.length === 0) return { trackStats:[], summary:{ totalRaces:0, totalWins:0, totalTop5:0, totalTop10:0, overallAvg:null, bestTrack:null, worstTrack:null, bestType:null, bestTypeAvg:null }, noHistory:[] };
    }

    // Group by track — normalize aliases
    const byTrack = {};
    for (const r of races) {
      let trackName = r[1];
      if (DA_TRACK_ALIASES[trackName]) trackName = DA_TRACK_ALIASES[trackName];
      if (!byTrack[trackName]) byTrack[trackName] = [];
      byTrack[trackName].push(r);
    }

    const stats = [];
    const missing = [];

    if (viewMode === "career_all") {
      // Show ALL tracks the driver has ever raced at
      for (const [track, tRaces] of Object.entries(byTrack)) {
        if (tRaces.length === 0) continue;
        stats.push(buildTrackStat(track, tRaces));
      }
    } else {
      // "career_2026" or "season" — only show 2026 schedule tracks
      for (const track of DA_TRACKS_2026) {
        const tRaces = byTrack[track] || [];
        if (tRaces.length === 0) { missing.push(track); continue; }
        stats.push(buildTrackStat(track, tRaces));
      }
    }

    // Summary — computed from the SAME filtered races that produced the stats above
    // For career_2026 and season: only races at 2026 tracks; for career_all: all races
    let summaryRaces = races;
    if (viewMode === "career_2026") {
      // Only count races at tracks in the 2026 schedule
      const tracks2026Set = new Set(DA_TRACKS_2026);
      summaryRaces = races.filter(r => {
        let tn = r[1];
        if (DA_TRACK_ALIASES[tn]) tn = DA_TRACK_ALIASES[tn];
        return tracks2026Set.has(tn);
      });
    }
    // For career_all and season, summaryRaces = races (already correct)

    const allFinishes = summaryRaces.map(r=>r[3]).filter(v=>v>0);
    const totalRaces = summaryRaces.length;
    const totalWins = allFinishes.filter(f=>f===1).length;
    const totalTop5 = allFinishes.filter(f=>f<=5).length;
    const totalTop10 = allFinishes.filter(f=>f<=10).length;
    const overallAvg = allFinishes.length ? allFinishes.reduce((a,b)=>a+b,0)/allFinishes.length : null;

    const bestTrack = stats.filter(s=>s.avgFinish!=null).sort((a,b)=>a.avgFinish-b.avgFinish)[0];
    const worstTrack = stats.filter(s=>s.avgFinish!=null).sort((a,b)=>b.avgFinish-a.avgFinish)[0];

    // Best track type
    const typeAvgs = {};
    for (const s of stats) {
      if (s.avgFinish == null) continue;
      if (!typeAvgs[s.trackType]) typeAvgs[s.trackType] = [];
      typeAvgs[s.trackType].push(s.avgFinish);
    }
    let bestType = null, bestTypeAvg = 99;
    for (const [type, avgs] of Object.entries(typeAvgs)) {
      const avg = avgs.reduce((a,b)=>a+b,0)/avgs.length;
      if (avg < bestTypeAvg) { bestTypeAvg = avg; bestType = type; }
    }

    return {
      trackStats: stats,
      summary: { totalRaces, totalWins, totalTop5, totalTop10, overallAvg, bestTrack, worstTrack, bestType, bestTypeAvg },
      noHistory: missing,
    };
  }, [selDriver, byDriver, viewMode]);

  // Filter & sort
  const displayedTracks = useMemo(() => {
    let rows = trackStats;
    if (typeFilter !== "All") rows = rows.filter(r => r.trackType === typeFilter);
    const col = sortCol;
    rows = [...rows].sort((a,b) => {
      let av = a[col], bv = b[col];
      if (col === "track") {
        return sortAsc ? (av||"").localeCompare(bv||"") : (bv||"").localeCompare(av||"");
      }
      if (av == null) av = sortAsc ? 9999 : -9999;
      if (bv == null) bv = sortAsc ? 9999 : -9999;
      return sortAsc ? av - bv : bv - av;
    });
    return rows;
  }, [trackStats, typeFilter, sortCol, sortAsc]);

  const allAvgFinishes = trackStats.map(s=>s.avgFinish).filter(Boolean);
  const allAvgStarts = trackStats.map(s=>s.avgStart).filter(Boolean);

  function toggleSort(col) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(col === "wins" || col === "top5" || col === "top10" || col === "lapsLed" || col === "races" ? false : true); }
  }

  function toggleExpand(track) {
    setExpanded(prev => ({ ...prev, [track]: !prev[track] }));
  }

  const SortHeader = ({ col, label, w }) => {
    const active = sortCol === col;
    return (
      <th onClick={()=>toggleSort(col)} style={{ padding:"8px 6px", textAlign:"right", fontSize:9, color:active?T.accent:T.textDim, fontWeight:700, letterSpacing:1.5, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", cursor:"pointer", userSelect:"none", width:w||"auto", whiteSpace:"nowrap" }}>
        {label} {active ? (sortAsc ? "▲" : "▼") : ""}
      </th>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Driver selector */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:16 }}>
        <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:8 }}>Select Driver</div>
        <select value={selDriver} onChange={e => { setSelDriver(e.target.value); setExpanded({}); setSortCol("avgFinish"); setSortAsc(true); }}
          style={{ width:"100%", maxWidth:380, padding:"10px 14px", background:T.surface2, color:T.text, border:`1px solid ${T.border2}`, borderRadius:8, fontSize:14, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer", outline:"none" }}>
          <option value="">— Choose a driver —</option>
          {driverList.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {selDriver && summary && (
        <>
          {/* View mode toggle */}
          <div style={{ display:"flex", alignItems:"center", gap:2, background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:3, alignSelf:"flex-start" }}>
            {[
              { id:"career_all", label:"Career (All Tracks)" },
              { id:"career_2026", label:"Career (2026 Tracks)" },
              { id:"season", label:"This Season" },
            ].map(opt => {
              const active = viewMode === opt.id;
              return (
                <button key={opt.id} onClick={()=>{ setViewMode(opt.id); setExpanded({}); setTypeFilter("All"); }} style={{
                  padding:"6px 14px", fontSize:11, fontWeight:active?800:600, fontFamily:"'Barlow Condensed',sans-serif",
                  letterSpacing:1, textTransform:"uppercase", cursor:"pointer", borderRadius:6, border:"none",
                  background:active ? T.accentSoft : "transparent", color:active ? T.accent : T.textDim,
                  transition:"all 0.15s", whiteSpace:"nowrap",
                }}>{opt.label}</button>
              );
            })}
          </div>

          {/* Summary cards */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <StatCard label="Races" value={summary.totalRaces} />
            <StatCard label="Wins" value={summary.totalWins} highlight={summary.totalWins>0} />
            <StatCard label="Top 5s" value={summary.totalTop5} />
            <StatCard label="Top 10s" value={summary.totalTop10} />
            <StatCard label="Avg Finish" value={summary.overallAvg?.toFixed(1)} />
            <StatCard label="Best Track" value={summary.bestTrack?.track?.replace(/ (Motor |International |Super)?(Speedway|Raceway|International)/g,"").substring(0,14) || "—"} highlight />
            <StatCard label="Worst Track" value={summary.worstTrack?.track?.replace(/ (Motor |International |Super)?(Speedway|Raceway|International)/g,"").substring(0,14) || "—"} />
            <StatCard label="Best Type" value={summary.bestType || "—"} />
          </div>

          {/* Track type filters */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["All","Road Course","Short Track","Intermediate","Superspeedway"].map(type => {
              const active = typeFilter === type;
              const color = type === "All" ? T.accent : CSV_TYPE_COLORS[type] || T.textMid;
              return (
                <button key={type} onClick={()=>setTypeFilter(type)} style={{
                  padding:"6px 14px", fontSize:11, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif",
                  letterSpacing:1.5, textTransform:"uppercase", cursor:"pointer", borderRadius:6,
                  background:active ? `${color}33` : T.surface2, color:active ? color : T.textDim,
                  border:`1px solid ${active ? `${color}66` : T.border}`, transition:"all 0.15s",
                }}>{type}</button>
              );
            })}
          </div>

          {/* Track performance table */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:700 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                    <th style={{ padding:"8px 10px", textAlign:"left", fontSize:9, color:T.textDim, fontWeight:700, letterSpacing:1.5, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", width:30 }}></th>
                    <th onClick={()=>toggleSort("track")} style={{ padding:"8px 10px", textAlign:"left", fontSize:9, color:sortCol==="track"?T.accent:T.textDim, fontWeight:700, letterSpacing:1.5, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", cursor:"pointer", userSelect:"none" }}>Track {sortCol==="track"?(sortAsc?"▲":"▼"):""}</th>
                    <SortHeader col="avgFinish" label="Avg Fin" />
                    <SortHeader col="wins" label="Wins" />
                    <SortHeader col="top5" label="T5" />
                    <SortHeader col="top10" label="T10" />
                    <SortHeader col="avgStart" label="Avg St" />
                    <SortHeader col="bestFinish" label="Best" />
                    <SortHeader col="lapsLed" label="Led" />
                    <SortHeader col="races" label="Races" />
                  </tr>
                </thead>
                <tbody>
                  {displayedTracks.map((row, i) => {
                    const isOpen = expanded[row.track];
                    const typeColor = CSV_TYPE_COLORS[row.trackType] || T.textDim;
                    return (
                      <React.Fragment key={row.track}>
                        <tr onClick={()=>toggleExpand(row.track)} style={{ borderBottom:`1px solid ${T.border}33`, background:i%2===0?"transparent":`${T.surface2}55`, cursor:"pointer", transition:"background 0.1s" }}
                          onMouseEnter={e=>e.currentTarget.style.background=`${T.accentSoft}`}
                          onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":`${T.surface2}55`}>
                          <td style={{ padding:"8px 6px 8px 10px", fontSize:12, color:T.textDim }}>{isOpen ? "▼" : "▶"}</td>
                          <td style={{ padding:"8px 10px" }}>
                            <div style={{ fontWeight:700, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:0.5 }}>{row.track.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}</div>
                            <span style={{ background:`${typeColor}22`, color:typeColor, padding:"1px 6px", borderRadius:3, fontSize:9, fontWeight:700, letterSpacing:1, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>{row.trackType}</span>
                          </td>
                          <td style={{ padding:"8px 6px", textAlign:"right" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, fontSize:13, color:T.text }}>{row.avgFinish?.toFixed(1) ?? "—"}</span>
                              <DaGrade val={row.avgFinish} allVals={allAvgFinishes} lowerBetter={true} />
                            </div>
                          </td>
                          <td style={{ padding:"8px 6px", textAlign:"right", color:row.wins>0?T.gold:T.textDim, fontWeight:row.wins>0?800:400, fontFamily:"'IBM Plex Mono',monospace" }}>{row.wins}</td>
                          <td style={{ padding:"8px 6px", textAlign:"right", color:row.top5>0?T.green:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>{row.top5}</td>
                          <td style={{ padding:"8px 6px", textAlign:"right", color:row.top10>0?T.accentText:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>{row.top10}</td>
                          <td style={{ padding:"8px 6px", textAlign:"right" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                              <span style={{ fontFamily:"'IBM Plex Mono',monospace", color:T.textMid, fontSize:12 }}>{row.avgStart?.toFixed(1) ?? "—"}</span>
                              <DaGrade val={row.avgStart} allVals={allAvgStarts} lowerBetter={true} />
                            </div>
                          </td>
                          <td style={{ padding:"8px 6px", textAlign:"right" }}>{row.bestFinish ? <FinishBadge pos={row.bestFinish} /> : <span style={{ color:T.textDim }}>—</span>}</td>
                          <td style={{ padding:"8px 6px", textAlign:"right", color:row.lapsLed>0?T.accentText:T.textDim, fontFamily:"'IBM Plex Mono',monospace", fontSize:11 }}>{row.lapsLed>0?row.lapsLed.toLocaleString():"0"}</td>
                          <td style={{ padding:"8px 6px", textAlign:"right", color:T.textMid, fontFamily:"'IBM Plex Mono',monospace" }}>{row.races}</td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={11} style={{ padding:0, background:T.surface3 }}>
                              <DaExpandedRow row={row} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* No history tracks */}
          {noHistory.length > 0 && typeFilter === "All" && viewMode !== "career_all" && (
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:16 }}>
              <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:10 }}>{viewMode === "season" ? "No 2026 Results at These Tracks" : "No History at These 2026 Tracks"}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {noHistory.map(t => (
                  <span key={t} style={{ background:T.surface2, border:`1px solid ${T.border}`, borderRadius:6, padding:"4px 10px", fontSize:11, color:T.textDim, fontFamily:"'Barlow Condensed',sans-serif" }}>
                    {t.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Season mode empty state */}
          {viewMode === "season" && trackStats.length === 0 && summary && summary.totalRaces === 0 && (
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"30px 20px", textAlign:"center" }}>
              <div style={{ fontSize:20, marginBottom:8 }}>📭</div>
              <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:2, textTransform:"uppercase", color:T.textMid }}>No 2026 Results Yet</div>
              <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", marginTop:6 }}>Race data will appear here once the season begins.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


export function DaExpandedRow({ row }) {
  const maxFinish = Math.max(...row.yearData.flatMap(y=>y.finishes), 40);
  return (
    <div style={{ padding:"14px 20px 14px 50px", display:"flex", flexDirection:"column", gap:14 }}>
      {/* Stat snapshot */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <StatCard label="Races" value={row.races} />
        <StatCard label="Avg Finish" value={row.avgFinish?.toFixed(1)} />
        <StatCard label="Avg Start" value={row.avgStart?.toFixed(1)} />
        <StatCard label="Wins" value={row.wins} highlight={row.wins>0} />
        <StatCard label="Laps Led" value={row.lapsLed.toLocaleString()} />
      </div>

      {/* Year-by-year bar chart */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:14 }}>
        <div style={{ fontSize:9, color:T.textDim, letterSpacing:2, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:10 }}>Year-by-Year Finishes</div>
        {row.yearData.map(yr => (
          <div key={yr.year} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <span style={{ width:36, fontSize:11, fontWeight:700, color:T.textMid, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"right" }}>{yr.year}</span>
            <div style={{ flex:1, display:"flex", gap:3, alignItems:"center" }}>
              {yr.finishes.map((f,j) => {
                const pct = Math.max(4, Math.min(100, (1 - (f-1)/maxFinish) * 100));
                const barColor = f === 1 ? "#ffc107" : f <= 3 ? "#708090" : f <= 5 ? "#8B4513" : f <= 10 ? "#4caf50" : f <= 20 ? T.accent : T.textDim;
                return (
                  <div key={j} style={{ display:"flex", alignItems:"center", gap:2, flex:`0 0 auto` }} title={`P${f}`}>
                    <div style={{ width:Math.max(18, pct * 0.6), height:16, background:`${barColor}88`, borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:9, fontWeight:700, color:"#fff", fontFamily:"monospace" }}>{f}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <span style={{ fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", width:40, textAlign:"right" }}>{yr.lapsLed > 0 ? `${yr.lapsLed}L` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HEAD TO HEAD — Sub-tab 2
// ─────────────────────────────────────────────────────────────


export function DaHeadToHead({ csvData, incrementTool }) {
  const [selectedDrivers, setSelectedDrivers] = useState(["","","",""]);
  const [h2hTrackFilter, setH2hTrackFilter] = useState("All");

  // All tracks from CSV for the filter dropdown
  const h2hAllTracks = useMemo(() => {
    const ts = new Set();
    for (const r of csvData) { if (r[1]) ts.add(r[1]); }
    return [...ts].sort();
  }, [csvData]);

  // Full (unfiltered) byDriver for driver list availability
  const byDriverFull = useMemo(() => {
    const bd = {};
    for (const r of csvData) {
      const d = r[0]; if (!d) continue;
      if (!bd[d]) bd[d] = [];
      bd[d].push(r);
    }
    return bd;
  }, [csvData]);

  // Filtered byDriver (applies track filter)
  const byDriver = useMemo(() => {
    if (h2hTrackFilter === "All") return byDriverFull;
    const bd = {};
    for (const r of csvData) {
      const d = r[0]; if (!d) continue;
      if (r[1] !== h2hTrackFilter) continue;
      if (!bd[d]) bd[d] = [];
      bd[d].push(r);
    }
    return bd;
  }, [csvData, h2hTrackFilter, byDriverFull]);

  const driverList = useMemo(() => FULL_TIMER_NAMES.filter(n => byDriverFull[n]).sort(), [byDriverFull]);

  const setDriver = (idx, val) => {
    setSelectedDrivers(prev => { const next = [...prev]; next[idx] = val; return next; });
  };

  const activeDrivers = selectedDrivers.filter(d => d !== "");
  const uniqueActive = [...new Set(activeDrivers)];
  const ready = uniqueActive.length >= 2 && uniqueActive.length === activeDrivers.length;

  // Track usage when a valid comparison is formed
  const prevReady = useRef(false);
  useEffect(() => {
    if (ready && !prevReady.current) incrementTool?.("driver_h2h");
    prevReady.current = ready;
  }, [ready]);

  // Compute stats for each selected driver
  const h2hData = useMemo(() => {
    if (!ready) return null;
    const drivers = uniqueActive;

    function driverStats(races) {
      const finishes = races.map(r => r[3]).filter(v => v > 0);
      return {
        noData: races.length === 0,
        wins: finishes.filter(f => f === 1).length,
        top5: finishes.filter(f => f <= 5).length,
        top10: finishes.filter(f => f <= 10).length,
        avgFinish: finishes.length ? finishes.reduce((a,b)=>a+b,0)/finishes.length : null,
        bestFinish: finishes.length ? Math.min(...finishes) : null,
        worstFinish: finishes.length ? Math.max(...finishes) : null,
        lapsLed: races.reduce((a,r) => a + (r[5]||0), 0),
        races: races.length,
      };
    }

    const stats = {};
    for (const d of drivers) stats[d] = driverStats(byDriver[d] || []);

    // Head-to-head pairwise wins in shared races
    const raceIdx = {};
    for (const d of drivers) {
      for (const r of (byDriver[d] || [])) {
        const key = `${r[1]}|${r[9]}`;
        if (!raceIdx[key]) raceIdx[key] = {};
        raceIdx[key][d] = r[3];
      }
    }

    // Count pairwise finishes + by track type
    const pairwise = {};
    const pairByType = {};
    for (let i = 0; i < drivers.length; i++) {
      for (let j = i+1; j < drivers.length; j++) {
        const pk = `${drivers[i]}|${drivers[j]}`;
        pairwise[pk] = { d1:0, d2:0, ties:0 };
        pairByType[pk] = { Intermediate:{d1:0,d2:0}, "Short Track":{d1:0,d2:0}, "Road Course":{d1:0,d2:0}, Superspeedway:{d1:0,d2:0}, Dirt:{d1:0,d2:0} };
      }
    }
    for (const [key, finishMap] of Object.entries(raceIdx)) {
      const track = key.split("|")[0];
      const trackType = CSV_TRACK_TYPES[track] || "Unknown";
      for (let i = 0; i < drivers.length; i++) {
        for (let j = i+1; j < drivers.length; j++) {
          const f1 = finishMap[drivers[i]], f2 = finishMap[drivers[j]];
          if (f1 > 0 && f2 > 0) {
            const pk = `${drivers[i]}|${drivers[j]}`;
            if (f1 < f2) { pairwise[pk].d1++; if (pairByType[pk][trackType]) pairByType[pk][trackType].d1++; }
            else if (f2 < f1) { pairwise[pk].d2++; if (pairByType[pk][trackType]) pairByType[pk][trackType].d2++; }
            else pairwise[pk].ties++;
          }
        }
      }
    }

    // Yearly avg finish trend
    const yearlyTrend = {};
    const years = [...new Set(csvData.map(r => r[2]))].sort();
    for (const yr of years) {
      yearlyTrend[yr] = { year: yr };
      for (const d of drivers) {
        const races = (byDriver[d] || []).filter(r => r[2] === yr);
        const finishes = races.map(r => r[3]).filter(v => v > 0);
        yearlyTrend[yr][d] = finishes.length ? +(finishes.reduce((a,b)=>a+b,0)/finishes.length).toFixed(1) : null;
      }
    }

    return { drivers, stats, pairwise, pairByType, yearlyTrend: Object.values(yearlyTrend) };
  }, [ready, uniqueActive.join(","), byDriver, csvData, h2hTrackFilter]);

  const selStyle = { width:"100%", padding:"10px 14px", background:T.surface2, color:T.text, border:`1px solid ${T.border2}`, borderRadius:8, fontSize:14, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer", outline:"none" };
  const labelStyle = { fontSize:10, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:8 };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Track filter */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
        <div style={{ flex:1, minWidth:180, maxWidth:360 }}>
          <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:6 }}>Filter by Track</div>
          <select value={h2hTrackFilter} onChange={e=>{setH2hTrackFilter(e.target.value);}}
            style={{ width:"100%", padding:"7px 12px", background:T.surface2, color:T.text, border:`1px solid ${h2hTrackFilter!=="All"?T.accent:T.border}`, borderRadius:8, fontSize:12, fontWeight:600, fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer", outline:"none" }}>
            <option value="All">All Tracks</option>
            {h2hAllTracks.map(t => <option key={t} value={t}>{t.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}</option>)}
          </select>
        </div>
        {h2hTrackFilter !== "All" && (
          <div style={{ fontSize:10, color:CSV_TYPE_COLORS[CSV_TRACK_TYPES[h2hTrackFilter]||"Unknown"]||T.textDim, fontFamily:"'IBM Plex Mono',monospace", padding:"8px 0" }}>
            {CSV_TRACK_TYPES[h2hTrackFilter] || "Unknown"} — {h2hTrackFilter}
          </div>
        )}
      </div>

      {/* Driver selectors — 2 to 4 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:12 }}>
        {[0,1,2,3].map(idx => {
          const others = selectedDrivers.filter((d,i) => i !== idx && d !== "");
          const color = H2H_COLORS[idx];
          return (
            <div key={idx} style={{ background:T.surface, border:`1px solid ${selectedDrivers[idx]?color:T.border}`, borderRadius:12, padding:16, transition:"border-color 0.2s" }}>
              <div style={{ ...labelStyle, color: selectedDrivers[idx] ? color : T.textDim }}>Driver {idx+1}{idx >= 2 ? " (optional)" : ""}</div>
              <select value={selectedDrivers[idx]} onChange={e=>setDriver(idx, e.target.value)} style={selStyle}>
                <option value="">— {idx >= 2 ? "Optional" : "Select"} —</option>
                {driverList.filter(d=>!others.includes(d)).map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          );
        })}
      </div>

      {h2hData && (
        <>
          {/* Stat comparison table */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:20, overflowX:"auto" }}>
            <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:14, textAlign:"center" }}>Category Comparison{h2hTrackFilter !== "All" ? ` — ${h2hTrackFilter.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}` : ""}</div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:"'IBM Plex Mono',monospace" }}>
              <thead>
                <tr>
                  <th style={{ textAlign:"left", padding:"6px 8px", fontSize:10, color:T.textDim, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.5, textTransform:"uppercase", borderBottom:`1px solid ${T.border}` }}>Stat</th>
                  {h2hData.drivers.map((d, i) => (
                    <th key={d} style={{ textAlign:"center", padding:"6px 8px", color:H2H_COLORS[selectedDrivers.indexOf(d)], fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase", borderBottom:`1px solid ${T.border}` }}>{d.split(" ").pop()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key:"races", label:"Races", lb:false },
                  { key:"wins", label:"Wins", lb:false },
                  { key:"top5", label:"Top 5s", lb:false },
                  { key:"top10", label:"Top 10s", lb:false },
                  { key:"avgFinish", label:"Avg Finish", lb:true, fmt:1 },
                  { key:"bestFinish", label:"Best Finish", lb:true },
                  { key:"worstFinish", label:"Worst Finish", lb:true },
                  { key:"lapsLed", label:"Laps Led", lb:false },
                ].map(cat => {
                  const vals = h2hData.drivers.map(d => h2hData.stats[d][cat.key] ?? 0);
                  const best = cat.lb ? Math.min(...vals.filter(v=>v>0||cat.key==="avgFinish")) : Math.max(...vals);
                  return (
                    <tr key={cat.key} style={{ borderBottom:`1px solid ${T.border}` }}>
                      <td style={{ padding:"8px", fontSize:10, color:T.textDim, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.5, textTransform:"uppercase" }}>{cat.label}</td>
                      {h2hData.drivers.map((d, i) => {
                        const v = h2hData.stats[d][cat.key];
                        const nd = h2hData.stats[d].noData;
                        const isBest = !nd && v === best && vals.filter(x=>x===best).length < vals.length;
                        const display = nd ? "No data" : v == null ? "—" : cat.fmt ? v.toFixed(cat.fmt) : v;
                        return (
                          <td key={d} style={{ textAlign:"center", padding:"8px", fontWeight:isBest?800:500, color:nd?T.textDim:isBest?T.green:T.textMid, fontStyle:nd?"italic":"normal", fontSize:nd?10:12 }}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pairwise head-to-head records */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:20 }}>
            <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:14, textAlign:"center" }}>Pairwise Head-to-Head Records{h2hTrackFilter !== "All" ? ` — ${h2hTrackFilter.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}` : ""}</div>
            <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${h2hData.drivers.length > 2 ? 220 : 280}px, 1fr))`, gap:12 }}>
              {Object.entries(h2hData.pairwise).map(([pk, rec]) => {
                const [d1, d2] = pk.split("|");
                const c1 = H2H_COLORS[selectedDrivers.indexOf(d1)];
                const c2 = H2H_COLORS[selectedDrivers.indexOf(d2)];
                const total = rec.d1 + rec.d2 + rec.ties;
                return (
                  <div key={pk} style={{ background:T.surface2, border:`1px solid ${T.border}`, borderRadius:10, padding:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:c1, fontFamily:"'Barlow Condensed',sans-serif" }}>{d1.split(" ").pop()}</span>
                      <span style={{ fontSize:9, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>{total} shared</span>
                      <span style={{ fontSize:12, fontWeight:700, color:c2, fontFamily:"'Barlow Condensed',sans-serif" }}>{d2.split(" ").pop()}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:16, marginBottom:10 }}>
                      <div style={{ fontSize:28, fontWeight:900, color:rec.d1>=rec.d2?c1:T.textDim, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{rec.d1}</div>
                      <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>{rec.ties > 0 ? `${rec.ties}T` : "—"}</div>
                      <div style={{ fontSize:28, fontWeight:900, color:rec.d2>=rec.d1?c2:T.textDim, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{rec.d2}</div>
                    </div>
                    {/* Mini track type breakdown */}
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {Object.entries(h2hData.pairByType[pk]).map(([type, tr]) => {
                        if (tr.d1 + tr.d2 === 0) return null;
                        const tc = CSV_TYPE_COLORS[type] || T.textDim;
                        return (
                          <div key={type} style={{ fontSize:8, padding:"2px 6px", borderRadius:4, background:`${tc}15`, color:tc, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1 }}>
                            {type.substring(0,3).toUpperCase()} {tr.d1}-{tr.d2}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Avg Finish Trend chart */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:20 }}>
            <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:14, textAlign:"center" }}>Avg Finish by Season{h2hTrackFilter !== "All" ? ` — ${h2hTrackFilter.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}` : ""}</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={h2hData.yearlyTrend} margin={{ top:5, right:20, left:0, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="year" tick={{ fill:T.textDim, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" }} stroke={T.border} />
                <YAxis reversed tick={{ fill:T.textDim, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" }} stroke={T.border} domain={["auto","auto"]} />
                <Tooltip contentStyle={{ background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, fontSize:11, fontFamily:"'IBM Plex Mono',monospace" }} labelStyle={{ color:T.text, fontWeight:700 }} />
                {h2hData.drivers.map((d, i) => (
                  <Line key={d} type="monotone" dataKey={d} stroke={H2H_COLORS[selectedDrivers.indexOf(d)]} strokeWidth={2} dot={{ r:3 }} name={d.split(" ").pop()} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {!ready && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 20px", gap:12, textAlign:"center" }}>
          <div style={{ fontSize:28 }}>⚔️</div>
          <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:2, textTransform:"uppercase", color:T.textMid }}>Select 2–4 Drivers to Compare</div>
          <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>Choose from the dropdowns above · Drivers 3 & 4 are optional</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TEAM HEAD-TO-HEAD — Sub-tab
// ─────────────────────────────────────────────────────────────


export function DaTeamH2H({ csvData, incrementTool }) {
  const [selectedTeams, setSelectedTeams] = useState(["","","",""]);
  const [teamH2hTrackFilter, setTeamH2hTrackFilter] = useState("All");

  // All tracks from CSV for the filter dropdown
  const teamH2hAllTracks = useMemo(() => {
    const ts = new Set();
    for (const r of csvData) { if (r[1]) ts.add(r[1]); }
    return [...ts].sort();
  }, [csvData]);

  // Full (unfiltered) byDriver for checking driver existence in rosters
  const byDriverFull = useMemo(() => {
    const bd = {};
    for (const r of csvData) {
      const d = r[0]; if (!d) continue;
      if (!bd[d]) bd[d] = [];
      bd[d].push(r);
    }
    return bd;
  }, [csvData]);

  // Filtered byDriver (applies track filter)
  const byDriver = useMemo(() => {
    if (teamH2hTrackFilter === "All") return byDriverFull;
    const bd = {};
    for (const r of csvData) {
      const d = r[0]; if (!d) continue;
      if (r[1] !== teamH2hTrackFilter) continue;
      if (!bd[d]) bd[d] = [];
      bd[d].push(r);
    }
    return bd;
  }, [csvData, teamH2hTrackFilter, byDriverFull]);

  const setTeam = (idx, val) => {
    setSelectedTeams(prev => { const next = [...prev]; next[idx] = val; return next; });
  };

  const activeTeams = selectedTeams.filter(t => t !== "");
  const uniqueActive = [...new Set(activeTeams)];
  const ready = uniqueActive.length >= 2 && uniqueActive.length === activeTeams.length;

  // Track usage when a valid comparison is formed
  const prevReady = useRef(false);
  useEffect(() => {
    if (ready && !prevReady.current) incrementTool?.("team_h2h");
    prevReady.current = ready;
  }, [ready]);

  // Compute team-level stats
  const teamData = useMemo(() => {
    if (!ready) return null;
    const teams = uniqueActive;

    function teamStats(teamName) {
      const drivers = (TEAM_ROSTER_2026[teamName] || []).filter(d => byDriver[d]);
      const allRaces = drivers.flatMap(d => byDriver[d] || []);
      const finishes = allRaces.map(r => r[3]).filter(v => v > 0);
      return {
        teamName,
        drivers,
        noData: allRaces.length === 0,
        driverCount: drivers.length,
        totalRaces: allRaces.length,
        wins: finishes.filter(f => f === 1).length,
        top5: finishes.filter(f => f <= 5).length,
        top10: finishes.filter(f => f <= 10).length,
        avgFinish: finishes.length ? finishes.reduce((a,b)=>a+b,0)/finishes.length : null,
        bestFinish: finishes.length ? Math.min(...finishes) : null,
        lapsLed: allRaces.reduce((a,r) => a + (r[5]||0), 0),
      };
    }

    const stats = {};
    for (const t of teams) stats[t] = teamStats(t);

    // Yearly trend per team
    const years = [...new Set(csvData.map(r => r[2]))].sort();
    const yearlyTrend = years.map(yr => {
      const row = { year: yr };
      for (const t of teams) {
        const drivers = (TEAM_ROSTER_2026[t] || []).filter(d => byDriver[d]);
        const allFinishes = drivers.flatMap(d => (byDriver[d] || []).filter(r => r[2] === yr).map(r => r[3])).filter(v => v > 0);
        row[t] = allFinishes.length ? +(allFinishes.reduce((a,b)=>a+b,0)/allFinishes.length).toFixed(1) : null;
      }
      return row;
    });

    // Wins per year for bar chart
    const winsPerYear = years.map(yr => {
      const row = { year: yr };
      for (const t of teams) {
        const drivers = (TEAM_ROSTER_2026[t] || []).filter(d => byDriver[d]);
        row[t] = drivers.flatMap(d => (byDriver[d] || []).filter(r => r[2] === yr && r[3] === 1)).length;
      }
      return row;
    });

    return { teams, stats, yearlyTrend, winsPerYear };
  }, [ready, uniqueActive.join(","), byDriver, csvData, teamH2hTrackFilter]);

  const selStyle = { width:"100%", padding:"10px 14px", background:T.surface2, color:T.text, border:`1px solid ${T.border2}`, borderRadius:8, fontSize:13, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer", outline:"none" };
  const labelStyle = { fontSize:10, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:8 };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Track filter */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
        <div style={{ flex:1, minWidth:180, maxWidth:360 }}>
          <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:6 }}>Filter by Track</div>
          <select value={teamH2hTrackFilter} onChange={e=>{setTeamH2hTrackFilter(e.target.value);}}
            style={{ width:"100%", padding:"7px 12px", background:T.surface2, color:T.text, border:`1px solid ${teamH2hTrackFilter!=="All"?T.accent:T.border}`, borderRadius:8, fontSize:12, fontWeight:600, fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer", outline:"none" }}>
            <option value="All">All Tracks</option>
            {teamH2hAllTracks.map(t => <option key={t} value={t}>{t.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}</option>)}
          </select>
        </div>
        {teamH2hTrackFilter !== "All" && (
          <div style={{ fontSize:10, color:CSV_TYPE_COLORS[CSV_TRACK_TYPES[teamH2hTrackFilter]||"Unknown"]||T.textDim, fontFamily:"'IBM Plex Mono',monospace", padding:"8px 0" }}>
            {CSV_TRACK_TYPES[teamH2hTrackFilter] || "Unknown"} — {teamH2hTrackFilter}
          </div>
        )}
      </div>

      {/* Team selectors */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:12 }}>
        {[0,1,2,3].map(idx => {
          const others = selectedTeams.filter((t,i) => i !== idx && t !== "");
          const color = H2H_COLORS[idx];
          return (
            <div key={idx} style={{ background:T.surface, border:`1px solid ${selectedTeams[idx]?color:T.border}`, borderRadius:12, padding:16, transition:"border-color 0.2s" }}>
              <div style={{ ...labelStyle, color: selectedTeams[idx] ? color : T.textDim }}>Team {idx+1}{idx >= 2 ? " (optional)" : ""}</div>
              <select value={selectedTeams[idx]} onChange={e=>setTeam(idx, e.target.value)} style={selStyle}>
                <option value="">— {idx >= 2 ? "Optional" : "Select"} —</option>
                {TEAM_NAMES_2026.filter(t=>!others.includes(t)).map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              {selectedTeams[idx] && (
                <div style={{ marginTop:8, fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", lineHeight:1.6 }}>
                  {(TEAM_ROSTER_2026[selectedTeams[idx]] || []).join(" · ")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {teamData && (
        <>
          {/* Stat comparison table */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:20, overflowX:"auto" }}>
            <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:14, textAlign:"center" }}>Team Comparison (All Drivers Combined){teamH2hTrackFilter !== "All" ? ` — ${teamH2hTrackFilter.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}` : ""}</div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:"'IBM Plex Mono',monospace" }}>
              <thead>
                <tr>
                  <th style={{ textAlign:"left", padding:"6px 8px", fontSize:10, color:T.textDim, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.5, textTransform:"uppercase", borderBottom:`1px solid ${T.border}` }}>Stat</th>
                  {teamData.teams.map(t => (
                    <th key={t} style={{ textAlign:"center", padding:"6px 8px", color:H2H_COLORS[selectedTeams.indexOf(t)], fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, letterSpacing:0.5, borderBottom:`1px solid ${T.border}` }}>{t.replace(" Motorsports","").replace(" Racing","").replace(" Motor Club","").replace(" Factory Team","")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key:"driverCount", label:"Drivers", lb:false },
                  { key:"totalRaces", label:"Total Races", lb:false },
                  { key:"wins", label:"Wins", lb:false },
                  { key:"top5", label:"Top 5s", lb:false },
                  { key:"top10", label:"Top 10s", lb:false },
                  { key:"avgFinish", label:"Avg Finish", lb:true, fmt:1 },
                  { key:"bestFinish", label:"Best Finish", lb:true },
                  { key:"lapsLed", label:"Laps Led", lb:false },
                ].map(cat => {
                  const vals = teamData.teams.map(t => teamData.stats[t][cat.key] ?? 0);
                  const best = cat.lb ? Math.min(...vals.filter(v=>v>0)) : Math.max(...vals);
                  return (
                    <tr key={cat.key} style={{ borderBottom:`1px solid ${T.border}` }}>
                      <td style={{ padding:"8px", fontSize:10, color:T.textDim, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.5, textTransform:"uppercase" }}>{cat.label}</td>
                      {teamData.teams.map(t => {
                        const v = teamData.stats[t][cat.key];
                        const nd = teamData.stats[t].noData;
                        const isBest = !nd && v === best && vals.filter(x=>x===best).length < vals.length;
                        const display = nd ? "No data" : v == null ? "—" : cat.fmt ? v.toFixed(cat.fmt) : v;
                        return (
                          <td key={t} style={{ textAlign:"center", padding:"8px", fontWeight:isBest?800:500, color:nd?T.textDim:isBest?T.green:T.textMid, fontStyle:nd?"italic":"normal", fontSize:nd?10:12 }}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Avg Finish trend */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:20 }}>
            <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:14, textAlign:"center" }}>Team Avg Finish by Season{teamH2hTrackFilter !== "All" ? ` — ${teamH2hTrackFilter.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}` : ""}</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={teamData.yearlyTrend} margin={{ top:5, right:20, left:0, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="year" tick={{ fill:T.textDim, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" }} stroke={T.border} />
                <YAxis reversed tick={{ fill:T.textDim, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" }} stroke={T.border} domain={["auto","auto"]} />
                <Tooltip contentStyle={{ background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, fontSize:11, fontFamily:"'IBM Plex Mono',monospace" }} labelStyle={{ color:T.text, fontWeight:700 }} />
                {teamData.teams.map(t => (
                  <Line key={t} type="monotone" dataKey={t} stroke={H2H_COLORS[selectedTeams.indexOf(t)]} strokeWidth={2} dot={{ r:3 }} name={t.replace(" Motorsports","").replace(" Racing","").replace(" Motor Club","").replace(" Factory Team","")} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Wins per year bar chart */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:20 }}>
            <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:14, textAlign:"center" }}>Wins by Season{teamH2hTrackFilter !== "All" ? ` — ${teamH2hTrackFilter.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}` : ""}</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={teamData.winsPerYear} margin={{ top:5, right:20, left:0, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="year" tick={{ fill:T.textDim, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" }} stroke={T.border} />
                <YAxis tick={{ fill:T.textDim, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" }} stroke={T.border} allowDecimals={false} />
                <Tooltip contentStyle={{ background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, fontSize:11, fontFamily:"'IBM Plex Mono',monospace" }} labelStyle={{ color:T.text, fontWeight:700 }} />
                {teamData.teams.map(t => (
                  <Bar key={t} dataKey={t} fill={H2H_COLORS[selectedTeams.indexOf(t)]} name={t.replace(" Motorsports","").replace(" Racing","").replace(" Motor Club","").replace(" Factory Team","")} radius={[3,3,0,0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-driver breakdown within each team */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:20 }}>
            <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:14, textAlign:"center" }}>Individual Driver Breakdown{teamH2hTrackFilter !== "All" ? ` — ${teamH2hTrackFilter.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}` : ""}</div>
            <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(200px, 1fr))`, gap:12 }}>
              {teamData.teams.map(t => {
                const color = H2H_COLORS[selectedTeams.indexOf(t)];
                const drivers = (TEAM_ROSTER_2026[t] || []).filter(d => byDriver[d]);
                return (
                  <div key={t} style={{ background:T.surface2, border:`1px solid ${T.border}`, borderRadius:10, padding:14 }}>
                    <div style={{ fontSize:11, fontWeight:700, color, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase", marginBottom:10, borderBottom:`1px solid ${T.border}`, paddingBottom:8 }}>{t}</div>
                    {drivers.map(d => {
                      const races = byDriver[d] || [];
                      const finishes = races.map(r => r[3]).filter(v => v > 0);
                      const avg = finishes.length ? (finishes.reduce((a,b)=>a+b,0)/finishes.length).toFixed(1) : "—";
                      const wins = finishes.filter(f => f === 1).length;
                      const t5 = finishes.filter(f => f <= 5).length;
                      return (
                        <div key={d} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", fontSize:11 }}>
                          <span style={{ color:T.text, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600 }}>{d}</span>
                          <span style={{ color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>
                            {avg} avg · {wins}W · {t5}T5
                          </span>
                        </div>
                      );
                    })}
                    {drivers.length === 0 && <div style={{ fontSize:10, color:T.textDim, fontStyle:"italic" }}>{teamH2hTrackFilter !== "All" ? "No data at this track" : "No CSV data"}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!ready && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 20px", gap:12, textAlign:"center" }}>
          <div style={{ fontSize:28 }}>🏁</div>
          <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:2, textTransform:"uppercase", color:T.textMid }}>Select 2–4 Teams to Compare</div>
          <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>Choose from the dropdowns above · Teams 3 & 4 are optional</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CONSISTENCY SCORE — Sub-tab 3
// ─────────────────────────────────────────────────────────────


export function DaConsistencyScore({ csvData }) {
  const [sortCol, setSortCol] = useState("consistency");
  const [sortAsc, setSortAsc] = useState(false);

  const leaderboard = useMemo(() => {
    const byDriver = {};
    for (const r of csvData) {
      const d = r[0]; if (!d) continue;
      if (!byDriver[d]) byDriver[d] = [];
      byDriver[d].push(r);
    }

    return FULL_TIMER_NAMES.filter(n => byDriver[n]).map(name => {
      const races = byDriver[name];
      const finishes = races.map(r => r[3]).filter(v => v > 0);
      if (finishes.length < 3) return null;

      const avg = finishes.reduce((a,b)=>a+b,0) / finishes.length;
      const variance = finishes.reduce((sum, f) => sum + Math.pow(f - avg, 2), 0) / finishes.length;
      const stdDev = Math.sqrt(variance);
      // Consistency score: 100 - (stdDev * scaling factor), clamped to 0-100
      // Lower std dev = higher consistency score
      const consistency = Math.max(0, Math.min(100, Math.round(100 - stdDev * 4)));

      return {
        name,
        consistency,
        avgFinish: avg,
        stdDev,
        bestFinish: Math.min(...finishes),
        worstFinish: Math.max(...finishes),
        races: races.length,
      };
    }).filter(Boolean);
  }, [csvData]);

  const sorted = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (sortCol === "name") return sortAsc ? (av||"").localeCompare(bv||"") : (bv||"").localeCompare(av||"");
      if (av == null) av = sortAsc ? 9999 : -9999;
      if (bv == null) bv = sortAsc ? 9999 : -9999;
      return sortAsc ? av - bv : bv - av;
    });
  }, [leaderboard, sortCol, sortAsc]);

  function toggleSort(col) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(col === "name" || col === "avgFinish" || col === "stdDev" || col === "bestFinish"); }
  }

  function consistencyColor(score) {
    if (score >= 75) return T.green;
    if (score >= 55) return T.gold;
    return T.red;
  }

  function consistencyLabel(score) {
    if (score >= 75) return "CONSISTENT";
    if (score >= 55) return "MODERATE";
    return "STREAKY";
  }

  const CSortHeader = ({ col, label, w, align }) => {
    const active = sortCol === col;
    return (
      <th onClick={()=>toggleSort(col)} style={{ padding:"8px 6px", textAlign:align||"right", fontSize:9, color:active?T.accent:T.textDim, fontWeight:700, letterSpacing:1.5, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", cursor:"pointer", userSelect:"none", width:w||"auto", whiteSpace:"nowrap" }}>
        {label} {active ? (sortAsc ? "▲" : "▼") : ""}
      </th>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:16 }}>
        <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:4 }}>How It Works</div>
        <div style={{ fontSize:12, color:T.textMid, fontFamily:"'IBM Plex Mono',monospace", lineHeight:1.6 }}>
          Consistency measures how predictably a driver finishes. Lower variance in finish positions = higher score. Score of 100 = perfectly consistent, 0 = wildly unpredictable.
        </div>
      </div>

      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:700 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                <th style={{ padding:"8px 10px", textAlign:"center", fontSize:9, color:T.textDim, fontWeight:700, letterSpacing:1.5, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", width:35 }}>#</th>
                <CSortHeader col="name" label="Driver" align="left" />
                <CSortHeader col="consistency" label="Score" />
                <CSortHeader col="avgFinish" label="Avg Fin" />
                <CSortHeader col="stdDev" label="Std Dev" />
                <CSortHeader col="bestFinish" label="Best" />
                <CSortHeader col="worstFinish" label="Worst" />
                <CSortHeader col="races" label="Races" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const cColor = consistencyColor(row.consistency);
                const cLabel = consistencyLabel(row.consistency);
                return (
                  <tr key={row.name} style={{ borderBottom:`1px solid ${T.border}33`, background:i%2===0?"transparent":`${T.surface2}55` }}>
                    <td style={{ padding:"8px 10px", textAlign:"center", fontSize:11, fontWeight:700, color:T.textDim, fontFamily:"'Barlow Condensed',sans-serif" }}>{i+1}</td>
                    <td style={{ padding:"8px 10px", fontWeight:700, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:0.5 }}>{row.name}</td>
                    <td style={{ padding:"8px 6px", textAlign:"right" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end" }}>
                        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:800, fontSize:14, color:cColor }}>{row.consistency}</span>
                        <span style={{ fontSize:8, fontWeight:700, color:cColor, background:`${cColor}22`, padding:"2px 6px", borderRadius:3, letterSpacing:1, fontFamily:"'Barlow Condensed',sans-serif" }}>{cLabel}</span>
                      </div>
                    </td>
                    <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.text, fontWeight:700 }}>{row.avgFinish.toFixed(1)}</td>
                    <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.textMid, fontSize:11 }}>{row.stdDev.toFixed(1)}</td>
                    <td style={{ padding:"8px 6px", textAlign:"right" }}>{row.bestFinish ? <FinishBadge pos={row.bestFinish} /> : "—"}</td>
                    <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.textMid }}>{row.worstFinish || "—"}</td>
                    <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.textMid }}>{row.races}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BAD DAY / GOOD DAY RISK — Sub-tab 4
// ─────────────────────────────────────────────────────────────


export function DaBadDayRisk({ csvData, incrementTool }) {
  const [mode, setMode] = useState("bad"); // "bad" or "good"
  const [sortCol, setSortCol] = useState("collapseRate");
  const [sortAsc, setSortAsc] = useState(false);
  const [selDriver, setSelDriver] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [trackFilter, setTrackFilter] = useState("All");

  useEffect(() => { incrementTool?.("good_bad_day"); }, []);

  // Get unique tracks from CSV
  const allTracks = useMemo(() => {
    const ts = new Set();
    for (const r of csvData) { if (r[1]) ts.add(r[1]); }
    return [...ts].sort();
  }, [csvData]);

  // Tracks filtered by type
  const tracksForType = useMemo(() => {
    if (typeFilter === "All") return allTracks;
    return allTracks.filter(t => (CSV_TRACK_TYPES[t] || "Unknown") === typeFilter);
  }, [allTracks, typeFilter]);

  // Filter CSV rows by track type and specific track
  const filteredCsv = useMemo(() => {
    let rows = csvData;
    if (typeFilter !== "All") rows = rows.filter(r => (CSV_TRACK_TYPES[r[1]] || "Unknown") === typeFilter);
    if (trackFilter !== "All") rows = rows.filter(r => r[1] === trackFilter);
    return rows;
  }, [csvData, typeFilter, trackFilter]);

  const leaderboard = useMemo(() => {
    const byDriver = {};
    for (const r of filteredCsv) {
      const d = r[0]; if (!d) continue;
      if (!byDriver[d]) byDriver[d] = [];
      byDriver[d].push(r);
    }

    return FULL_TIMER_NAMES.filter(n => byDriver[n]).map(name => {
      const races = byDriver[name];
      const totalRaces = races.length;

      // Bad day metrics
      const collapses = races.filter(r => r[3] > 0 && r[4] > 0 && (r[3] - r[4]) >= 10);
      const badDays = races.filter(r => r[3] > 0 && r[4] > 0 && (r[3] - r[4]) >= 15);
      const collapseRate = totalRaces > 0 ? (collapses.length / totalRaces) * 100 : 0;
      const badDayRate = totalRaces > 0 ? (badDays.length / totalRaces) * 100 : 0;
      const posLost = collapses.map(r => r[3] - r[4]);
      const avgPosLost = posLost.length ? posLost.reduce((a,b)=>a+b,0)/posLost.length : 0;
      const worstDrop = posLost.length ? Math.max(...posLost) : 0;

      // Good day metrics — finished 10+ positions BETTER than started
      const surges = races.filter(r => r[3] > 0 && r[4] > 0 && (r[4] - r[3]) >= 10);
      const greatDays = races.filter(r => r[3] > 0 && r[4] > 0 && (r[4] - r[3]) >= 15);
      const surgeRate = totalRaces > 0 ? (surges.length / totalRaces) * 100 : 0;
      const greatDayRate = totalRaces > 0 ? (greatDays.length / totalRaces) * 100 : 0;
      const posGained = surges.map(r => r[4] - r[3]);
      const avgPosGained = posGained.length ? posGained.reduce((a,b)=>a+b,0)/posGained.length : 0;
      const bestSurge = posGained.length ? Math.max(...posGained) : 0;

      // By track type (for detail panel)
      const byType = {};
      for (const r of races) {
        const type = CSV_TRACK_TYPES[r[1]] || "Unknown";
        if (!byType[type]) byType[type] = { races:0, collapses:0, surges:0 };
        byType[type].races++;
        if (r[3] > 0 && r[4] > 0 && (r[3] - r[4]) >= 10) byType[type].collapses++;
        if (r[3] > 0 && r[4] > 0 && (r[4] - r[3]) >= 10) byType[type].surges++;
      }

      // Worst collapses / best surges
      const worstRaces = collapses
        .map(r => ({ track:r[1], year:r[2], start:r[4], finish:r[3], delta:r[3]-r[4] }))
        .sort((a,b) => b.delta - a.delta).slice(0, 5);
      const bestRaces = surges
        .map(r => ({ track:r[1], year:r[2], start:r[4], finish:r[3], delta:r[4]-r[3] }))
        .sort((a,b) => b.delta - a.delta).slice(0, 5);

      return {
        name, totalRaces,
        collapses:collapses.length, badDays:badDays.length, collapseRate, badDayRate, avgPosLost, worstDrop, worstRaces,
        surges:surges.length, greatDays:greatDays.length, surgeRate, greatDayRate, avgPosGained, bestSurge, bestRaces,
        byType, highRisk: collapseRate >= 20, hotStreak: surgeRate >= 20,
      };
    });
  }, [filteredCsv]);

  // Reset sort when mode changes
  useEffect(() => {
    setSortCol(mode === "bad" ? "collapseRate" : "surgeRate");
    setSortAsc(false);
    setSelDriver("");
  }, [mode]);

  const sorted = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (sortCol === "name") return sortAsc ? (av||"").localeCompare(bv||"") : (bv||"").localeCompare(av||"");
      if (av == null) av = sortAsc ? 9999 : -9999;
      if (bv == null) bv = sortAsc ? 9999 : -9999;
      return sortAsc ? av - bv : bv - av;
    });
  }, [leaderboard, sortCol, sortAsc]);

  function toggleSort(col) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(col === "name"); }
  }

  const driverDetail = useMemo(() => {
    if (!selDriver) return null;
    return leaderboard.find(d => d.name === selDriver);
  }, [selDriver, leaderboard]);

  const BSortHeader = ({ col, label, w, align }) => {
    const active = sortCol === col;
    return (
      <th onClick={()=>toggleSort(col)} style={{ padding:"8px 6px", textAlign:align||"right", fontSize:9, color:active?T.accent:T.textDim, fontWeight:700, letterSpacing:1.5, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", cursor:"pointer", userSelect:"none", width:w||"auto", whiteSpace:"nowrap" }}>
        {label} {active ? (sortAsc ? "▲" : "▼") : ""}
      </th>
    );
  };

  const isBad = mode === "bad";
  const modeAccent = isBad ? T.red : T.green;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Mode toggle + filters */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
        {/* Mode toggle */}
        <div>
          <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:6 }}>Mode</div>
          <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:`1px solid ${T.border}` }}>
            {[{id:"bad",label:"Bad Days",icon:"📉",color:T.red},{id:"good",label:"Good Days",icon:"📈",color:T.green}].map(m => {
              const active = mode === m.id;
              return (
                <button key={m.id} onClick={()=>setMode(m.id)} style={{
                  padding:"8px 16px", fontSize:11, fontWeight:active?800:500, border:"none", cursor:"pointer",
                  background:active?`${m.color}22`:T.surface2, color:active?m.color:T.textDim,
                  fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase",
                  borderRight: m.id==="bad" ? `1px solid ${T.border}` : "none",
                }}>{m.icon} {m.label}</button>
              );
            })}
          </div>
        </div>

        {/* Track type filter */}
        <div>
          <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:6 }}>Track Type</div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {["All","Intermediate","Short Track","Road Course","Superspeedway","Dirt"].map(type => {
              const active = typeFilter === type;
              const color = type === "All" ? T.accent : CSV_TYPE_COLORS[type] || T.textMid;
              return (
                <button key={type} onClick={()=>{setTypeFilter(type);setTrackFilter("All");setSelDriver("");}} style={{
                  padding:"5px 11px", fontSize:10, fontWeight:active?700:500, borderRadius:6, cursor:"pointer",
                  background:active?`${color}33`:T.surface2, color:active?color:T.textDim,
                  border:`1px solid ${active?`${color}66`:T.border}`,
                  fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase",
                }}>{type === "All" ? "All Types" : type}</button>
              );
            })}
          </div>
        </div>

        {/* Specific track filter */}
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:6 }}>Track</div>
          <select value={trackFilter} onChange={e=>{setTrackFilter(e.target.value);setSelDriver("");}}
            style={{ width:"100%", maxWidth:300, padding:"7px 12px", background:T.surface2, color:T.text, border:`1px solid ${T.border}`, borderRadius:8, fontSize:12, fontWeight:600, fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer", outline:"none" }}>
            <option value="All">All Tracks</option>
            {tracksForType.map(t => <option key={t} value={t}>{t.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}</option>)}
          </select>
        </div>
      </div>

      {/* Explainer */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:14 }}>
        <div style={{ fontSize:12, color:T.textMid, fontFamily:"'IBM Plex Mono',monospace", lineHeight:1.6 }}>
          {isBad ? (
            <>A <span style={{ color:T.gold }}>collapse</span> = finished 10+ spots worse than started. A <span style={{ color:T.red }}>bad day</span> = finished 15+ spots worse. Measures how often a driver's race falls apart. ⚠️ flags drivers with a 20%+ collapse rate.</>
          ) : (
            <>A <span style={{ color:T.accent }}>surge</span> = finished 10+ spots better than started. A <span style={{ color:T.green }}>great day</span> = finished 15+ spots better. Measures how often a driver charges through the field. 🔥 flags drivers with a 20%+ surge rate.</>
          )}
          {(typeFilter !== "All" || trackFilter !== "All") && (
            <span style={{ color:T.textDim }}> — Filtered to {trackFilter !== "All" ? trackFilter.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"") : typeFilter} races only.</span>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:700 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                <th style={{ padding:"8px 10px", textAlign:"center", fontSize:9, color:T.textDim, fontWeight:700, letterSpacing:1.5, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", width:35 }}>#</th>
                <BSortHeader col="name" label="Driver" align="left" />
                {isBad ? (
                  <>
                    <BSortHeader col="collapseRate" label="Collapse %" />
                    <BSortHeader col="collapses" label="Collapses" />
                    <BSortHeader col="badDays" label="Bad Days" />
                    <BSortHeader col="avgPosLost" label="Avg Drop" />
                    <BSortHeader col="worstDrop" label="Worst" />
                  </>
                ) : (
                  <>
                    <BSortHeader col="surgeRate" label="Surge %" />
                    <BSortHeader col="surges" label="Surges" />
                    <BSortHeader col="greatDays" label="Great Days" />
                    <BSortHeader col="avgPosGained" label="Avg Gain" />
                    <BSortHeader col="bestSurge" label="Best" />
                  </>
                )}
                <BSortHeader col="totalRaces" label="Races" />
                <th style={{ padding:"8px 6px", textAlign:"center", fontSize:9, color:T.textDim, fontWeight:700, letterSpacing:1.5, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", width:30 }}></th>
                <th style={{ padding:"8px 6px", textAlign:"center", fontSize:9, color:T.textDim, fontWeight:700, letterSpacing:1.5, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", width:50 }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const rate = isBad ? row.collapseRate : row.surgeRate;
                const rateColor = isBad
                  ? (rate >= 20 ? T.red : rate >= 12 ? T.gold : T.green)
                  : (rate >= 20 ? T.green : rate >= 12 ? T.accent : T.textDim);
                return (
                  <tr key={row.name} style={{ borderBottom:`1px solid ${T.border}33`, background:i%2===0?"transparent":`${T.surface2}55` }}>
                    <td style={{ padding:"8px 10px", textAlign:"center", fontSize:11, fontWeight:700, color:T.textDim, fontFamily:"'Barlow Condensed',sans-serif" }}>{i+1}</td>
                    <td style={{ padding:"8px 10px", fontWeight:700, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:0.5 }}>{row.name}</td>
                    {isBad ? (
                      <>
                        <td style={{ padding:"8px 6px", textAlign:"right" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end" }}>
                            <div style={{ width:50, height:5, borderRadius:3, background:T.surface2, overflow:"hidden" }}>
                              <div style={{ width:`${Math.min(100,row.collapseRate*2.5)}%`, height:"100%", background:rateColor, borderRadius:3 }} />
                            </div>
                            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, fontSize:12, color:rateColor }}>{row.collapseRate.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:row.collapses>0?T.gold:T.textDim, fontWeight:700 }}>{row.collapses}</td>
                        <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:row.badDays>0?T.red:T.textDim, fontWeight:700 }}>{row.badDays}</td>
                        <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.textMid }}>{row.avgPosLost > 0 ? `−${row.avgPosLost.toFixed(1)}` : "—"}</td>
                        <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:row.worstDrop>=20?T.red:T.textMid }}>{row.worstDrop > 0 ? `−${row.worstDrop}` : "—"}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding:"8px 6px", textAlign:"right" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end" }}>
                            <div style={{ width:50, height:5, borderRadius:3, background:T.surface2, overflow:"hidden" }}>
                              <div style={{ width:`${Math.min(100,row.surgeRate*2.5)}%`, height:"100%", background:rateColor, borderRadius:3 }} />
                            </div>
                            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, fontSize:12, color:rateColor }}>{row.surgeRate.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:row.surges>0?T.accent:T.textDim, fontWeight:700 }}>{row.surges}</td>
                        <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:row.greatDays>0?T.green:T.textDim, fontWeight:700 }}>{row.greatDays}</td>
                        <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.textMid }}>{row.avgPosGained > 0 ? `+${row.avgPosGained.toFixed(1)}` : "—"}</td>
                        <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:row.bestSurge>=20?T.green:T.textMid }}>{row.bestSurge > 0 ? `+${row.bestSurge}` : "—"}</td>
                      </>
                    )}
                    <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.textMid }}>{row.totalRaces}</td>
                    <td style={{ padding:"8px 6px", textAlign:"center" }}>
                      {isBad && row.highRisk && <span style={{ color:T.red, fontSize:14 }} title="High Collapse Risk">⚠️</span>}
                      {!isBad && row.hotStreak && <span style={{ color:T.green, fontSize:14 }} title="Frequent Charger">🔥</span>}
                    </td>
                    <td style={{ padding:"8px 6px", textAlign:"center" }}>
                      <button onClick={()=>setSelDriver(row.name===selDriver?"":row.name)} style={{ background:row.name===selDriver?T.accentSoft:"transparent", color:row.name===selDriver?T.accent:T.textDim, border:`1px solid ${row.name===selDriver?T.accent:T.border}`, borderRadius:6, padding:"3px 10px", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" }}>
                        {row.name===selDriver?"Hide":"View"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver detail panel */}
      {driverDetail && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:16, fontWeight:900, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:2, textTransform:"uppercase", color:T.text, marginBottom:4 }}>{driverDetail.name}</div>
          <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", marginBottom:16 }}>
            {isBad
              ? `${driverDetail.collapses} collapses (${driverDetail.collapseRate.toFixed(1)}%) · ${driverDetail.badDays} bad days (${driverDetail.badDayRate.toFixed(1)}%) · ${driverDetail.totalRaces} races`
              : `${driverDetail.surges} surges (${driverDetail.surgeRate.toFixed(1)}%) · ${driverDetail.greatDays} great days (${driverDetail.greatDayRate.toFixed(1)}%) · ${driverDetail.totalRaces} races`
            }
          </div>

          {/* By track type */}
          <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:10 }}>{isBad ? "Collapses" : "Surges"} by Track Type</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:8, marginBottom:20 }}>
            {Object.entries(driverDetail.byType).filter(([type])=>type!=="Unknown").map(([type, v]) => {
              const color = CSV_TYPE_COLORS[type] || T.textMid;
              const count = isBad ? v.collapses : v.surges;
              const rate = v.races > 0 ? (count/v.races*100).toFixed(1) : "0.0";
              const valColor = count > 0 ? (isBad ? T.gold : T.green) : T.textDim;
              return (
                <div key={type} style={{ background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:9, color, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:6 }}>{type}</div>
                  <div style={{ fontSize:18, fontWeight:900, color:valColor, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{count}</div>
                  <div style={{ fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", marginTop:2 }}>{rate}% · {v.races} races</div>
                </div>
              );
            })}
          </div>

          {/* Notable races */}
          {(() => {
            const races = isBad ? driverDetail.worstRaces : driverDetail.bestRaces;
            if (races.length === 0) return null;
            return (
              <>
                <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:10 }}>{isBad ? "Worst Collapses" : "Best Surges"}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {races.map((race, idx) => {
                    const trackType = CSV_TRACK_TYPES[race.track] || "Unknown";
                    const typeColor = CSV_TYPE_COLORS[trackType] || T.textDim;
                    const deltaColor = isBad ? T.red : T.green;
                    const deltaPrefix = isBad ? "−" : "+";
                    return (
                      <div key={idx} style={{ display:"flex", alignItems:"center", gap:10, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 14px", flexWrap:"wrap" }}>
                        <span style={{ flex:1, minWidth:120, fontWeight:700, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, letterSpacing:0.5 }}>{race.track.replace(/ (Motor |International )?(Speedway|Raceway|International)/g,"")}</span>
                        <span style={{ fontSize:9, color:typeColor, background:`${typeColor}22`, padding:"2px 6px", borderRadius:3, fontWeight:700, letterSpacing:1, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase" }}>{trackType}</span>
                        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:T.textMid }}>{race.year}</span>
                        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:isBad?T.green:T.textMid }}>P{race.start}</span>
                        <span style={{ color:T.textDim }}>→</span>
                        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:isBad?T.red:T.green }}>P{race.finish}</span>
                        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:deltaColor, fontWeight:700 }}>{deltaPrefix}{race.delta}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOOP DATA — Sub-tab 6: season loop-data leaderboard
// ─────────────────────────────────────────────────────────────


export function DaLoopData({ csvData }) {
  const [sortCol, setSortCol] = useState("arp");
  const [sortAsc, setSortAsc] = useState(true);

  const leaderboard = useMemo(() => {
    if (!csvData.length) return [];
    const season = Math.max(...csvData.map(r => r[2]));
    const byDriver = {};
    for (const r of csvData) {
      if (r[2] !== season) continue;
      const d = r[0]; if (!d) continue;
      if (!byDriver[d]) byDriver[d] = [];
      byDriver[d].push(r);
    }
    return FULL_TIMER_NAMES.filter(n => byDriver[n]).map(name => {
      const races = byDriver[n].filter(r => (r[12] || 0) > 0);
      if (races.length < 3) return null;
      const avg = (f) => races.reduce((s, r) => s + f(r), 0) / races.length;
      const arp = avg(r => r[16]);
      if (!(arp > 0)) return null;
      const mid = avg(r => r[17]);
      const closer = avg(r => r[18]);
      return {
        name,
        races: races.length,
        arp,
        rating: avg(r => r[15]),
        qPass: avg(r => r[14]),
        passDiff: avg(r => r[13]),
        fastLaps: avg(r => r[11]),
        top15Pct: avg(r => r[24]) * 100,
        closeEdge: (mid > 0 && closer > 0) ? mid - closer : null, // + means improves late
      };
    }).filter(Boolean);
  }, [csvData]);

  const sorted = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (sortCol === "name") return sortAsc ? (av||"").localeCompare(bv||"") : (bv||"").localeCompare(av||"");
      if (av == null) av = sortAsc ? 9999 : -9999;
      if (bv == null) bv = sortAsc ? 9999 : -9999;
      return sortAsc ? av - bv : bv - av;
    });
  }, [leaderboard, sortCol, sortAsc]);

  const ASC_COLS = new Set(["name", "arp"]);
  function toggleSort(col) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(ASC_COLS.has(col)); }
  }

  const LSortHeader = ({ col, label, w, align }) => {
    const active = sortCol === col;
    return (
      <th onClick={()=>toggleSort(col)} style={{ padding:"8px 6px", textAlign:align||"right", fontSize:9, color:active?T.accent:T.textDim, fontWeight:700, letterSpacing:1.5, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", cursor:"pointer", userSelect:"none", width:w||"auto", whiteSpace:"nowrap" }}>
        {label} {active ? (sortAsc ? "▲" : "▼") : ""}
      </th>
    );
  };

  const arpColor = (v) => v <= 10 ? T.green : v <= 15 ? T.gold : T.red;
  const edgeColor = (v) => v == null ? T.textDim : v >= 1.5 ? T.green : v <= -1.5 ? T.red : T.textMid;
  const num = (v, d=1) => v == null ? "—" : v.toFixed(d);
  const signed = (v) => v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(1);
  const season = csvData.length ? Math.max(...csvData.map(r => r[2])) : "";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:16 }}>
        <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:4 }}>How It Works</div>
        <div style={{ fontSize:12, color:T.textMid, fontFamily:"'IBM Plex Mono',monospace", lineHeight:1.6 }}>
          NASCAR loop data, {season} season. ARP (avg running position) measures true race pace without crash luck. Driver Rating is NASCAR's composite performance score. QPass = quality passes per race, Pass +/- = net green-flag passes per race, FL = fastest laps per race, Top15% = share of laps in the top 15, Close = mid-race vs late-race running position (positive = comes alive late).
        </div>
      </div>

      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:860 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                <th style={{ padding:"8px 10px", textAlign:"center", fontSize:9, color:T.textDim, fontWeight:700, letterSpacing:1.5, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", width:35 }}>#</th>
                <LSortHeader col="name" label="Driver" align="left" />
                <LSortHeader col="arp" label="ARP" />
                <LSortHeader col="rating" label="Rating" />
                <LSortHeader col="qPass" label="QPass" />
                <LSortHeader col="passDiff" label="Pass +/-" />
                <LSortHeader col="fastLaps" label="FL" />
                <LSortHeader col="top15Pct" label="Top15%" />
                <LSortHeader col="closeEdge" label="Close" />
                <LSortHeader col="races" label="Races" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={row.name} style={{ borderBottom:`1px solid ${T.border}33`, background:i%2===0?"transparent":`${T.surface2}55` }}>
                  <td style={{ padding:"8px 10px", textAlign:"center", fontSize:11, fontWeight:700, color:T.textDim, fontFamily:"'Barlow Condensed',sans-serif" }}>{i+1}</td>
                  <td style={{ padding:"8px 10px", fontWeight:700, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:0.5 }}>{row.name}</td>
                  <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", fontWeight:800, fontSize:14, color:arpColor(row.arp) }}>{row.arp.toFixed(1)}</td>
                  <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.text, fontWeight:700 }}>{num(row.rating)}</td>
                  <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.textMid }}>{num(row.qPass)}</td>
                  <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.textMid }}>{signed(row.passDiff)}</td>
                  <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.textMid }}>{num(row.fastLaps)}</td>
                  <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.textMid }}>{num(row.top15Pct, 0)}%</td>
                  <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, color:edgeColor(row.closeEdge) }}>{signed(row.closeEdge)}</td>
                  <td style={{ padding:"8px 6px", textAlign:"right", fontFamily:"'IBM Plex Mono',monospace", color:T.textDim }}>{row.races}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DRIVER ANALYTICS TAB — wrapper with sub-navigation
// ─────────────────────────────────────────────────────────────


export function DriverAnalyticsTab({ csvData, incrementTool }) {
  const [subTab, setSubTab] = useState("breakdown");

  useEffect(() => { incrementTool?.("driver_analytics"); }, []);

  if (csvData.length === 0) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        {/* Sub-tab nav */}
        <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${T.border}`, marginBottom:20, overflowX:"auto" }}>
          {DA_SUBTABS.map(st => {
            const active = st.id === subTab;
            return (
              <button key={st.id} onClick={()=>setSubTab(st.id)} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", fontSize:11, fontWeight:active?700:500, background:active?T.accentSoft:"transparent", color:active?T.accent:T.textDim, border:"none", borderBottom:`2px solid ${active?T.accent:"transparent"}`, marginBottom:-1, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" }}>
                <span style={{ opacity:active?1:0.5 }}>{Ic[st.icon]?.()}</span>
                {st.label}
              </button>
            );
          })}
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 20px", gap:14, textAlign:"center" }}>
          <div style={{ fontSize:28 }}>📊</div>
          <div style={{ fontSize:16, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:2, textTransform:"uppercase", color:T.text }}>Waiting for CSV Data</div>
          <div style={{ fontSize:12, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>CSV data loads automatically from GitHub on startup. If it failed, use the Admin Panel to upload or refresh.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      {/* Sub-tab nav */}
      <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${T.border}`, marginBottom:20, overflowX:"auto" }}>
        {DA_SUBTABS.map(st => {
          const active = st.id === subTab;
          return (
            <button key={st.id} onClick={()=>setSubTab(st.id)} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", fontSize:11, fontWeight:active?700:500, background:active?T.accentSoft:"transparent", color:active?T.accent:T.textDim, border:"none", borderBottom:`2px solid ${active?T.accent:"transparent"}`, marginBottom:-1, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" }}>
              <span style={{ opacity:active?1:0.5 }}>{Ic[st.icon]?.()}</span>
              {st.label}
            </button>
          );
        })}
      </div>

      {/* Sub-tab content */}
      <div key={subTab} style={{ animation:"fadeIn 0.2s ease" }}>
        {subTab === "breakdown"   && <DaTrackBreakdown csvData={csvData} />}
        {subTab === "h2h"         && <DaHeadToHead csvData={csvData} incrementTool={incrementTool} />}
        {subTab === "teamh2h"     && <DaTeamH2H csvData={csvData} incrementTool={incrementTool} />}
        {subTab === "consistency" && <DaConsistencyScore csvData={csvData} />}
        {subTab === "dnfrisk"     && <DaBadDayRisk csvData={csvData} incrementTool={incrementTool} />}
        {subTab === "loop"        && <DaLoopData csvData={csvData} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMING SOON PANEL
// ─────────────────────────────────────────────────────────────
