// Season Stats tab family. Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { T, CC } from "../theme.js";
import { MFG_COLORS, CSV_TRACK_TYPES, CSV_TYPE_COLORS } from "../data/siteMeta.js";
import { InfoLegend } from "./ui.jsx";
import { Ic } from "./icons.jsx";
import { getTier } from "../lib/tiers.js";
import { FULL_TIMER_NAMES } from "../data/drivers.js";

export const SS_SUBTABS = [
  { id:"standings",    label:"Season Standings",     icon:"Trophy"  },
  { id:"compare",      label:"Season Comparison",    icon:"Users"   },
  { id:"mfgTrends",    label:"Manufacturer Trends",  icon:"Trend"   },
  { id:"sleeper",      label:"Sleeper Detector",     icon:"Alert"   },
];

// Custom tooltip for Season Stats recharts


export const SSChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 14px", fontFamily:"'IBM Plex Mono',monospace" }}>
      <div style={{ fontSize:11, color:T.textDim, marginBottom:6 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ fontSize:12, color:p.color, display:"flex", justifyContent:"space-between", gap:16 }}>
          <span>{p.name}</span><span style={{ fontWeight:700 }}>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};


export function StatsTab({ drivers, seasonStats, raceHistory, csvData, seasonPoints, incrementTool }) {
  const [subTab, setSubTab] = useState("standings");

  useEffect(() => { incrementTool?.("season_stats"); }, []);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      {/* Sub-tab nav */}
      <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${T.border}`, marginBottom:20, overflowX:"auto" }}>
        {SS_SUBTABS.map(st => {
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
        {subTab === "standings"  && <SSStandingsTab csvData={csvData} drivers={drivers} seasonPoints={seasonPoints} />}
        {subTab === "compare"    && <SSCompareTab csvData={csvData} drivers={drivers} />}
        {subTab === "mfgTrends"  && <SSMfgTrendsTab csvData={csvData} incrementTool={incrementTool} />}
        {subTab === "sleeper"    && <SSSleeperTab csvData={csvData} drivers={drivers} incrementTool={incrementTool} />}
      </div>
    </div>
  );
}

// ── helper: build per-driver season stats from CSV for a given year ──


export function ssBuildSeasonData(csvData, year) {
  const byDriver = {};
  for (const r of csvData) {
    if (r[2] !== year) continue;
    const name = r[0];
    if (!name) continue;
    if (!byDriver[name]) byDriver[name] = { name, races:0, finishes:[], starts:[], wins:0, top5:0, top10:0, lapsLed:0, mfg:r[7] || "" };
    const d = byDriver[name];
    d.races++;
    const fin = r[3];
    if (fin > 0) {
      d.finishes.push(fin);
      if (fin === 1) d.wins++;
      if (fin <= 5) d.top5++;
      if (fin <= 10) d.top10++;
    }
    if (r[4] > 0) d.starts.push(r[4]);
    d.lapsLed += (r[5] || 0);
    if (r[7]) d.mfg = r[7];
  }
  return Object.values(byDriver).map(d => ({
    ...d,
    avgFinish: d.finishes.length ? d.finishes.reduce((a,b)=>a+b,0)/d.finishes.length : 99,
    avgStart: d.starts.length ? d.starts.reduce((a,b)=>a+b,0)/d.starts.length : 99,
    bestFinish: d.finishes.length ? Math.min(...d.finishes) : null,
    worstFinish: d.finishes.length ? Math.max(...d.finishes) : null,
  }));
}

// ── Sub-tab 1: Season Standings ──


export function SSStandingsTab({ csvData, drivers, seasonPoints }) {
  const [sortKey, setSortKey] = useState("seasonPts");
  const [sortAsc, setSortAsc] = useState(false);
  const [yearFilter, setYearFilter] = useState(2026);
  const [fullTimerOnly, setFullTimerOnly] = useState(true);

  const years = useMemo(() => {
    const yrs = new Set();
    for (const r of csvData) if (r[2]) yrs.add(r[2]);
    return [...yrs].sort((a,b) => b-a);
  }, [csvData]);

  const rows = useMemo(() => {
    const data = ssBuildSeasonData(csvData, yearFilter);
    let filtered = data;
    if (fullTimerOnly) filtered = data.filter(d => FULL_TIMER_NAMES.includes(d.name));
    return filtered.map(d => ({
      ...d,
      seasonPts: seasonPoints?.[`${d.name}__${yearFilter}`] ?? null,
    }));
  }, [csvData, yearFilter, fullTimerOnly, seasonPoints]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a,b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === "name") return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      if (av == null) av = sortAsc ? 999 : -999;
      if (bv == null) bv = sortAsc ? 999 : -999;
      return sortAsc ? av - bv : bv - av;
    });
    return arr;
  }, [rows, sortKey, sortAsc]);

  const handleSort = (k, defaultAsc) => {
    if (sortKey === k) setSortAsc(a => !a);
    else { setSortKey(k); setSortAsc(defaultAsc); }
  };

  if (csvData.length === 0) return <div style={{ padding:40, textAlign:"center", color:T.textDim, fontSize:13, background:T.surface, border:`1px solid ${T.border}`, borderRadius:12 }}>CSV data loads automatically from GitHub. Check Admin Panel if data is missing.</div>;

  const cols = [
    { k:"name",        l:"#",          asc:true  },
    { k:null,           l:"Driver",     asc:true  },
    { k:"seasonPts",   l:"Pts",        asc:false },
    { k:"avgFinish",   l:"Avg Fin",    asc:true  },
    { k:"wins",        l:"Wins",       asc:false },
    { k:"top5",        l:"Top 5",      asc:false },
    { k:"top10",       l:"Top 10",     asc:false },
    { k:"lapsLed",     l:"Laps Led",   asc:false },
    { k:"bestFinish",  l:"Best",       asc:true  },
    { k:"races",       l:"Races",      asc:false },
  ];

  // Find driver info for team/mfg display
  const driverLookup = {};
  drivers.forEach(d => { driverLookup[d.name] = d; });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Year</span>
          <select value={yearFilter} onChange={e=>setYearFilter(Number(e.target.value))} style={{ background:T.surface2, color:T.text, border:`1px solid ${T.border}`, borderRadius:6, padding:"4px 10px", fontSize:12, fontFamily:"'IBM Plex Mono',monospace" }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={()=>setFullTimerOnly(f=>!f)} style={{ background:fullTimerOnly?T.accentSoft:"transparent", color:fullTimerOnly?T.accent:T.textDim, border:`1px solid ${fullTimerOnly?T.accent:T.border}`, borderRadius:6, padding:"4px 12px", fontSize:10, cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase", fontWeight:700 }}>
          {fullTimerOnly ? "36 Full-Timers" : "All Drivers"}
        </button>
        <span style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", marginLeft:"auto" }}>{sorted.length} driver{sorted.length!==1?"s":""}</span>
      </div>

      {/* Table */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {cols.map(c => (
                <th key={c.l} onClick={c.k ? ()=>handleSort(c.k,c.asc) : undefined}
                  style={{ padding:"10px 8px", fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", color:sortKey===c.k?T.accent:T.textDim, textAlign:c.l==="Driver"||c.l==="#"?"left":"center", cursor:c.k?"pointer":"default", whiteSpace:"nowrap" }}>
                  {c.l}{sortKey===c.k?(sortAsc?" ▲":" ▼"):""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, idx) => {
              const info = driverLookup[r.name];
              const tier = info ? getTier(info.overall) : { border:T.textDim };
              const mfgColor = MFG_COLORS[r.mfg] || T.textDim;
              return (
                <tr key={r.name} style={{ borderBottom:`1px solid ${T.border}`, background:idx%2===0?"transparent":`${T.surface2}44` }}>
                  <td style={{ padding:"8px 8px", textAlign:"left", fontWeight:700, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, width:30 }}>{idx+1}</td>
                  <td style={{ padding:"8px 8px" }}>
                    <div style={{ fontWeight:700, color:tier.border, fontFamily:"'Barlow Condensed',sans-serif", fontSize:14 }}>{r.name}</div>
                    <div style={{ fontSize:10, color:T.textDim, display:"flex", gap:8 }}>
                      {info && <span>{info.team}</span>}
                      <span style={{ color:mfgColor, fontWeight:600 }}>{r.mfg}</span>
                    </div>
                  </td>
                  <td style={{ textAlign:"center", fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, color:r.seasonPts!=null?T.accent:T.textDim }}>{r.seasonPts != null ? r.seasonPts : "—"}</td>
                  <td style={{ textAlign:"center", fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, color:r.avgFinish<=10?T.green:r.avgFinish<=20?T.gold:T.red }}>{r.avgFinish.toFixed(1)}</td>
                  <td style={{ textAlign:"center", fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", color:r.wins>0?T.gold:T.textDim }}>{r.wins||"—"}</td>
                  <td style={{ textAlign:"center", color:T.textMid, fontFamily:"'Barlow Condensed',sans-serif" }}>{r.top5||"—"}</td>
                  <td style={{ textAlign:"center", color:T.textMid, fontFamily:"'Barlow Condensed',sans-serif" }}>{r.top10||"—"}</td>
                  <td style={{ textAlign:"center", color:r.lapsLed>0?"#a855f7":T.textDim, fontFamily:"monospace" }}>{r.lapsLed||"—"}</td>
                  <td style={{ textAlign:"center", fontWeight:700, color:r.bestFinish===1?T.gold:T.textMid, fontFamily:"'Barlow Condensed',sans-serif" }}>{r.bestFinish||"—"}</td>
                  <td style={{ textAlign:"center", color:T.textMid, fontFamily:"monospace" }}>{r.races}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-tab 2: Season Comparison ──


export function SSCompareTab({ csvData, drivers }) {
  const [selected, setSelected] = useState([]);
  const [yearFilter, setYearFilter] = useState(2026);

  const years = useMemo(() => {
    const yrs = new Set();
    for (const r of csvData) if (r[2]) yrs.add(r[2]);
    return [...yrs].sort((a,b) => b-a);
  }, [csvData]);

  const seasonData = useMemo(() => ssBuildSeasonData(csvData, yearFilter), [csvData, yearFilter]);
  const dataMap = useMemo(() => { const m = {}; seasonData.forEach(d => { m[d.name] = d; }); return m; }, [seasonData]);

  // Only show full-timers present in CSV
  const driverList = useMemo(() => FULL_TIMER_NAMES.filter(n => dataMap[n]), [dataMap]);

  const toggleDriver = (name) => {
    setSelected(prev => prev.includes(name) ? prev.filter(n=>n!==name) : prev.length < 6 ? [...prev, name] : prev);
  };

  if (csvData.length === 0) return <div style={{ padding:40, textAlign:"center", color:T.textDim, fontSize:13, background:T.surface, border:`1px solid ${T.border}`, borderRadius:12 }}>CSV data loads automatically from GitHub. Check Admin Panel if data is missing.</div>;

  const metrics = [
    { key:"wins",        label:"Wins",        lower:false },
    { key:"top5",        label:"Top 5s",      lower:false },
    { key:"top10",       label:"Top 10s",     lower:false },
    { key:"avgFinish",   label:"Avg Finish",  lower:true  },
    { key:"bestFinish",  label:"Best Finish", lower:true  },
    { key:"worstFinish", label:"Worst Finish",lower:true  },
    { key:"lapsLed",     label:"Laps Led",    lower:false },
  ];

  const selData = selected.map(n => dataMap[n]).filter(Boolean);

  // Build bar chart data — separate laps led (different scale)
  const chartMetrics = ["wins","top5","top10","avgFinish"];
  const chartData = chartMetrics.map(key => {
    const entry = { metric: metrics.find(m=>m.key===key)?.label || key };
    selData.forEach(d => { entry[d.name] = d[key] != null ? Math.round(d[key]*10)/10 : 0; });
    return entry;
  });
  const lapsLedData = [{ metric: "Laps Led" }];
  selData.forEach(d => { lapsLedData[0][d.name] = d.lapsLed || 0; });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Year + driver picker */}
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Year</span>
          <select value={yearFilter} onChange={e=>{setYearFilter(Number(e.target.value));setSelected([]);}} style={{ background:T.surface2, color:T.text, border:`1px solid ${T.border}`, borderRadius:6, padding:"4px 10px", fontSize:12, fontFamily:"'IBM Plex Mono',monospace" }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <span style={{ fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>Select up to 6 drivers</span>
      </div>

      {/* Driver chips */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        {driverList.map(name => {
          const on = selected.includes(name);
          const ci = selected.indexOf(name);
          const chipColor = on ? CC[ci % CC.length] : T.textDim;
          return (
            <button key={name} onClick={()=>toggleDriver(name)} style={{ padding:"4px 10px", fontSize:11, fontWeight:on?700:500, background:on?`${chipColor}18`:"transparent", color:chipColor, border:`1px solid ${on?chipColor:T.border}`, borderRadius:20, cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5 }}>
              {name}
            </button>
          );
        })}
      </div>

      {selData.length === 0 && (
        <div style={{ padding:30, textAlign:"center", color:T.textDim, fontSize:13, background:T.surface, border:`1px solid ${T.border}`, borderRadius:12 }}>
          Select drivers above to compare their {yearFilter} season stats side by side.
        </div>
      )}

      {selData.length > 0 && (
        <>
          {/* Stat cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
            {selData.map((d, i) => {
              const color = CC[i % CC.length];
              return (
                <div key={d.name} style={{ background:T.surface, border:`1px solid ${color}33`, borderRadius:12, padding:16 }}>
                  <div style={{ fontSize:15, fontWeight:800, color, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, marginBottom:10, borderBottom:`1px solid ${T.border}`, paddingBottom:8 }}>{d.name}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 16px" }}>
                    {metrics.map(m => (
                      <div key={m.key} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                        <span style={{ color:T.textDim }}>{m.label}</span>
                        <span style={{ fontWeight:700, color:T.text, fontFamily:"'IBM Plex Mono',monospace" }}>
                          {d[m.key] != null ? (m.key==="avgFinish" ? d[m.key].toFixed(1) : d[m.key]) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bar chart comparison — core stats */}
          {selData.length >= 2 && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:12 }}>Season Stats Comparison</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top:5, right:10, left:0, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="metric" tick={{ fill:T.textDim, fontSize:10 }} />
                    <YAxis tick={{ fill:T.textDim, fontSize:10 }} />
                    <Tooltip content={<SSChartTooltip />} />
                    {selData.map((d, i) => (
                      <Bar key={d.name} dataKey={d.name} fill={CC[i % CC.length]} radius={[3,3,0,0]} />
                    ))}
                    <Legend wrapperStyle={{ fontSize:10, color:T.textDim }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Laps Led — separate scale */}
              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#a855f7", letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:12 }}>Laps Led</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={lapsLedData} layout="vertical" margin={{ top:5, right:10, left:0, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
                    <XAxis type="number" tick={{ fill:T.textDim, fontSize:10 }} />
                    <YAxis type="category" dataKey="metric" tick={{ fill:T.textDim, fontSize:10 }} width={65} />
                    <Tooltip content={<SSChartTooltip />} />
                    {selData.map((d, i) => (
                      <Bar key={d.name} dataKey={d.name} fill={CC[i % CC.length]} radius={[0,3,3,0]} />
                    ))}
                    <Legend wrapperStyle={{ fontSize:10, color:T.textDim }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-tab 3: Manufacturer Trends ──


export function SSMfgTrendsTab({ csvData, incrementTool }) {
  const [yearFilter, setYearFilter] = useState(2026);
  const [viewMode, setViewMode] = useState("season"); // "season" | "trackType"

  useEffect(() => { incrementTool?.("mfg_trends"); }, []);

  const years = useMemo(() => {
    const yrs = new Set();
    for (const r of csvData) if (r[2]) yrs.add(r[2]);
    return [...yrs].sort((a,b) => b-a);
  }, [csvData]);

  // Aggregate manufacturer data for the selected year
  const mfgData = useMemo(() => {
    const byMfg = {};
    const byMfgTrackType = {};
    const byMfgRace = {};

    for (const r of csvData) {
      if (r[2] !== yearFilter) continue;
      const mfg = r[7];
      const fin = r[3];
      const track = r[1];
      const date = r[9] || "";
      if (!mfg || !fin || fin <= 0) continue;
      if (!["Chevrolet","Ford","Toyota"].includes(mfg)) continue;

      // Overall
      if (!byMfg[mfg]) byMfg[mfg] = { finishes:[], wins:0, top5:0, top10:0 };
      byMfg[mfg].finishes.push(fin);
      if (fin === 1) byMfg[mfg].wins++;
      if (fin <= 5) byMfg[mfg].top5++;
      if (fin <= 10) byMfg[mfg].top10++;

      // By track type
      const tt = CSV_TRACK_TYPES[track] || "Unknown";
      const ttKey = `${mfg}__${tt}`;
      if (!byMfgTrackType[ttKey]) byMfgTrackType[ttKey] = { mfg, trackType:tt, finishes:[] };
      byMfgTrackType[ttKey].finishes.push(fin);

      // By race date for trend line
      const rKey = `${mfg}__${date}`;
      if (!byMfgRace[rKey]) byMfgRace[rKey] = { mfg, date, track, finishes:[] };
      byMfgRace[rKey].finishes.push(fin);
    }

    // Compute averages
    const overall = Object.entries(byMfg).map(([mfg, d]) => ({
      mfg, avgFinish: d.finishes.reduce((a,b)=>a+b,0)/d.finishes.length, wins:d.wins, top5:d.top5, top10:d.top10, entries:d.finishes.length,
    })).sort((a,b) => a.avgFinish - b.avgFinish);

    const byType = Object.values(byMfgTrackType).map(d => ({
      mfg:d.mfg, trackType:d.trackType, avgFinish: d.finishes.reduce((a,b)=>a+b,0)/d.finishes.length, entries:d.finishes.length,
    }));

    // Race trend — sorted by date
    const raceDates = [...new Set(Object.values(byMfgRace).map(d=>d.date))].sort();
    const trendData = raceDates.map(date => {
      const entry = { date };
      ["Chevrolet","Ford","Toyota"].forEach(mfg => {
        const key = `${mfg}__${date}`;
        const rd = byMfgRace[key];
        entry[mfg] = rd ? Math.round((rd.finishes.reduce((a,b)=>a+b,0)/rd.finishes.length)*10)/10 : null;
        entry[`${mfg}_track`] = rd?.track || "";
      });
      return entry;
    });

    return { overall, byType, trendData };
  }, [csvData, yearFilter]);

  if (csvData.length === 0) return <div style={{ padding:40, textAlign:"center", color:T.textDim, fontSize:13, background:T.surface, border:`1px solid ${T.border}`, borderRadius:12 }}>CSV data loads automatically from GitHub. Check Admin Panel if data is missing.</div>;

  // Build track type breakdown chart data
  const trackTypes = ["Intermediate","Short Track","Road Course","Superspeedway","Dirt"];
  const ttChartData = trackTypes.map(tt => {
    const entry = { type: tt };
    ["Chevrolet","Ford","Toyota"].forEach(mfg => {
      const match = mfgData.byType.find(d => d.mfg === mfg && d.trackType === tt);
      entry[mfg] = match ? Math.round(match.avgFinish * 10) / 10 : null;
    });
    return entry;
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Year</span>
          <select value={yearFilter} onChange={e=>setYearFilter(Number(e.target.value))} style={{ background:T.surface2, color:T.text, border:`1px solid ${T.border}`, borderRadius:6, padding:"4px 10px", fontSize:12, fontFamily:"'IBM Plex Mono',monospace" }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {["season","trackType"].map(m => (
          <button key={m} onClick={()=>setViewMode(m)} style={{ padding:"4px 12px", fontSize:10, fontWeight:viewMode===m?700:500, background:viewMode===m?T.accentSoft:"transparent", color:viewMode===m?T.accent:T.textDim, border:`1px solid ${viewMode===m?T.accent:T.border}`, borderRadius:6, cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" }}>
            {m === "season" ? "Season Trend" : "By Track Type"}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
        {mfgData.overall.map(m => {
          const color = MFG_COLORS[m.mfg] || T.textDim;
          return (
            <div key={m.mfg} style={{ background:T.surface, border:`1px solid ${color}33`, borderRadius:12, padding:14 }}>
              <div style={{ fontSize:14, fontWeight:800, color, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, marginBottom:8 }}>{m.mfg}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 12px", fontSize:12 }}>
                <span style={{ color:T.textDim }}>Avg Finish</span><span style={{ fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", color:m.avgFinish<=16?T.green:m.avgFinish<=19?T.gold:T.red }}>{m.avgFinish.toFixed(1)}</span>
                <span style={{ color:T.textDim }}>Wins</span><span style={{ fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", color:m.wins>0?T.gold:T.textDim }}>{m.wins}</span>
                <span style={{ color:T.textDim }}>Top 5s</span><span style={{ fontWeight:700, fontFamily:"'IBM Plex Mono',monospace" }}>{m.top5}</span>
                <span style={{ color:T.textDim }}>Top 10s</span><span style={{ fontWeight:700, fontFamily:"'IBM Plex Mono',monospace" }}>{m.top10}</span>
                <span style={{ color:T.textDim }}>Entries</span><span style={{ fontFamily:"'IBM Plex Mono',monospace", color:T.textMid }}>{m.entries}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart area */}
      {viewMode === "season" && mfgData.trendData.length > 0 && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:12 }}>Average Finish by Race — {yearFilter}</div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mfgData.trendData} margin={{ top:5, right:10, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="date" tick={{ fill:T.textDim, fontSize:9 }} angle={-45} textAnchor="end" height={60} />
              <YAxis reversed domain={["auto","auto"]} tick={{ fill:T.textDim, fontSize:10 }} label={{ value:"Avg Finish", angle:-90, position:"insideLeft", fill:T.textDim, fontSize:10 }} />
              <Tooltip content={<SSChartTooltip />} />
              {["Chevrolet","Ford","Toyota"].map(mfg => (
                <Line key={mfg} type="monotone" dataKey={mfg} stroke={MFG_COLORS[mfg]} strokeWidth={2} dot={{ r:3 }} connectNulls />
              ))}
              <Legend wrapperStyle={{ fontSize:10, color:T.textDim }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {viewMode === "trackType" && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:12 }}>Average Finish by Track Type — {yearFilter}</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ttChartData} margin={{ top:5, right:10, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="type" tick={{ fill:T.textDim, fontSize:10 }} />
              <YAxis reversed domain={["auto","auto"]} tick={{ fill:T.textDim, fontSize:10 }} label={{ value:"Avg Finish", angle:-90, position:"insideLeft", fill:T.textDim, fontSize:10 }} />
              <Tooltip content={<SSChartTooltip />} />
              {["Chevrolet","Ford","Toyota"].map(mfg => (
                <Bar key={mfg} dataKey={mfg} fill={MFG_COLORS[mfg]} radius={[3,3,0,0]} />
              ))}
              <Legend wrapperStyle={{ fontSize:10, color:T.textDim }} />
            </BarChart>
          </ResponsiveContainer>
          {/* Detail table */}
          <div style={{ marginTop:14, overflow:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                  <th style={{ padding:"6px 8px", textAlign:"left", fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", color:T.textDim }}>Track Type</th>
                  {["Chevrolet","Ford","Toyota"].map(mfg => (
                    <th key={mfg} style={{ padding:"6px 8px", textAlign:"center", fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", color:MFG_COLORS[mfg] }}>{mfg}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ttChartData.map((row, idx) => (
                  <tr key={row.type} style={{ borderBottom:`1px solid ${T.border}`, background:idx%2===0?"transparent":`${T.surface2}44` }}>
                    <td style={{ padding:"6px 8px", color:CSV_TYPE_COLORS[row.type]||T.textMid, fontWeight:600 }}>{row.type}</td>
                    {["Chevrolet","Ford","Toyota"].map(mfg => {
                      const v = row[mfg];
                      return <td key={mfg} style={{ textAlign:"center", fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", color:v!=null?(v<=16?T.green:v<=19?T.gold:T.red):T.textDim }}>{v!=null?v.toFixed(1):"—"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-tab 4: Sleeper Detector ──


export function SSSleeperTab({ csvData, drivers, incrementTool }) {
  const [yearFilter, setYearFilter] = useState(2026);
  const [sortKey, setSortKey] = useState("diff");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => { incrementTool?.("sleeper_detector"); }, []);

  const years = useMemo(() => {
    const yrs = new Set();
    for (const r of csvData) if (r[2]) yrs.add(r[2]);
    return [...yrs].sort((a,b) => b-a);
  }, [csvData]);

  const sleepers = useMemo(() => {
    // Career stats: all years EXCEPT the selected year
    const careerByDriver = {};
    const currentByDriver = {};

    for (const r of csvData) {
      const name = r[0];
      const fin = r[3];
      if (!name || !fin || fin <= 0) continue;
      if (!FULL_TIMER_NAMES.includes(name)) continue;

      if (r[2] === yearFilter) {
        if (!currentByDriver[name]) currentByDriver[name] = [];
        currentByDriver[name].push(fin);
      } else {
        if (!careerByDriver[name]) careerByDriver[name] = [];
        careerByDriver[name].push(fin);
      }
    }

    const results = [];
    for (const name of FULL_TIMER_NAMES) {
      const career = careerByDriver[name];
      const current = currentByDriver[name];
      if (!career || career.length < 3 || !current || current.length < 2) continue;

      const careerAvg = career.reduce((a,b)=>a+b,0)/career.length;
      const currentAvg = current.reduce((a,b)=>a+b,0)/current.length;
      const diff = currentAvg - careerAvg; // positive = underperforming

      // Last 3 races trend
      const last3 = current.slice(-3);
      const last3Avg = last3.length ? last3.reduce((a,b)=>a+b,0)/last3.length : currentAvg;
      const trending = last3Avg < currentAvg ? "improving" : last3Avg > currentAvg ? "declining" : "flat";

      const info = drivers.find(d => d.name === name);
      results.push({
        name, careerAvg, currentAvg, diff, last3Avg, trending,
        races: current.length, careerRaces: career.length,
        team: info?.team || "", mfg: info?.mfg || "",
        overall: info?.overall || 0,
      });
    }

    return results;
  }, [csvData, yearFilter, drivers]);

  const sorted = useMemo(() => {
    const arr = [...sleepers];
    arr.sort((a,b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
    return arr;
  }, [sleepers, sortKey, sortAsc]);

  const handleSort = (k, defaultAsc) => {
    if (sortKey === k) setSortAsc(a => !a);
    else { setSortKey(k); setSortAsc(defaultAsc); }
  };

  if (csvData.length === 0) return <div style={{ padding:40, textAlign:"center", color:T.textDim, fontSize:13, background:T.surface, border:`1px solid ${T.border}`, borderRadius:12 }}>CSV data loads automatically from GitHub. Check Admin Panel if data is missing.</div>;

  // Sleeper candidates: underperforming career avg by >= 3 positions
  const sleeperCandidates = sorted.filter(d => d.diff >= 3);
  // Hot drivers: outperforming career avg
  const hotDrivers = sorted.filter(d => d.diff <= -2);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Year</span>
          <select value={yearFilter} onChange={e=>setYearFilter(Number(e.target.value))} style={{ background:T.surface2, color:T.text, border:`1px solid ${T.border}`, borderRadius:6, padding:"4px 10px", fontSize:12, fontFamily:"'IBM Plex Mono',monospace" }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <span style={{ fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", marginLeft:"auto" }}>
          {sleeperCandidates.length} sleeper{sleeperCandidates.length!==1?"s":""} · {hotDrivers.length} hot
        </span>
      </div>

      <InfoLegend title="How the Sleeper Detector Works">
        <div>
          <div style={{ fontWeight:700, color:T.text, marginBottom:6, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:1 }}>WHAT IS A SLEEPER?</div>
          <div style={{ marginBottom:10 }}>
            A <span style={{ fontWeight:700, color:T.gold }}>"sleeper"</span> is a driver whose current-year average finish is <span style={{ fontWeight:700, color:T.red }}>≥ 3 positions worse</span> than their career average — they're underperforming their historical baseline and statistically likely to bounce back. Conversely, <span style={{ fontWeight:700, color:T.green }}>"hot"</span> drivers are outperforming their career baseline by ≥ 2 positions.
          </div>
          <div style={{ fontWeight:700, color:T.text, marginBottom:6, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:1 }}>METRICS USED</div>
          <div style={{ display:"flex", flexDirection:"column", gap:3, marginBottom:8 }}>
            {[
              { label:"Career Avg", desc:"Average finish across all seasons except the current year" },
              { label:"Current Avg", desc:"Average finish in the selected year only" },
              { label:"Diff", desc:"Current − Career (positive = underperforming, negative = overperforming)" },
              { label:"Last 3", desc:"Average finish of the 3 most recent races this season" },
            ].map(m => (
              <div key={m.label}>
                <span style={{ fontWeight:700, color:T.accentText }}>{m.label}:</span> {m.desc}
              </div>
            ))}
          </div>
          <div style={{ fontWeight:700, color:T.text, marginBottom:4, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, letterSpacing:1 }}>TREND ARROWS</div>
          <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
            <span><span style={{ color:T.green, fontWeight:700 }}>▲ Trending up</span> — Last 3 races are better than their season average (bounce-back underway)</span>
            <span><span style={{ color:T.red, fontWeight:700 }}>▼ Still declining</span> — Last 3 races are worse than their season average</span>
            <span><span style={{ color:T.textDim, fontWeight:700 }}>— Holding steady</span> — Last 3 races roughly match their season average</span>
          </div>
        </div>
      </InfoLegend>

      {/* Sleeper alert cards */}
      {sleeperCandidates.length > 0 && (
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:T.gold, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
            <Ic.Alert /> Bounce-Back Candidates
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:10 }}>
            {sleeperCandidates.slice(0,8).map(d => {
              const tier = getTier(d.overall);
              const diffColor = d.diff >= 6 ? T.red : d.diff >= 4 ? "#f59e0b" : T.gold;
              return (
                <div key={d.name} style={{ background:T.surface, border:`1px solid ${diffColor}33`, borderRadius:12, padding:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:800, color:tier.border, fontFamily:"'Barlow Condensed',sans-serif" }}>{d.name}</div>
                      <div style={{ fontSize:10, color:T.textDim }}>{d.team} · <span style={{ color:MFG_COLORS[d.mfg]||T.textDim }}>{d.mfg}</span></div>
                    </div>
                    <div style={{ background:`${diffColor}18`, border:`1px solid ${diffColor}44`, borderRadius:6, padding:"3px 8px", fontSize:12, fontWeight:800, color:diffColor, fontFamily:"'IBM Plex Mono',monospace" }}>
                      +{d.diff.toFixed(1)}
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, fontSize:11 }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ color:T.textDim, fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Career</div>
                      <div style={{ fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", color:T.green }}>{d.careerAvg.toFixed(1)}</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ color:T.textDim, fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>{yearFilter}</div>
                      <div style={{ fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", color:T.red }}>{d.currentAvg.toFixed(1)}</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ color:T.textDim, fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Last 3</div>
                      <div style={{ fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", color:d.trending==="improving"?T.green:d.trending==="declining"?T.red:T.textMid }}>{d.last3Avg.toFixed(1)}</div>
                    </div>
                  </div>
                  <div style={{ marginTop:6, fontSize:10, color:d.trending==="improving"?T.green:d.trending==="declining"?T.red:T.textDim, fontFamily:"'IBM Plex Mono',monospace", textAlign:"center" }}>
                    {d.trending === "improving" ? "▲ Trending up — watch closely" : d.trending === "declining" ? "▼ Still declining" : "— Holding steady"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hot drivers */}
      {hotDrivers.length > 0 && (
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:T.green, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
            <Ic.Trend /> Overperforming Their Baseline
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:10 }}>
            {hotDrivers.slice(0,6).map(d => {
              const tier = getTier(d.overall);
              return (
                <div key={d.name} style={{ background:T.surface, border:`1px solid ${T.green}33`, borderRadius:12, padding:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:800, color:tier.border, fontFamily:"'Barlow Condensed',sans-serif" }}>{d.name}</div>
                      <div style={{ fontSize:10, color:T.textDim }}>{d.team} · <span style={{ color:MFG_COLORS[d.mfg]||T.textDim }}>{d.mfg}</span></div>
                    </div>
                    <div style={{ background:`${T.green}18`, border:`1px solid ${T.green}44`, borderRadius:6, padding:"3px 8px", fontSize:12, fontWeight:800, color:T.green, fontFamily:"'IBM Plex Mono',monospace" }}>
                      {d.diff.toFixed(1)}
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, fontSize:11 }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ color:T.textDim, fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Career</div>
                      <div style={{ fontWeight:700, fontFamily:"'IBM Plex Mono',monospace" }}>{d.careerAvg.toFixed(1)}</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ color:T.textDim, fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>{yearFilter}</div>
                      <div style={{ fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", color:T.green }}>{d.currentAvg.toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full table */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"auto" }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", padding:"12px 12px 0" }}>All Drivers — Career vs {yearFilter}</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, marginTop:8 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {[
                { k:"name",       l:"Driver",       asc:true  },
                { k:"careerAvg",  l:"Career Avg",   asc:true  },
                { k:"currentAvg", l:`${yearFilter} Avg`, asc:true },
                { k:"diff",       l:"Diff",         asc:false },
                { k:"last3Avg",   l:"Last 3",       asc:true  },
                { k:"races",      l:"Races",        asc:false },
              ].map(c => (
                <th key={c.l} onClick={()=>handleSort(c.k,c.asc)} style={{ padding:"8px 8px", fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", color:sortKey===c.k?T.accent:T.textDim, textAlign:c.k==="name"?"left":"center", cursor:"pointer", whiteSpace:"nowrap" }}>
                  {c.l}{sortKey===c.k?(sortAsc?" ▲":" ▼"):""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, idx) => {
              const diffColor = r.diff >= 3 ? T.red : r.diff >= 1 ? T.gold : r.diff <= -2 ? T.green : T.textMid;
              return (
                <tr key={r.name} style={{ borderBottom:`1px solid ${T.border}`, background:idx%2===0?"transparent":`${T.surface2}44` }}>
                  <td style={{ padding:"7px 8px", fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", color:T.text }}>{r.name}</td>
                  <td style={{ textAlign:"center", fontFamily:"'IBM Plex Mono',monospace", color:T.textMid }}>{r.careerAvg.toFixed(1)}</td>
                  <td style={{ textAlign:"center", fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, color:r.currentAvg<=r.careerAvg?T.green:T.red }}>{r.currentAvg.toFixed(1)}</td>
                  <td style={{ textAlign:"center", fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, color:diffColor }}>{r.diff > 0 ? "+" : ""}{r.diff.toFixed(1)}</td>
                  <td style={{ textAlign:"center", fontFamily:"'IBM Plex Mono',monospace", color:r.trending==="improving"?T.green:r.trending==="declining"?T.red:T.textMid }}>{r.last3Avg.toFixed(1)}</td>
                  <td style={{ textAlign:"center", fontFamily:"'IBM Plex Mono',monospace", color:T.textDim }}>{r.races}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PREDICTOR BATTLE TRACKER — sub-components
// ─────────────────────────────────────────────────────────────

// Default export for React.lazy code-splitting.
export default StatsTab;
