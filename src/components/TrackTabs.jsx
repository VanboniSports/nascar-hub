// Track Stats / Track Leaderboard / driver-track lookup tabs. Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useEffect, useMemo } from "react";
import { T } from "../theme.js";
import { CSV_TRACK_TYPES, CSV_TYPE_COLORS, LB_RANK_COLORS, LB_SORT_CONFIGS } from "../data/siteMeta.js";
import { SearchDropdown, FinishBadge, TrackBadge, StatCard } from "./ui.jsx";
import { Ic } from "./icons.jsx";
import { lbAvg, lbGetRank } from "../lib/stats.js";
import { FULL_TIMER_NAMES } from "../data/drivers.js";

export function TrackLeaderboardTab({ csvData, incrementTool }) {
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [trackSearch, setTrackSearch] = useState("");
  const [trackOpen, setTrackOpen] = useState(false);
  const [sortCol, setSortCol] = useState("avgFinish");
  const [sortDir, setSortDir] = useState(1);

  useEffect(() => { incrementTool?.("track_leaderboard"); }, []);

  // Build BY_TRACK index from csvData
  const { byTrack, allTracks } = useMemo(() => {
    const bt = {};
    for (const r of csvData) {
      const track = r[1];
      if (!bt[track]) bt[track] = [];
      bt[track].push(r);
    }
    return { byTrack: bt, allTracks: Object.keys(bt).sort() };
  }, [csvData]);

  const filteredTracks = useMemo(() =>
    allTracks.filter(t => t.toLowerCase().includes(trackSearch.toLowerCase())),
    [trackSearch, allTracks]
  );

  const driverStats = useMemo(() => {
    if (!selectedTrack) return [];
    const trackRaces = byTrack[selectedTrack] || [];
    return FULL_TIMER_NAMES.map(driver => {
      const races = trackRaces.filter(r => r[0] === driver);
      if (!races.length) return { driver, races: 0, noData: true };
      const finishes = races.map(r => r[3]).filter(v => v != null && v > 0);
      const starts = races.map(r => r[4]).filter(v => v != null && v > 0);
      const wins = finishes.filter(v => v === 1).length;
      const top5 = finishes.filter(v => v <= 5).length;
      const top10 = finishes.filter(v => v <= 10).length;
      const lapsLed = races.reduce((a, r) => a + (r[5] || 0), 0);
      const bestFinish = finishes.length ? Math.min(...finishes) : null;
      return { driver, races: races.length, wins, top5, top10, lapsLed, avgFinish: lbAvg(finishes), avgStart: lbAvg(starts), bestFinish, noData: false };
    });
  }, [selectedTrack, byTrack]);

  const withData = useMemo(() => driverStats.filter(d => !d.noData), [driverStats]);
  const noData = useMemo(() => driverStats.filter(d => d.noData), [driverStats]);

  const colValues = useMemo(() => ({
    avgFinish: withData.map(d => d.avgFinish).filter(Boolean),
    avgStart: withData.map(d => d.avgStart).filter(Boolean),
    wins: withData.map(d => d.wins), top5: withData.map(d => d.top5),
    top10: withData.map(d => d.top10), lapsLed: withData.map(d => d.lapsLed),
    bestFinish: withData.map(d => d.bestFinish).filter(Boolean),
  }), [withData]);

  const sorted = useMemo(() => {
    return [...withData].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === "string") return sortDir * av.localeCompare(bv);
      return sortDir * (av - bv);
    });
  }, [withData, sortCol, sortDir]);

  function handleSort(col) {
    if (col === sortCol) setSortDir(d => -d);
    else { setSortCol(col); setSortDir(LB_SORT_CONFIGS[col]?.lowerBetter ? 1 : -1); }
  }

  function cellColor(col, value) {
    if (value == null || !colValues[col]) return T.textMid;
    const lowerBetter = LB_SORT_CONFIGS[col]?.lowerBetter ?? true;
    const rank = lbGetRank(value, colValues[col], lowerBetter);
    return LB_RANK_COLORS[rank];
  }

  const cols = [
    { key:"driver",     label:"DRIVER",    colored:false },
    { key:"races",      label:"RACES",     colored:false,  fmt: v => v },
    { key:"avgFinish",  label:"AVG FIN",   colored:true,   fmt: v => v?.toFixed(1) ?? "—" },
    { key:"wins",       label:"WINS",      colored:true,   fmt: v => v },
    { key:"top5",       label:"TOP 5",     colored:true,   fmt: v => v },
    { key:"top10",      label:"TOP 10",    colored:true,   fmt: v => v },
    { key:"avgStart",   label:"AVG START", colored:true,   fmt: v => v?.toFixed(1) ?? "—" },
    { key:"bestFinish", label:"BEST",      colored:true,   fmt: v => v ? `P${v}` : "—" },
    { key:"lapsLed",    label:"LAPS LED",  colored:true,   fmt: v => v?.toLocaleString() ?? "—" },
  ];

  const trackType = selectedTrack ? (CSV_TRACK_TYPES[selectedTrack] || "Unknown") : null;
  const typeColor = trackType ? CSV_TYPE_COLORS[trackType] : T.textDim;

  if (csvData.length === 0) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 20px", gap:14, textAlign:"center" }}>
        <div style={{ fontSize:28 }}>📊</div>
        <div style={{ fontSize:16, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:2, textTransform:"uppercase", color:T.text }}>No CSV Data Loaded</div>
        <div style={{ fontSize:12, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", maxWidth:400 }}>
          Upload your <span style={{ color:T.accent }}>nascar_scraped_data.csv</span> file using the Admin Panel CSV section to populate track leaderboards.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Track Selector */}
      <div style={{ maxWidth:420 }}>
        <div style={{ fontSize:10, letterSpacing:3, color:T.accent, fontWeight:600, marginBottom:6, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase" }}>Select Track</div>
        <div style={{ position:"relative" }}>
          <div onClick={() => setTrackOpen(o => !o)}
            style={{ background:T.surface2, border:`1px solid ${selectedTrack?T.accent:T.border}`, borderRadius:8, padding:"10px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:14, fontWeight:selectedTrack?600:400, color:selectedTrack?T.text:T.textDim }}>
            <span>{selectedTrack || "Choose a track..."}</span>
            <span style={{ color:T.accent, fontSize:16 }}>{trackOpen ? "▲" : "▼"}</span>
          </div>
          {trackOpen && (
            <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, zIndex:100, maxHeight:300, overflow:"auto", boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
              <div style={{ padding:8 }}>
                <input autoFocus placeholder="Search tracks..." value={trackSearch} onChange={e => setTrackSearch(e.target.value)}
                  style={{ width:"100%", background:T.surface3, border:`1px solid ${T.border}`, borderRadius:6, padding:"7px 10px", color:T.text, fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"'Barlow',sans-serif" }} />
              </div>
              {filteredTracks.map(t => {
                const tt = CSV_TRACK_TYPES[t] || "Unknown";
                const tc = CSV_TYPE_COLORS[tt] || T.textDim;
                return (
                  <div key={t} onClick={() => {setSelectedTrack(t);setTrackSearch("");setTrackOpen(false);}}
                    style={{ padding:"9px 14px", cursor:"pointer", background:selectedTrack===t?T.accentSoft:"transparent", color:selectedTrack===t?T.accent:T.textMid, fontSize:13, fontWeight:selectedTrack===t?600:400, borderLeft:selectedTrack===t?`3px solid ${T.accent}`:"3px solid transparent", display:"flex", justifyContent:"space-between", alignItems:"center" }}
                    onMouseEnter={e=>{ if(selectedTrack!==t) e.currentTarget.style.background=T.surface2; }}
                    onMouseLeave={e=>{ if(selectedTrack!==t) e.currentTarget.style.background="transparent"; }}>
                    <span>{t}</span>
                    <span style={{ fontSize:10, color:tc, letterSpacing:1, fontWeight:600, fontFamily:"'Barlow Condensed',sans-serif" }}>{tt.toUpperCase()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!selectedTrack && (
        <div style={{ textAlign:"center", padding:"50px 20px", color:T.textDim }}>
          <div style={{ fontSize:42, marginBottom:14 }}>🏁</div>
          <div style={{ fontSize:16, fontWeight:700, letterSpacing:2, color:T.textMid, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase" }}>Select a Track to See the Leaderboard</div>
          <div style={{ fontSize:12, marginTop:6, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>Compare all {FULL_TIMER_NAMES.length} full-time drivers head-to-head at any of {allTracks.length} tracks</div>
        </div>
      )}

      {/* Leaderboard Table */}
      {selectedTrack && (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <span style={{ fontSize:20, fontWeight:800, color:T.text, fontFamily:"'Barlow Condensed',sans-serif" }}>{selectedTrack}</span>
            {trackType && <span style={{ background:T.surface2, border:`1px solid ${typeColor}`, borderRadius:6, padding:"3px 10px", fontSize:10, letterSpacing:2, color:typeColor, fontWeight:600, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase" }}>{trackType}</span>}
            <span style={{ marginLeft:"auto", fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>{withData.length} w/ history · {noData.length} no data</span>
          </div>

          {/* Legend */}
          <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
            {[["elite","Top 15%"],["good","Top 35%"],["mid","Middle"],["poor","Bottom 35%"],["bad","Bottom 15%"]].map(([rank,label]) => (
              <div key={rank} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:9, height:9, borderRadius:2, background:LB_RANK_COLORS[rank] }} />
                <span style={{ fontSize:10, color:T.textDim, letterSpacing:1, fontFamily:"'Barlow Condensed',sans-serif" }}>{label.toUpperCase()}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:`2px solid ${T.border}` }}>
                  <th style={{ padding:"8px 8px", textAlign:"left", fontSize:10, color:T.textDim, fontWeight:600, letterSpacing:2, width:28, fontFamily:"'Barlow Condensed',sans-serif" }}>#</th>
                  {cols.map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)}
                      style={{ padding:"8px 10px", textAlign:col.key==="driver"?"left":"center", fontSize:10, color:sortCol===col.key?T.accent:T.textDim, fontWeight:600, letterSpacing:2, cursor:"pointer", whiteSpace:"nowrap", userSelect:"none", fontFamily:"'Barlow Condensed',sans-serif" }}>
                      {col.label}
                      {sortCol===col.key ? <span style={{ color:T.accent, marginLeft:4 }}>{sortDir===1?"↑":"↓"}</span> : <span style={{ color:T.textDim, marginLeft:4, opacity:0.3 }}>⇅</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((d, i) => (
                  <tr key={d.driver} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"transparent":`${T.surface2}44` }}>
                    <td style={{ padding:"8px 8px", color:T.textDim, fontSize:11, fontWeight:600, fontFamily:"'IBM Plex Mono',monospace" }}>{i+1}</td>
                    {cols.map(col => {
                      const val = d[col.key];
                      const fmt = col.fmt ? col.fmt(val) : val;
                      const color = col.colored && val != null ? cellColor(col.key, val) : col.key==="driver"?T.text:T.textMid;
                      return (
                        <td key={col.key}
                          style={{ padding:"8px 10px", textAlign:col.key==="driver"?"left":"center", color, fontWeight:col.key==="driver"?600:400, whiteSpace:"nowrap", fontSize:col.key==="driver"?14:13, fontFamily:col.key==="driver"?"'Barlow Condensed',sans-serif":"'IBM Plex Mono',monospace" }}>
                          {col.key==="wins" && val > 0
                            ? <span style={{ background:T.gold, color:"#1a1a1a", padding:"1px 7px", borderRadius:4, fontWeight:800, fontSize:11 }}>{val}W</span>
                            : col.key==="bestFinish" && val===1
                            ? <span style={{ background:T.gold, color:"#1a1a1a", padding:"1px 7px", borderRadius:4, fontWeight:800, fontSize:11 }}>WIN</span>
                            : fmt ?? "—"
                          }
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {noData.length > 0 && (
            <div>
              <div style={{ fontSize:10, letterSpacing:3, color:T.textDim, fontWeight:600, marginBottom:8, fontFamily:"'Barlow Condensed',sans-serif" }}>NO TRACK HISTORY</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {noData.map(d => (
                  <span key={d.driver} style={{ background:T.surface2, border:`1px solid ${T.border}`, borderRadius:6, padding:"4px 10px", fontSize:11, color:T.textDim }}>{d.driver}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DRIVER-TRACK LOOKUP — three-mode stat lookup
// ─────────────────────────────────────────────────────────────


export function DriverTrackLookup({ csvData, incrementTool }) {
  const [selDriver, setSelDriver] = useState("");
  const [selTrack, setSelTrack] = useState("");
  const [result, setResult] = useState(null);

  const { allDrivers, allTracks, byDriverTrack } = useMemo(() => {
    const bd = {};
    const drivers = new Set();
    const tracks = new Set();
    for (const r of csvData) {
      const [driver, track] = r;
      if (!driver || !track) continue;
      drivers.add(driver);
      tracks.add(track);
      if (!bd[driver]) bd[driver] = {};
      if (!bd[driver][track]) bd[driver][track] = [];
      bd[driver][track].push(r);
    }
    return {
      allDrivers: [...drivers].sort(),
      allTracks: [...tracks].sort(),
      byDriverTrack: bd,
    };
  }, [csvData]);

  function computeDriverTrackStats(driver, track) {
    const races = (byDriverTrack[driver] && byDriverTrack[driver][track]) || [];
    if (!races.length) return null;
    const finishes = races.map(r => r[3]).filter(v => v > 0);
    const starts = races.map(r => r[4]).filter(v => v > 0);
    const wins = finishes.filter(f => f === 1).length;
    const top5 = finishes.filter(f => f <= 5).length;
    const top10 = finishes.filter(f => f <= 10).length;
    const lapsLed = races.reduce((a, r) => a + (r[5] || 0), 0);
    const bestFinish = finishes.length ? Math.min(...finishes) : null;
    const worstFinish = finishes.length ? Math.max(...finishes) : null;
    const avgFinish = finishes.length ? finishes.reduce((a,b)=>a+b,0)/finishes.length : null;
    const avgStart = starts.length ? starts.reduce((a,b)=>a+b,0)/starts.length : null;

    // Year breakdown
    const byYear = {};
    for (const r of races) {
      const yr = r[2];
      if (!byYear[yr]) byYear[yr] = [];
      byYear[yr].push(r);
    }
    const yearBreakdown = Object.entries(byYear).sort((a,b)=>a[0]-b[0]).map(([yr, rs]) => ({
      year: yr,
      finishes: rs.map(r => r[3]).filter(v=>v>0),
      avgStart: rs.map(r=>r[4]).filter(v=>v>0).reduce((a,b,_,arr)=>a+b/arr.length,0)||null,
      lapsLed: rs.reduce((a,r)=>a+(r[5]||0),0),
    }));

    return { races: races.length, wins, top5, top10, lapsLed, bestFinish, worstFinish, avgFinish, avgStart, yearBreakdown, rawRaces: races };
  }

  function computeDriverAllTracks(driver) {
    if (!byDriverTrack[driver]) return null;
    const trackRows = Object.entries(byDriverTrack[driver]).map(([track, races]) => {
      const finishes = races.map(r=>r[3]).filter(v=>v>0);
      const starts = races.map(r=>r[4]).filter(v=>v>0);
      return {
        track,
        races: races.length,
        wins: finishes.filter(f=>f===1).length,
        top5: finishes.filter(f=>f<=5).length,
        top10: finishes.filter(f=>f<=10).length,
        avgFinish: finishes.length ? finishes.reduce((a,b)=>a+b,0)/finishes.length : null,
        avgStart: starts.length ? starts.reduce((a,b)=>a+b,0)/starts.length : null,
        bestFinish: finishes.length ? Math.min(...finishes) : null,
        lapsLed: races.reduce((a,r)=>a+(r[5]||0),0),
      };
    }).sort((a,b) => (a.avgFinish??99) - (b.avgFinish??99));

    const allFinishes = trackRows.flatMap(t=>Array(t.races).fill(t.avgFinish).filter(Boolean));
    const totalRaces = trackRows.reduce((a,t)=>a+t.races,0);
    const totalWins = trackRows.reduce((a,t)=>a+t.wins,0);
    const totalTop5 = trackRows.reduce((a,t)=>a+t.top5,0);
    const totalTop10 = trackRows.reduce((a,t)=>a+t.top10,0);
    const allF2 = trackRows.flatMap(t=>{
      const races = byDriverTrack[driver][t.track]||[];
      return races.map(r=>r[3]).filter(v=>v>0);
    });
    const overallAvg = allF2.length ? allF2.reduce((a,b)=>a+b,0)/allF2.length : null;
    return { trackRows, totalRaces, totalWins, totalTop5, totalTop10, overallAvg };
  }

  function computeTrackAllDrivers(track) {
    const rows = csvData.filter(r => r[1] === track);
    const byDriver = {};
    for (const r of rows) {
      const d = r[0];
      if (!byDriver[d]) byDriver[d] = [];
      byDriver[d].push(r);
    }
    return Object.entries(byDriver).map(([driver, races]) => {
      const finishes = races.map(r=>r[3]).filter(v=>v>0);
      const starts = races.map(r=>r[4]).filter(v=>v>0);
      return {
        driver, races: races.length,
        wins: finishes.filter(f=>f===1).length,
        top5: finishes.filter(f=>f<=5).length,
        top10: finishes.filter(f=>f<=10).length,
        avgFinish: finishes.length ? finishes.reduce((a,b)=>a+b,0)/finishes.length : null,
        avgStart: starts.length ? starts.reduce((a,b)=>a+b,0)/starts.length : null,
        bestFinish: finishes.length ? Math.min(...finishes) : null,
        lapsLed: races.reduce((a,r)=>a+(r[5]||0),0),
      };
    }).sort((a,b) => (a.avgFinish??99) - (b.avgFinish??99));
  }

  function handleLookup() {
    if (!selDriver && !selTrack) return;
    incrementTool?.("track_lookup");
    if (selDriver && selTrack) {
      const stats = computeDriverTrackStats(selDriver, selTrack);
      setResult({ mode:"driver+track", driver:selDriver, track:selTrack, stats });
    } else if (selDriver) {
      const stats = computeDriverAllTracks(selDriver);
      setResult({ mode:"driver", driver:selDriver, stats });
    } else {
      const drivers = computeTrackAllDrivers(selTrack);
      setResult({ mode:"track", track:selTrack, drivers });
    }
  }

  if (csvData.length === 0) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 20px", gap:14, textAlign:"center" }}>
        <div style={{ fontSize:28 }}>🔍</div>
        <div style={{ fontSize:16, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:2, textTransform:"uppercase", color:T.text }}>Waiting for CSV Data</div>
        <div style={{ fontSize:12, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>CSV data loads automatically from GitHub. Use the <span style={{ color:T.accent }}>Admin Panel</span> to upload or refresh manually.</div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Controls */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
        <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:14 }}>
          <SearchDropdown label="Driver" options={allDrivers} value={selDriver} onChange={setSelDriver} placeholder="Any driver..." />
          <SearchDropdown label="Track" options={allTracks} value={selTrack} onChange={setSelTrack} placeholder="Any track..." />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={handleLookup} disabled={!selDriver && !selTrack}
            style={{ padding:"9px 24px", background:T.accent, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.5, textTransform:"uppercase", opacity:(!selDriver&&!selTrack)?0.4:1, boxShadow:`0 4px 14px ${T.accentGlow}`, transition:"opacity 0.15s" }}>
            Look Up
          </button>
          {result && <button onClick={()=>{setResult(null);setSelDriver("");setSelTrack("");}} style={{ padding:"9px 16px", background:"transparent", color:T.textMid, border:`1px solid ${T.border}`, borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"'Barlow Condensed',sans-serif" }}>Clear</button>}
          <span style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>
            {selDriver && selTrack ? "Driver + Track → detailed history" : selDriver ? "Driver only → career track breakdown" : selTrack ? "Track only → driver leaderboard" : "Select driver and/or track"}
          </span>
        </div>
      </div>

      {/* Results */}
      {result && result.mode === "driver+track" && <DriverTrackResult {...result} />}
      {result && result.mode === "driver" && <DriverResult {...result} />}
      {result && result.mode === "track" && <TrackResult {...result} />}
    </div>
  );
}


export function DriverTrackResult({ driver, track, stats }) {
  if (!stats) {
    return (
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:24, textAlign:"center" }}>
        <div style={{ fontSize:32, marginBottom:10 }}>🏁</div>
        <div style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1 }}>No data found for {driver} at {track}</div>
        <div style={{ fontSize:12, color:T.textDim, marginTop:6 }}>This driver may not have raced at this track in the dataset.</div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Header */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderLeft:`4px solid ${T.accent}`, borderRadius:12, padding:"16px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:6 }}>
          <span style={{ fontSize:22, fontWeight:900, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1 }}>{driver}</span>
          <span style={{ color:T.textDim, fontSize:18 }}>@</span>
          <span style={{ fontSize:18, fontWeight:700, color:T.accentText, fontFamily:"'Barlow Condensed',sans-serif" }}>{track}</span>
          <TrackBadge trackName={track} />
        </div>
        {/* Summary stats */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:12 }}>
          <StatCard label="Races" value={stats.races} />
          <StatCard label="Wins" value={stats.wins} highlight={stats.wins>0} />
          <StatCard label="Top 5" value={stats.top5} />
          <StatCard label="Top 10" value={stats.top10} />
          <StatCard label="Avg Finish" value={stats.avgFinish?.toFixed(1)} />
          <StatCard label="Avg Start" value={stats.avgStart?.toFixed(1)} />
          <StatCard label="Best" value={stats.bestFinish ? `P${stats.bestFinish}` : "—"} highlight={stats.bestFinish===1} />
          <StatCard label="Worst" value={stats.worstFinish ? `P${stats.worstFinish}` : "—"} />
          <StatCard label="Laps Led" value={stats.lapsLed?.toLocaleString()} />
        </div>
      </div>

      {/* Year breakdown */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, fontWeight:700, color:T.accent, letterSpacing:2.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Year-by-Year Breakdown</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {["Year","Finishes","Avg Start","Laps Led"].map(h => (
                <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10, color:T.textDim, fontWeight:600, letterSpacing:2, fontFamily:"'Barlow Condensed',sans-serif" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.yearBreakdown.map((yr, i) => (
              <tr key={yr.year} style={{ borderBottom:`1px solid ${T.border}44`, background:i%2===0?"transparent":`${T.surface2}55` }}>
                <td style={{ padding:"9px 12px", fontWeight:700, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", fontSize:14 }}>{yr.year}</td>
                <td style={{ padding:"9px 12px" }}>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {yr.finishes.map((f,j) => <FinishBadge key={j} pos={f} />)}
                  </div>
                </td>
                <td style={{ padding:"9px 12px", color:T.textMid, fontFamily:"monospace", fontSize:12 }}>{yr.avgStart ? yr.avgStart.toFixed(1) : "—"}</td>
                <td style={{ padding:"9px 12px", color:yr.lapsLed>0?T.accentText:T.textDim, fontFamily:"monospace", fontSize:12 }}>{yr.lapsLed > 0 ? yr.lapsLed.toLocaleString() : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Full race log */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, fontWeight:700, color:T.accent, letterSpacing:2.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Full Race Log</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {["Finish","Start","Laps Led","Status"].map(h => (
                <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10, color:T.textDim, fontWeight:600, letterSpacing:2, fontFamily:"'Barlow Condensed',sans-serif" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.rawRaces.sort((a,b)=>b[2]-a[2]).map((r, i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${T.border}33`, background:i%2===0?"transparent":`${T.surface2}44` }}>
                <td style={{ padding:"9px 12px" }}><FinishBadge pos={r[3]} /></td>
                <td style={{ padding:"9px 12px", color:T.textMid, fontFamily:"monospace", fontSize:12 }}>P{r[4]}</td>
                <td style={{ padding:"9px 12px", color:r[5]>0?T.accentText:T.textDim, fontFamily:"monospace", fontSize:12 }}>{r[5]>0?r[5].toLocaleString():"0"}</td>
                <td style={{ padding:"9px 12px" }}>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export function DriverResult({ driver, stats }) {
  if (!stats) return <div style={{ color:T.textDim, padding:20 }}>No data found for {driver}.</div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Career header */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderLeft:`4px solid ${T.accent}`, borderRadius:12, padding:"16px 20px" }}>
        <div style={{ fontSize:22, fontWeight:900, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, marginBottom:12 }}>{driver} — Career Summary</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <StatCard label="Total Races" value={stats.totalRaces} />
          <StatCard label="Total Wins" value={stats.totalWins} highlight={stats.totalWins>0} />
          <StatCard label="Top 5s" value={stats.totalTop5} />
          <StatCard label="Top 10s" value={stats.totalTop10} />
          <StatCard label="Overall Avg" value={stats.overallAvg?.toFixed(1)} />
        </div>
      </div>

      {/* Track breakdown table */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"auto" }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, fontWeight:700, color:T.accent, letterSpacing:2.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Performance by Track</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, minWidth:680 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {[["Track","left"],["Type","left"],["Races","center"],["Wins","center"],["Top 5","center"],["Top 10","center"],["Avg Fin","center"],["Avg Start","center"],["Best","center"],["Laps Led","center"]].map(([h,a]) => (
                <th key={h} style={{ padding:"8px 10px", textAlign:a, fontSize:10, color:T.textDim, fontWeight:600, letterSpacing:2, fontFamily:"'Barlow Condensed',sans-serif", whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.trackRows.map((t, i) => (
              <tr key={t.track} style={{ borderBottom:`1px solid ${T.border}33`, background:i%2===0?"transparent":`${T.surface2}44` }}>
                <td style={{ padding:"8px 10px", color:T.text, fontWeight:600, fontSize:13, fontFamily:"'Barlow Condensed',sans-serif", minWidth:160 }}>{t.track}</td>
                <td style={{ padding:"8px 10px" }}><TrackBadge trackName={t.track} /></td>
                <td style={{ padding:"8px 10px", textAlign:"center", color:T.textMid, fontFamily:"monospace", fontSize:12 }}>{t.races}</td>
                <td style={{ padding:"8px 10px", textAlign:"center" }}>
                  {t.wins > 0 ? <span style={{ background:T.gold, color:"#1a1a1a", padding:"1px 7px", borderRadius:4, fontWeight:800, fontSize:11 }}>{t.wins}W</span> : <span style={{ color:T.textDim, fontSize:12 }}>—</span>}
                </td>
                <td style={{ padding:"8px 10px", textAlign:"center", color:t.top5>0?T.text:T.textDim, fontFamily:"monospace", fontSize:12 }}>{t.top5}</td>
                <td style={{ padding:"8px 10px", textAlign:"center", color:t.top10>0?T.text:T.textDim, fontFamily:"monospace", fontSize:12 }}>{t.top10}</td>
                <td style={{ padding:"8px 10px", textAlign:"center", fontFamily:"monospace", fontSize:12, color:t.avgFinish<=10?T.green:t.avgFinish<=20?T.accentText:T.textMid }}>{t.avgFinish?.toFixed(1) ?? "—"}</td>
                <td style={{ padding:"8px 10px", textAlign:"center", color:T.textDim, fontFamily:"monospace", fontSize:12 }}>{t.avgStart?.toFixed(1) ?? "—"}</td>
                <td style={{ padding:"8px 10px", textAlign:"center" }}>{t.bestFinish ? <FinishBadge pos={t.bestFinish} /> : "—"}</td>
                <td style={{ padding:"8px 10px", textAlign:"center", color:t.lapsLed>0?T.accentText:T.textDim, fontFamily:"monospace", fontSize:12 }}>{t.lapsLed>0?t.lapsLed.toLocaleString():"0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export function TrackResult({ track, drivers }) {
  const [sortCol, setSortCol] = useState("avgFinish");
  const [sortDir, setSortDir] = useState(1);

  const sorted = useMemo(() => {
    return [...drivers].sort((a,b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av==null && bv==null) return 0;
      if (av==null) return 1; if (bv==null) return -1;
      if (typeof av==="string") return sortDir * av.localeCompare(bv);
      return sortDir * (av - bv);
    });
  }, [drivers, sortCol, sortDir]);

  const colValues = useMemo(() => ({
    avgFinish: drivers.map(d=>d.avgFinish).filter(Boolean),
    avgStart: drivers.map(d=>d.avgStart).filter(Boolean),
    wins: drivers.map(d=>d.wins), top5: drivers.map(d=>d.top5),
    top10: drivers.map(d=>d.top10), lapsLed: drivers.map(d=>d.lapsLed),
    bestFinish: drivers.map(d=>d.bestFinish).filter(Boolean),
  }), [drivers]);

  function cellColor(col, val) {
    if (val==null || !colValues[col]) return T.textMid;
    const lowerBetter = LB_SORT_CONFIGS[col]?.lowerBetter ?? true;
    return LB_RANK_COLORS[lbGetRank(val, colValues[col], lowerBetter)];
  }

  function handleSort(col) {
    if (col===sortCol) setSortDir(d=>-d);
    else { setSortCol(col); setSortDir(LB_SORT_CONFIGS[col]?.lowerBetter ? 1 : -1); }
  }

  const cols = [
    { key:"driver",     label:"Driver",     fmt:v=>v,                      align:"left"   },
    { key:"races",      label:"Races",      fmt:v=>v,                      align:"center" },
    { key:"avgFinish",  label:"Avg Fin",    fmt:v=>v?.toFixed(1)??"—",     align:"center", colored:true },
    { key:"wins",       label:"Wins",       fmt:v=>v,                      align:"center", colored:true },
    { key:"top5",       label:"Top 5",      fmt:v=>v,                      align:"center", colored:true },
    { key:"top10",      label:"Top 10",     fmt:v=>v,                      align:"center", colored:true },
    { key:"avgStart",   label:"Avg Start",  fmt:v=>v?.toFixed(1)??"—",     align:"center", colored:true },
    { key:"bestFinish", label:"Best",       fmt:v=>v?`P${v}`:"—",          align:"center", colored:true },
    { key:"lapsLed",    label:"Laps Led",   fmt:v=>v?.toLocaleString()??"—",align:"center",colored:true },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <span style={{ fontSize:22, fontWeight:900, color:T.text, fontFamily:"'Barlow Condensed',sans-serif" }}>{track}</span>
        <TrackBadge trackName={track} />
        <span style={{ marginLeft:"auto", fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>{drivers.length} drivers w/ history</span>
      </div>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        {[["elite","Top 15%"],["good","Top 35%"],["mid","Middle"],["poor","Bottom 35%"],["bad","Bottom 15%"]].map(([r,l])=>(
          <div key={r} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:LB_RANK_COLORS[r] }}/>
            <span style={{ fontSize:10, color:T.textDim, letterSpacing:1, fontFamily:"'Barlow Condensed',sans-serif" }}>{l.toUpperCase()}</span>
          </div>
        ))}
      </div>

      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, minWidth:700 }}>
          <thead>
            <tr style={{ borderBottom:`2px solid ${T.border}` }}>
              <th style={{ padding:"8px 8px", textAlign:"left", fontSize:10, color:T.textDim, fontWeight:600, letterSpacing:2, width:28, fontFamily:"'Barlow Condensed',sans-serif" }}>#</th>
              {cols.map(col=>(
                <th key={col.key} onClick={()=>handleSort(col.key)}
                  style={{ padding:"8px 10px", textAlign:col.align, fontSize:10, color:sortCol===col.key?T.accent:T.textDim, fontWeight:600, letterSpacing:2, cursor:"pointer", whiteSpace:"nowrap", userSelect:"none", fontFamily:"'Barlow Condensed',sans-serif" }}>
                  {col.label}
                  {sortCol===col.key ? <span style={{ color:T.accent, marginLeft:3 }}>{sortDir===1?"↑":"↓"}</span> : <span style={{ color:T.textDim, marginLeft:3, opacity:0.3 }}>⇅</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((d,i)=>(
              <tr key={d.driver} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?"transparent":`${T.surface2}44` }}>
                <td style={{ padding:"8px 8px", color:T.textDim, fontSize:11, fontWeight:600, fontFamily:"'IBM Plex Mono',monospace" }}>{i+1}</td>
                {cols.map(col=>{
                  const val = d[col.key];
                  const fmt = col.fmt(val);
                  const color = col.colored && val!=null ? cellColor(col.key, val) : col.key==="driver"?T.text:T.textMid;
                  return (
                    <td key={col.key} style={{ padding:"8px 10px", textAlign:col.align, color, fontWeight:col.key==="driver"?600:400, whiteSpace:"nowrap", fontSize:col.key==="driver"?14:13, fontFamily:col.key==="driver"?"'Barlow Condensed',sans-serif":"'IBM Plex Mono',monospace" }}>
                      {col.key==="wins" && val>0
                        ? <span style={{ background:T.gold, color:"#1a1a1a", padding:"1px 7px", borderRadius:4, fontWeight:800, fontSize:11 }}>{val}W</span>
                        : col.key==="bestFinish" && val===1
                        ? <span style={{ background:T.gold, color:"#1a1a1a", padding:"1px 7px", borderRadius:4, fontWeight:800, fontSize:11 }}>WIN</span>
                        : fmt??"—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TRACK STATS TAB — wrapper with sub-navigation
// ─────────────────────────────────────────────────────────────


export const TS_SUBTABS = [
  { id:"lookup",      label:"Driver-Track Lookup", icon:"Flag"  },
  { id:"leaderboard", label:"Track Leaderboard",   icon:"Chart" },
];

// 4-driver H2H comparison colors


export function TrackStatsTab({ csvData, incrementTool }) {
  const [subTab, setSubTab] = useState("lookup");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      {/* Sub-tab nav */}
      <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${T.border}`, marginBottom:20, overflowX:"auto" }}>
        {TS_SUBTABS.map(st => {
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
        {subTab === "lookup"      && <DriverTrackLookup csvData={csvData} incrementTool={incrementTool} />}
        {subTab === "leaderboard" && <TrackLeaderboardTab csvData={csvData} incrementTool={incrementTool} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DRIVER ANALYTICS TAB
// ─────────────────────────────────────────────────────────────

// Default export for React.lazy code-splitting.
export default TrackStatsTab;
