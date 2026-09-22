// Admin panel (season points, usage, DFS, blog, global). Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { T, TC, TL } from "../theme.js";
import { Ic } from "./icons.jsx";
import { TOOL_USAGE_KEYS, BLOG_CATEGORIES, BLOG_CAT_COLORS, BATTLE_TRACK_COLORS, PREDICTORS, PREDICTOR_COLORS, PREDICTOR_DESCRIPTIONS, DFS_PLATFORMS } from "../data/siteMeta.js";
import { SCHEDULE } from "../data/schedule.js";
import { BattleDriverInput } from "./ui.jsx";
import { getTier } from "../lib/tiers.js";
import { sb } from "../lib/supabase.js";
import { INITIAL_DRIVERS } from "../data/drivers.js";
import { parseCSVData } from "../lib/csv.js";
import { parsePaste, findDriver } from "../lib/pasteParser.js";

export const ADMIN_PASSWORD = "CassidyH7/15";


export function SeasonPointsAdmin({ drivers, seasonPoints, onSave }) {
  const [year, setYear] = useState(2026);
  const [localPts, setLocalPts] = useState({});
  const [pasteText, setPasteText] = useState("");
  const [pasteMsg, setPasteMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  // Initialize local state from seasonPoints whenever year changes
  useEffect(() => {
    const pts = {};
    INITIAL_DRIVERS.forEach(d => {
      const key = `${d.name}__${year}`;
      pts[d.name] = seasonPoints?.[key] != null ? String(seasonPoints[key]) : "";
    });
    setLocalPts(pts);
    setSaveMsg("");
  }, [year, seasonPoints]);

  const handlePtsChange = (name, val) => {
    setLocalPts(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = () => {
    const updated = { ...seasonPoints };
    Object.entries(localPts).forEach(([name, val]) => {
      const key = `${name}__${year}`;
      const num = parseInt(val);
      if (!isNaN(num)) {
        updated[key] = num;
      } else {
        delete updated[key];
      }
    });
    onSave(updated);
    setSaveMsg(`✓ ${year} points saved for ${Object.values(localPts).filter(v => v !== "").length} drivers.`);
  };

  // Parse pasted standings text
  // Handles formats like:
  //   1. Kyle Larson 350   OR   1 Kyle Larson 350   OR   Kyle Larson\t350
  const handleParse = () => {
    if (!pasteText.trim()) { setPasteMsg("Paste standings text first."); return; }
    const lines = pasteText.split("\n").map(l => l.trim()).filter(Boolean);
    let matched = 0;
    const newPts = { ...localPts };

    for (const line of lines) {
      // Try to extract driver name and points from each line
      // Strip leading rank number and period/dot
      const cleaned = line.replace(/^\d+[\.\)\s]+/, "").trim();
      // Try tab-separated: "Kyle Larson\t350"
      let name = null, pts = null;
      const tabParts = cleaned.split(/\t+/);
      if (tabParts.length >= 2) {
        const lastPart = tabParts[tabParts.length - 1].trim();
        const num = parseInt(lastPart.replace(/[,\s]/g, ""));
        if (!isNaN(num) && num > 0) {
          name = tabParts.slice(0, -1).join(" ").trim();
          pts = num;
        }
      }
      // Try space-separated with number at end: "Kyle Larson 350"
      if (!name) {
        const match = cleaned.match(/^(.+?)\s+(\d[\d,]*)\s*$/);
        if (match) {
          name = match[1].trim();
          pts = parseInt(match[2].replace(/,/g, ""));
        }
      }
      if (!name || !pts) continue;

      // Fuzzy match to INITIAL_DRIVERS
      const driver = findDriver(drivers, name);
      if (driver) {
        newPts[driver.name] = String(pts);
        matched++;
      }
    }

    setLocalPts(newPts);
    setPasteMsg(matched > 0 ? `✓ Matched ${matched} driver${matched !== 1 ? "s" : ""} from paste.` : "No drivers matched. Check the format.");
  };

  const inputStyle = { width:"100%", background:"#142030", border:`1px solid ${T.border}`, color:T.text, borderRadius:6, padding:"6px 10px", fontSize:13, outline:"none", fontFamily:"'IBM Plex Mono',monospace", textAlign:"center" };
  const btnStyle2 = (col) => ({ padding:"8px 18px", background:col, border:"none", color:"#fff", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" });

  const filled = Object.values(localPts).filter(v => v !== "" && !isNaN(parseInt(v))).length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Year selector + status */}
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Year</span>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ background:"#142030", color:T.text, border:`1px solid ${T.border}`, borderRadius:6, padding:"4px 10px", fontSize:12, fontFamily:"'IBM Plex Mono',monospace" }}>
            {[2026,2025,2024,2023,2022].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <span style={{ fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>{filled} of {INITIAL_DRIVERS.length} drivers have points</span>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button onClick={handleSave} style={{ ...btnStyle2(T.accent), boxShadow:`0 4px 14px ${T.accentGlow}` }}>Save Points</button>
        </div>
      </div>

      {saveMsg && <div style={{ fontSize:12, color:T.green, fontFamily:"'IBM Plex Mono',monospace" }}>{saveMsg}</div>}

      {/* Paste parser */}
      <div style={{ background:"#0f1923", border:`1px solid ${T.border}`, borderRadius:12, padding:16 }}>
        <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:8 }}>Paste Standings</div>
        <div style={{ fontSize:11, color:T.textDim, marginBottom:8, fontFamily:"'IBM Plex Mono',monospace" }}>
          Paste from NASCAR.com or any source. Accepts: "1. Kyle Larson 350" or "Kyle Larson → 350" or tab-separated.
        </div>
        <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={5} placeholder={"1. Kyle Larson 350\n2. William Byron 320\n3. Denny Hamlin 310\n..."} style={{ width:"100%", background:"#0c1520", border:`1px solid ${T.border}`, color:T.text, borderRadius:8, padding:"10px 12px", fontSize:12, fontFamily:"monospace", resize:"vertical", outline:"none", lineHeight:1.7 }} />
        <div style={{ display:"flex", gap:8, marginTop:8, alignItems:"center" }}>
          <button onClick={handleParse} style={btnStyle2("#334155")}>Parse & Fill</button>
          <button onClick={() => { setPasteText(""); setPasteMsg(""); }} style={{ ...btnStyle2("transparent"), color:T.textDim, border:`1px solid ${T.border}` }}>Clear</button>
          {pasteMsg && <span style={{ fontSize:11, color:pasteMsg.startsWith("✓") ? T.green : T.gold, fontFamily:"'IBM Plex Mono',monospace" }}>{pasteMsg}</span>}
        </div>
      </div>

      {/* Driver points grid */}
      <div style={{ background:"#0f1923", border:`1px solid ${T.border}`, borderRadius:12, overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              <th style={{ padding:"10px 12px", textAlign:"left", fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", color:T.textDim }}>#</th>
              <th style={{ padding:"10px 12px", textAlign:"left", fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", color:T.textDim }}>Driver</th>
              <th style={{ padding:"10px 12px", textAlign:"center", fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", color:T.accent, width:100 }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {INITIAL_DRIVERS.map((d, idx) => {
              const tier = getTier(d.overall);
              return (
                <tr key={d.num} style={{ borderBottom:`1px solid ${T.border}`, background:idx % 2 === 0 ? "transparent" : `${T.surface2}44` }}>
                  <td style={{ padding:"6px 12px", fontWeight:700, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, width:30 }}>{d.num}</td>
                  <td style={{ padding:"6px 12px" }}>
                    <span style={{ fontWeight:700, color:tier.border, fontFamily:"'Barlow Condensed',sans-serif", fontSize:14 }}>{d.name}</span>
                    <span style={{ fontSize:10, color:T.textDim, marginLeft:8 }}>{d.team}</span>
                  </td>
                  <td style={{ padding:"4px 8px", width:100 }}>
                    <input
                      type="number"
                      value={localPts[d.name] || ""}
                      onChange={e => handlePtsChange(d.name, e.target.value)}
                      placeholder="—"
                      style={inputStyle}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom save button */}
      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <button onClick={handleSave} style={{ ...btnStyle2(T.accent), boxShadow:`0 4px 14px ${T.accentGlow}` }}>Save Points</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GLOBAL ADMIN PANEL — lives at the bottom of the app
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// USAGE ADMIN — date range filtering with timestamped events
// ─────────────────────────────────────────────────────────────


export const USAGE_RANGES = [
  { id:"today",   label:"Today" },
  { id:"yesterday", label:"Yesterday" },
  { id:"7d",      label:"Last 7 Days" },
  { id:"30d",     label:"Last 30 Days" },
  { id:"custom",  label:"Custom Range" },
  { id:"all",     label:"All Time" },
];


export function UsageAdminSection({ toolUsage }) {
  const [range, setRange] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [blogExpanded, setBlogExpanded] = useState(false);

  // Compute date boundaries for the selected range
  const getDateBounds = useCallback(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (range) {
      case "today":
        return { from: todayStart.toISOString(), to: new Date(todayStart.getTime() + 86400000).toISOString() };
      case "yesterday": {
        const yd = new Date(todayStart.getTime() - 86400000);
        return { from: yd.toISOString(), to: todayStart.toISOString() };
      }
      case "7d":
        return { from: new Date(todayStart.getTime() - 7 * 86400000).toISOString(), to: now.toISOString() };
      case "30d":
        return { from: new Date(todayStart.getTime() - 30 * 86400000).toISOString(), to: now.toISOString() };
      case "custom": {
        if (!customFrom || !customTo) return null;
        const f = new Date(customFrom);
        const t = new Date(customTo);
        t.setDate(t.getDate() + 1);
        return { from: f.toISOString(), to: t.toISOString() };
      }
      default: return null;
    }
  }, [range, customFrom, customTo]);

  // Fetch events from usage_events table for the selected date range
  useEffect(() => {
    if (range === "all") { setEventData(null); return; }
    const bounds = getDateBounds();
    if (!bounds) { setEventData(null); return; }
    setLoading(true);
    (async () => {
      try {
        const { data: rows, error } = await sb.from("usage_events")
          .select("tool_name, created_at, metadata")
          .gte("created_at", bounds.from)
          .lt("created_at", bounds.to)
          .order("created_at", { ascending: true });
        if (error) throw error;

        // Aggregate counts per tool
        const counts = {};
        const dayMap = {};
        const blogPostCounts = {};
        (rows || []).forEach(r => {
          counts[r.tool_name] = (counts[r.tool_name] || 0) + 1;
          const day = r.created_at.slice(0, 10);
          if (!dayMap[day]) dayMap[day] = {};
          dayMap[day][r.tool_name] = (dayMap[day][r.tool_name] || 0) + 1;
          // Track individual blog post views
          if (r.tool_name === "blog_post" && r.metadata?.post_title) {
            const title = r.metadata.post_title;
            blogPostCounts[title] = (blogPostCounts[title] || 0) + 1;
          }
        });

        // Build timeline for chart
        const timeline = Object.entries(dayMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, tools]) => ({
            date: new Date(date).toLocaleDateString("en-US", { month:"short", day:"numeric" }),
            total: Object.values(tools).reduce((a, b) => a + b, 0),
            ...tools,
          }));

        setEventData({ counts, timeline, total: (rows || []).length, blogPostCounts });
      } catch (e) {
        console.error("Usage events fetch error:", e);
        setEventData({ counts: {}, timeline: [], total: 0 });
      }
      setLoading(false);
    })();
  }, [range, customFrom, customTo, getDateBounds]);

  // Fetch all-time blog post breakdown (only when on All Time range and blog expanded)
  const [allTimeBlogPosts, setAllTimeBlogPosts] = useState(null);
  useEffect(() => {
    if (!blogExpanded || range !== "all" || allTimeBlogPosts) return;
    (async () => {
      try {
        const { data: rows, error } = await sb.from("usage_events")
          .select("metadata")
          .eq("tool_name", "blog_post");
        if (error) throw error;
        const bpc = {};
        (rows || []).forEach(r => {
          if (r.metadata?.post_title) bpc[r.metadata.post_title] = (bpc[r.metadata.post_title] || 0) + 1;
        });
        setAllTimeBlogPosts(bpc);
      } catch (e) {
        console.error("Blog post counts fetch error:", e);
        setAllTimeBlogPosts({});
      }
    })();
  }, [blogExpanded, range, allTimeBlogPosts]);

  // Determine which data to show
  const isAllTime = range === "all";
  const displayCounts = isAllTime ? (toolUsage || {}) : (eventData?.counts || {});
  const displayTotal = isAllTime
    ? Object.values(toolUsage || {}).reduce((a, b) => a + b, 0)
    : (eventData?.total || 0);
  const maxUses = Math.max(1, ...Object.values(displayCounts).map(v => v || 0));
  const timeline = eventData?.timeline || [];
  const showTimeline = !isAllTime && timeline.length > 1;
  const blogPostDisplay = isAllTime ? (allTimeBlogPosts || {}) : (eventData?.blogPostCounts || {});
  const blogPostEntries = Object.entries(blogPostDisplay).sort(([,a],[,b]) => b - a);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* ── Date Range Selector ── */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        {USAGE_RANGES.map(r => (
          <button key={r.id} onClick={() => setRange(r.id)} style={{
            padding:"6px 14px", borderRadius:8, border:`1px solid ${range === r.id ? T.accent : T.border}`,
            background: range === r.id ? T.accentSoft : T.surface, color: range === r.id ? T.accent : T.textMid,
            fontSize:12, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.8,
            cursor:"pointer", transition:"all 0.15s ease",
          }}>{r.label}</button>
        ))}
      </div>

      {/* ── Custom Date Inputs ── */}
      {range === "custom" && (
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <label style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>From</label>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ padding:"6px 10px", borderRadius:6, border:`1px solid ${T.border}`, background:T.surface2, color:T.text, fontSize:12, fontFamily:"'IBM Plex Mono',monospace" }} />
          <label style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>To</label>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ padding:"6px 10px", borderRadius:6, border:`1px solid ${T.border}`, background:T.surface2, color:T.text, fontSize:12, fontFamily:"'IBM Plex Mono',monospace" }} />
        </div>
      )}

      {/* ── Total Header ── */}
      <div style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 20px", background:T.accentSoft, border:`1px solid ${T.accent}30`, borderRadius:12 }}>
        {loading ? (
          <div style={{ fontSize:14, color:T.textMid, fontFamily:"'IBM Plex Mono',monospace" }}>Loading events…</div>
        ) : (
          <>
            <div style={{ fontSize:36, fontWeight:900, color:T.accent, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:-1 }}>{displayTotal.toLocaleString()}</div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.5, textTransform:"uppercase" }}>
                {isAllTime ? "Total Tool Uses (All Time)" : `Tool Uses — ${USAGE_RANGES.find(r=>r.id===range)?.label}`}
              </div>
              <div style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>
                {isAllTime ? "Cumulative counter · Across all visitors" : "From timestamped events log"}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Timeline Chart ── */}
      {showTimeline && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 12px 8px 0" }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.textDim, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:2, textTransform:"uppercase", marginBottom:8, paddingLeft:16 }}>
            Usage Over Time
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="date" tick={{ fill:T.textDim, fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }} axisLine={{ stroke:T.border }} tickLine={false} />
              <YAxis tick={{ fill:T.textDim, fontSize:9, fontFamily:"'IBM Plex Mono',monospace" }} axisLine={{ stroke:T.border }} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, fontFamily:"'Barlow Condensed',sans-serif", fontSize:12 }}
                labelStyle={{ color:T.text, fontWeight:700 }}
                itemStyle={{ color:T.textMid }}
              />
              <Bar dataKey="total" fill={T.accent} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Per-Tool Breakdown ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.textDim, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>
          Breakdown by Tool {!isAllTime && !loading && `(${USAGE_RANGES.find(r=>r.id===range)?.label})`}
        </div>
        {TOOL_USAGE_KEYS.filter(t => !t.hidden).map(({ key, label, type }) => {
          const count = key === "blog"
            ? (displayCounts["blog"] || 0) + (displayCounts["blog_post"] || 0)
            : (displayCounts[key] || 0);
          const pct = maxUses > 0 ? (count / maxUses) * 100 : 0;
          const isBlog = key === "blog";
          return (
            <div key={key}>
              <div
                onClick={isBlog ? () => setBlogExpanded(p => !p) : undefined}
                style={{
                  display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
                  background:T.surface, border:`1px solid ${T.border}`, borderRadius:10,
                  cursor: isBlog ? "pointer" : "default",
                }}
              >
                <div style={{ flex:"0 0 160px", display:"flex", flexDirection:"column" }}>
                  <span style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5, display:"flex", alignItems:"center", gap:6 }}>
                    {label}
                    {isBlog && <span style={{ fontSize:10, color:T.textDim, transition:"transform 0.2s", display:"inline-block", transform: blogExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>}
                  </span>
                  <span style={{ fontSize:9, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1, textTransform:"uppercase" }}>{type === "action" ? "on submit" : "on tab open"}</span>
                </div>
                <div style={{ flex:1, height:8, background:T.surface3, borderRadius:4, overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", background: type === "action" ? T.accent : T.green, borderRadius:4, transition:"width 0.3s ease" }} />
                </div>
                <div style={{ flex:"0 0 60px", textAlign:"right", fontSize:15, fontWeight:900, color: count > 0 ? T.text : T.textDim, fontFamily:"'Barlow Condensed',sans-serif" }}>{count.toLocaleString()}</div>
              </div>

              {/* Blog post sub-breakdown */}
              {isBlog && blogExpanded && (
                <div style={{ marginLeft:24, marginTop:4, display:"flex", flexDirection:"column", gap:4 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 14px", fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1, textTransform:"uppercase" }}>
                    <span>Tab Opens: {(displayCounts["blog"] || 0).toLocaleString()}</span>
                    <span>Post Views: {(displayCounts["blog_post"] || 0).toLocaleString()}</span>
                  </div>
                  {blogPostEntries.length > 0 ? blogPostEntries.map(([title, cnt]) => (
                    <div key={title} style={{
                      display:"flex", alignItems:"center", gap:10, padding:"7px 14px",
                      background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8,
                    }}>
                      <div style={{ flex:1, fontSize:12, color:T.textMid, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {title}
                      </div>
                      <div style={{ flex:"0 0 40px", textAlign:"right", fontSize:13, fontWeight:800, color:T.text, fontFamily:"'Barlow Condensed',sans-serif" }}>{cnt}</div>
                    </div>
                  )) : (
                    <div style={{ padding:"8px 14px", fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", fontStyle:"italic" }}>
                      {isAllTime && !allTimeBlogPosts ? "Loading post breakdown…" : "No individual post views recorded yet."}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:16, fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ width:8, height:8, borderRadius:2, background:T.accent }} /> Action-based (on submit/run)</span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ width:8, height:8, borderRadius:2, background:T.green }} /> View-based (on tab open)</span>
      </div>

      {/* Footnote for non-All-Time ranges */}
      {!isAllTime && (
        <div style={{ fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", fontStyle:"italic", borderTop:`1px solid ${T.border}`, paddingTop:10 }}>
          Note: Date-filtered data is from timestamped event logging (started when this feature was added). "All Time" uses the original cumulative counter which includes all historical usage.
        </div>
      )}
    </div>
  );
}


export function GlobalAdminPanel({ drivers, onRaceApplied, raceHistory, raceArchive, onUndo, onReset, onReplay, canUndo, battleRaces, onBattleSave, csvData, csvLoading, csvError, onCsvUpload, onCsvRefresh, seasonPoints, onSeasonPointsSave, toolUsage, dfsSalaries, onDfsSalariesSave, dfsDisabled, onDfsDisabledSave, qualPractice, onQualPracticeSave, blogPosts, onBlogSave }) {
  const [expanded, setExpanded] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState(false);
  const [adminSection, setAdminSection] = useState("power"); // "power" | "battle" | "csv" | "points" | "usage"

  // Power Rankings admin state
  const [raceName, setRaceName] = useState("");
  const [trackType, setTrackType] = useState("intermediate");
  const [totalLaps, setTotalLaps] = useState(267);
  const [raceText, setRaceText] = useState("");
  const [stage1Text, setStage1Text] = useState("");
  const [stage2Text, setStage2Text] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [finishes, setFinishes] = useState({});
  const [starts, setStarts] = useState({});
  const [lapsLed, setLapsLed] = useState({});
  const [stagePts, setStagePts] = useState({});
  const [msg, setMsg] = useState("");

  // Battle Tracker admin state
  const blankBattleForm = () => ({
    raceName: "", track: "", date: "", trackType: "Intermediate",
    predictions: Object.fromEntries(PREDICTORS.map((p) => [p, Array(10).fill("")])),
    actualResults: Array(10).fill(""),
  });
  const [battleForm, setBattleForm] = useState(blankBattleForm);
  const [activePredictors, setActivePredictors] = useState(PREDICTORS);
  const [expandedPredictors, setExpandedPredictors] = useState({});
  const [battleSaving, setBattleSaving] = useState(false);
  const [battleView, setBattleView] = useState("list"); // "list" | "add" | "edit"
  const [editingRaceId, setEditingRaceId] = useState(null);
  const [editActuals, setEditActuals] = useState(Array(10).fill(""));
  const [backupModal, setBackupModal] = useState({ open: false, mode: null, text: "" });
  const textareaRef = useRef(null);
  const [backupCopied, setBackupCopied] = useState(false);
  const [backupPaste, setBackupPaste] = useState("");

  const handleLogin = () => {
    if (pw === ADMIN_PASSWORD) { setLoggedIn(true); setPwErr(false); }
    else { setPwErr(true); }
  };

  // Power Rankings — paste import
  const handleParse = () => {
    if (!raceText.trim()) { setImportMsg("Paste race results first."); return; }
    const { results, unmatched } = parsePaste(drivers, raceText, stage1Text, stage2Text, totalLaps);
    const newFin={}, newSt={}, newLed={}, newSp={};
    results.forEach(r => {
      newFin[r.num] = r.fin; newSt[r.num] = r.st;
      newLed[r.num] = r.led; newSp[r.num] = r.sp;
    });
    setFinishes(newFin); setStarts(newSt); setLapsLed(newLed); setStagePts(newSp);
    const u = unmatched.filter(n => !["Shane Van Gisbergen","Austin Hill","Anthony Alfredo","Ty Dillon extra","Cody Ware extra"].includes(n));
    setImportMsg(`✓ Imported ${results.length} drivers${u.length>0?` · Unmatched: ${u.join(", ")}`:""}${unmatched.length>0&&u.length===0?" · Some non-fulltime drivers skipped":""}`);
    setRaceText(""); setStage1Text(""); setStage2Text("");
  };

  const handleApply = () => {
    if (!raceName) { setMsg("Enter a race name."); return; }
    const results = drivers.map(d => ({
      num:d.num, fin:parseInt(finishes[d.num])||0,
      st:parseInt(starts[d.num])||0, led:parseInt(lapsLed[d.num])||0, sp:parseInt(stagePts[d.num])||0,
    })).filter(r => r.fin > 0);
    if (results.length === 0) { setMsg("No finish positions entered."); return; }
    onRaceApplied({ raceName, trackType, totalLaps:parseInt(totalLaps)||200, results });
    setFinishes({}); setStarts({}); setLapsLed({}); setStagePts({});
    setRaceName(""); setMsg(`✓ ${raceName} applied — ${results.length} drivers updated.`);
  };

  // Battle — save new race
  const handleBattleSave = async () => {
    if (!battleForm.raceName || !battleForm.track) return;
    setBattleSaving(true);
    const race = {
      id: Date.now().toString(),
      raceName: battleForm.raceName, track: battleForm.track, date: battleForm.date, trackType: battleForm.trackType,
      predictions: Object.fromEntries(activePredictors.map((p) => [p, battleForm.predictions[p].filter(Boolean)])),
      actualResults: battleForm.actualResults.filter(Boolean),
      createdAt: new Date().toISOString(),
    };
    await onBattleSave([...battleRaces, race]);
    setBattleSaving(false);
    setBattleForm(blankBattleForm()); setActivePredictors(PREDICTORS); setExpandedPredictors({});
    setBattleView("list");
  };

  // Battle — update actuals
  const handleUpdateActuals = async (raceId) => {
    const updated = battleRaces.map((r) => r.id === raceId ? { ...r, actualResults: editActuals.filter(Boolean) } : r);
    await onBattleSave(updated);
    setEditingRaceId(null);
    setBattleView("list");
  };

  // Battle — delete race
  const handleDeleteRace = async (raceId) => {
    if (!window.confirm("Delete this race from battle tracker?")) return;
    await onBattleSave(battleRaces.filter((r) => r.id !== raceId));
    setEditingRaceId(null);
    setBattleView("list");
  };

  // Battle — export/restore
  const handleExport = () => {
    const text = JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, races: battleRaces }, null, 2);
    setBackupModal({ open: true, mode: "export", text });
  };

  const handleRestore = async (pastedText) => {
    try {
      const parsed = JSON.parse(pastedText);
      const imported = Array.isArray(parsed) ? parsed : parsed.races;
      if (!Array.isArray(imported)) { window.alert("Invalid backup — couldn't find race data."); return; }
      const merged = [...battleRaces];
      let added = 0;
      imported.forEach((r) => { if (!merged.find((x) => x.id === r.id)) { merged.push(r); added++; } });
      await onBattleSave(merged);
      setBackupModal({ open: false, mode: null, text: "" });
      window.alert(`Restore complete! Added ${added} new race(s).`);
    } catch { window.alert("Invalid backup text — make sure you pasted the full backup."); }
  };

  const taStyle = { width:"100%", background:T.surface3, border:`1px solid ${T.border}`, color:T.text, borderRadius:8, padding:"10px 12px", fontSize:12, fontFamily:"monospace", resize:"vertical", outline:"none", lineHeight:1.7 };
  const inputStyle = { width:"100%", background:T.surface2, border:`1px solid ${T.border}`, color:T.text, borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", fontFamily:"'Barlow',sans-serif" };
  const btnStyle = (col) => ({ padding:"8px 18px", background:col, border:"none", color:"#fff", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" });

  return (
    <div style={{ borderTop:`1px solid ${T.border}`, marginTop:40 }}>
      {/* Backup Modal */}
      {backupModal.open && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:24, width:"100%", maxWidth:600, maxHeight:"80vh", display:"flex", flexDirection:"column", gap:14 }}>
            {backupModal.mode === "export" ? (
              <>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:4 }}>Backup Battle Data</div>
                  <div style={{ fontSize:13, color:T.textDim }}>Copy all the text below and save it somewhere safe. Paste it back to restore.</div>
                </div>
                <textarea ref={textareaRef} readOnly value={backupModal.text} onClick={e=>e.target.select()}
                  style={{ flex:1, minHeight:220, background:T.surface3, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px", color:T.textMid, fontSize:11, fontFamily:"monospace", resize:"none", outline:"none" }} />
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={()=>{
                    if(textareaRef.current){textareaRef.current.select(); try{navigator.clipboard.writeText(backupModal.text).catch(()=>document.execCommand("copy"))}catch{document.execCommand("copy")}setBackupCopied(true);setTimeout(()=>setBackupCopied(false),2000);}
                  }} style={{ ...btnStyle(T.accent), flex:1, boxShadow:`0 4px 16px ${T.accentGlow}` }}>{backupCopied?"✓ Copied!":"Copy to Clipboard"}</button>
                  <button onClick={()=>setBackupModal({open:false,mode:null,text:""})} style={btnStyle("#334155")}>Close</button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:4 }}>Restore from Backup</div>
                  <div style={{ fontSize:13, color:T.textDim }}>Paste your backup text below. Any races not already in the app will be added.</div>
                </div>
                <textarea value={backupPaste} onChange={e=>setBackupPaste(e.target.value)} placeholder="Paste your backup JSON here…"
                  style={{ flex:1, minHeight:220, background:T.surface3, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px", color:T.text, fontSize:11, fontFamily:"monospace", resize:"none", outline:"none" }} />
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={()=>handleRestore(backupPaste)} disabled={!backupPaste.trim()} style={{ ...btnStyle(T.accent), flex:1 }}>Restore Data</button>
                  <button onClick={()=>{setBackupModal({open:false,mode:null,text:""});setBackupPaste("");}} style={btnStyle("#334155")}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toggle bar */}
      <button onClick={()=>setExpanded(!expanded)} style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        padding:"12px 0", background:T.surface, border:"none", borderBottom:`1px solid ${T.border}`,
        cursor:"pointer", color:T.textDim, fontSize:11, fontFamily:"'Barlow Condensed',sans-serif",
        letterSpacing:2, textTransform:"uppercase",
      }}>
        <Ic.Lock /> Admin Panel <Ic.Chevron open={expanded} />
      </button>

      {expanded && (
        <div style={{ padding:"24px 28px", maxWidth:1000, width:"100%" }}>
          {!loggedIn ? (
            <div style={{ maxWidth:360, margin:"0 auto", display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ textAlign:"center", marginBottom:8 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🔒</div>
                <p style={{ color:T.textMid, fontSize:13 }}>Admin access required</p>
              </div>
              <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setPwErr(false);}} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                placeholder="Password" style={{ ...inputStyle, borderColor:pwErr?T.red:T.border }} />
              {pwErr && <p style={{ color:T.red, fontSize:12, margin:0 }}>Incorrect password.</p>}
              <button onClick={handleLogin} style={{ ...btnStyle(T.accent), boxShadow:`0 4px 16px ${T.accentGlow}` }}>Login</button>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              {/* Admin sub-nav */}
              <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${T.border}`, paddingBottom:0 }}>
                {[{id:"power",label:"Power Rankings",icon:"Trophy"},{id:"battle",label:"Battle Tracker",icon:"Chart"},{id:"csv",label:"CSV Data",icon:"Import"},{id:"points",label:"Season Points",icon:"Flag"},{id:"dfs",label:"DFS Salaries",icon:"Flag"},{id:"blog",label:"Blog",icon:"Edit"},{id:"usage",label:"Tool Usage",icon:"Trend"}].map(tab => {
                  const active = adminSection === tab.id;
                  return (
                    <button key={tab.id} onClick={()=>setAdminSection(tab.id)} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", fontSize:11, fontWeight:active?700:500, background:active?T.accentSoft:"transparent", color:active?T.accent:T.textDim, border:"none", borderBottom:`2px solid ${active?T.accent:"transparent"}`, marginBottom:-1, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" }}>
                      <span style={{ opacity:active?1:0.5 }}>{Ic[tab.icon]?.()}</span>
                      {tab.label}
                    </button>
                  );
                })}
                <div style={{ flex:1 }} />
                <button onClick={()=>setLoggedIn(false)} style={{ ...btnStyle("#334155"), padding:"5px 14px", fontSize:10 }}>Logout</button>
              </div>

              {/* ─── POWER RANKINGS ADMIN ─── */}
              {adminSection === "power" && (
                <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 120px", gap:12 }}>
                    <div>
                      <label style={{ fontSize:10, color:T.textDim, display:"block", marginBottom:6, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Race Name</label>
                      <input value={raceName} onChange={e=>setRaceName(e.target.value)} placeholder="e.g. Daytona 500" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:T.textDim, display:"block", marginBottom:6, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Track Type</label>
                      <select value={trackType} onChange={e=>setTrackType(e.target.value)} style={{ ...inputStyle, cursor:"pointer" }}>
                        <option value="superspeedway">Superspeedway</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="short">Short Track</option>
                        <option value="road">Road Course</option>
                        <option value="dirt">Dirt</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:T.textDim, display:"block", marginBottom:6, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Total Laps</label>
                      <input type="number" value={totalLaps} onChange={e=>setTotalLaps(e.target.value)} style={inputStyle} />
                    </div>
                  </div>

                  {/* Paste import */}
                  <div style={{ background:`${T.accent}08`, border:`1px solid ${T.border2}`, borderRadius:12, padding:"18px 20px", display:"flex", flexDirection:"column", gap:14 }}>
                    <div>
                      <h4 style={{ margin:"0 0 4px", fontSize:15, fontWeight:800, color:T.accent, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:2, textTransform:"uppercase" }}>📋 Quick Import from NASCAR.com</h4>
                      <p style={{ margin:0, fontSize:11, color:T.textDim }}>Copy results from NASCAR.com and paste below. Stage results are optional.</p>
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:T.textDim, display:"block", marginBottom:6, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Race Results (paste from Race Results tab)</label>
                      <textarea value={raceText} onChange={e=>setRaceText(e.target.value)} rows={7} placeholder={"Paste race results here…"} style={taStyle} />
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      <div>
                        <label style={{ fontSize:10, color:T.textDim, display:"block", marginBottom:6, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Stage 1 Results (optional)</label>
                        <textarea value={stage1Text} onChange={e=>setStage1Text(e.target.value)} rows={5} placeholder="Paste Stage 1 results…" style={taStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize:10, color:T.textDim, display:"block", marginBottom:6, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Stage 2 Results (optional)</label>
                        <textarea value={stage2Text} onChange={e=>setStage2Text(e.target.value)} rows={5} placeholder="Paste Stage 2 results…" style={taStyle} />
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                      <button onClick={handleParse} style={btnStyle(T.accent)}>Import &amp; Fill Table ↓</button>
                      {importMsg && <span style={{ fontSize:12, color:importMsg.startsWith("✓")?T.green:T.gold }}>{importMsg}</span>}
                    </div>
                  </div>

                  {/* Results table */}
                  <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                      <thead>
                        <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                          {["Driver","Finish","Start","Laps Led","Stage Pts"].map(h => (
                            <th key={h} style={{ padding:"10px 10px", fontSize:10, fontWeight:700, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", textAlign:h==="Driver"?"left":"center" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {drivers.map((d, idx) => {
                          const numInp = (val, setter, max, highlight) => (
                            <input type="number" value={val||""} onChange={e=>setter(prev=>({...prev,[d.num]:e.target.value}))}
                              min={0} max={max}
                              style={{ width:56, padding:"5px", background:highlight&&val?`${T.gold}12`:T.surface2, border:`1px solid ${highlight&&val?T.gold:T.border}`, borderRadius:5, color:T.text, textAlign:"center", fontFamily:"monospace", fontSize:13, outline:"none" }} />
                          );
                          return (
                            <tr key={d.num} style={{ borderBottom:`1px solid ${T.border}`, background:idx%2===0?"transparent":`${T.surface2}44` }}>
                              <td style={{ padding:"8px 10px" }}><span style={{ fontWeight:700, color:T.textMid, fontFamily:"'Barlow Condensed',sans-serif" }}>#{d.num}</span> <span style={{ color:T.text }}>{d.name}</span></td>
                              <td style={{ textAlign:"center", padding:"6px 8px" }}>{numInp(finishes[d.num], setFinishes, 40, true)}</td>
                              <td style={{ textAlign:"center", padding:"6px 8px" }}>{numInp(starts[d.num], setStarts, 40, false)}</td>
                              <td style={{ textAlign:"center", padding:"6px 8px" }}>{numInp(lapsLed[d.num], setLapsLed, 999, false)}</td>
                              <td style={{ textAlign:"center", padding:"6px 8px" }}>{numInp(stagePts[d.num], setStagePts, 20, false)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    <button onClick={handleApply} style={{ ...btnStyle(T.accent), boxShadow:`0 4px 14px ${T.accentGlow}` }}>Apply Race Results</button>
                    <button onClick={onUndo} disabled={!canUndo} style={{ ...btnStyle(canUndo?"#f59e0b":"#1a2d40") }}><Ic.Undo /> Undo Last Race</button>
                    <button onClick={onReplay} style={btnStyle("#22c55e")}>🔄 Replay All</button>
                    <button onClick={onReset} style={btnStyle("#475569")}>Reset All</button>
                  </div>
                  {msg && <p style={{ fontSize:12, color:msg.startsWith("✓")?T.green:T.red, margin:0 }}>{msg}</p>}

                  {/* Race history */}
                  {raceHistory.length > 0 && (
                    <div>
                      <h3 style={{ margin:"0 0 12px", fontSize:16, fontWeight:800, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" }}>Race History</h3>
                      <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:360, overflowY:"auto" }}>
                        {raceHistory.map((r,i) => (
                          <div key={i} style={{ background:T.surface, border:`1px solid ${TC[r.trackType]}40`, borderLeft:`3px solid ${TC[r.trackType]}`, borderRadius:8, padding:"12px 16px" }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                                <span style={{ fontWeight:700, color:T.text, fontSize:14 }}>{r.race}</span>
                                <span style={{ fontSize:10, fontWeight:700, color:TC[r.trackType], textTransform:"uppercase", letterSpacing:1 }}>{TL[r.trackType]}</span>
                              </div>
                              <span style={{ fontSize:11, color:T.textDim }}>{r.date}</span>
                            </div>
                            <div style={{ fontSize:11, color:T.textDim, lineHeight:1.7 }}>
                              {r.topFinishers.map((f,j) => <div key={j}>{f}</div>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── BATTLE TRACKER ADMIN ─── */}
              {adminSection === "battle" && (
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  {battleView === "list" && (
                    <>
                      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                        <button onClick={()=>{setBattleForm(blankBattleForm());setActivePredictors(PREDICTORS);setExpandedPredictors({});setBattleView("add");}} style={{ ...btnStyle(T.accent), boxShadow:`0 4px 14px ${T.accentGlow}` }}>+ New Race Predictions</button>
                        <button onClick={handleExport} style={btnStyle("#475569")}>📋 Backup</button>
                        <button onClick={()=>setBackupModal({open:true,mode:"restore",text:""})} style={btnStyle("#475569")}>🔄 Restore</button>
                      </div>
                      {battleRaces.length === 0 ? (
                        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:28, textAlign:"center", color:T.textDim, fontSize:13 }}>
                          No battle races logged yet. Click "+ New Race Predictions" to add one.
                        </div>
                      ) : (
                        <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:500, overflowY:"auto" }}>
                          {[...battleRaces].reverse().map(race => {
                            const hasResults = race.actualResults?.length > 0;
                            const typeColor = BATTLE_TRACK_COLORS[race.trackType] || T.textDim;
                            return (
                              <div key={race.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderLeft:`3px solid ${typeColor}`, borderRadius:8, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{race.raceName}</div>
                                  <div style={{ fontSize:11, color:T.textDim }}>{race.date||"TBD"} · {race.track} · <span style={{ color:typeColor }}>{race.trackType}</span></div>
                                </div>
                                <div style={{ width:8, height:8, borderRadius:"50%", background:hasResults?T.green:T.textDim }} />
                                <button onClick={()=>{
                                  setEditingRaceId(race.id);
                                  const a = [...(race.actualResults||[])]; while(a.length<10) a.push(""); setEditActuals(a);
                                  setBattleView("edit");
                                }} style={{ ...btnStyle(hasResults?"#475569":T.accent), padding:"5px 12px", fontSize:10 }}>{hasResults?"Edit Results":"Enter Results"}</button>
                                <button onClick={()=>handleDeleteRace(race.id)} style={{ ...btnStyle(T.red), padding:"5px 12px", fontSize:10 }}>Delete</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {battleView === "add" && (
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                        <button onClick={()=>setBattleView("list")} style={{ background:"transparent", color:T.textMid, border:`1px solid ${T.border}`, padding:"7px 14px", borderRadius:7, fontSize:13, cursor:"pointer" }}>← Back</button>
                        <h3 style={{ margin:0, fontSize:17, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", color:T.text, letterSpacing:1 }}>LOG NEW RACE PREDICTIONS</h3>
                      </div>

                      {/* Race info */}
                      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:18, marginBottom:12 }}>
                        <div style={{ fontSize:10, color:T.textDim, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:700, marginBottom:12, fontFamily:"'Barlow Condensed',sans-serif" }}>Race Info</div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 150px 155px", gap:10 }}>
                          {[["raceName","Race name (e.g. Daytona 500)"],["track","Track name"]].map(([key,ph])=>(
                            <input key={key} value={battleForm[key]} placeholder={ph} onChange={e=>setBattleForm({...battleForm,[key]:e.target.value})} style={inputStyle} />
                          ))}
                          <input type="date" value={battleForm.date} onChange={e=>setBattleForm({...battleForm,date:e.target.value})} style={inputStyle} />
                          <select value={battleForm.trackType} onChange={e=>setBattleForm({...battleForm,trackType:e.target.value})} style={{ ...inputStyle, cursor:"pointer" }}>
                            {Object.keys(BATTLE_TRACK_COLORS).map(t=><option key={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Active predictors */}
                      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:18, marginBottom:12 }}>
                        <div style={{ fontSize:10, color:T.textDim, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:700, marginBottom:10, fontFamily:"'Barlow Condensed',sans-serif" }}>Active Predictors</div>
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                          {PREDICTORS.map(p=>{
                            const active = activePredictors.includes(p);
                            return (
                              <button key={p} onClick={()=>setActivePredictors(active?activePredictors.filter(x=>x!==p):[...activePredictors,p])} style={{
                                padding:"6px 14px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600,
                                fontFamily:"'Barlow Condensed',sans-serif", transition:"all 0.15s",
                                background:active?`${T.gold}18`:T.surface2,
                                border:active?`1px solid ${T.gold}55`:`1px solid ${T.border}`,
                                color:active?T.gold:T.textDim,
                              }}>{p}</button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Predictor inputs */}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(290px, 1fr))", gap:12, marginBottom:12 }}>
                        {activePredictors.map(predictor => {
                          const open = expandedPredictors[predictor] !== false;
                          return (
                            <div key={predictor} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:14 }}>
                              <button onClick={()=>setExpandedPredictors({...expandedPredictors,[predictor]:!open})}
                                style={{ background:"none", border:"none", cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:0, marginBottom:open?10:0 }}>
                                <div style={{ textAlign:"left" }}>
                                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                    <div style={{ width:7, height:7, borderRadius:"50%", background:PREDICTOR_COLORS[predictor]||T.textDim }} />
                                    <span style={{ fontSize:12, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600 }}>{predictor}</span>
                                  </div>
                                  {PREDICTOR_DESCRIPTIONS[predictor] && <div style={{ fontSize:10, color:T.textDim, marginTop:2, paddingLeft:13 }}>{PREDICTOR_DESCRIPTIONS[predictor]}</div>}
                                </div>
                                <Ic.Chevron open={open} />
                              </button>
                              {open && battleForm.predictions[predictor].map((val,i)=>(
                                <BattleDriverInput key={i} rank={i+1} value={val} placeholder={`P${i+1} driver`}
                                  onChange={v=>{const u=[...battleForm.predictions[predictor]];u[i]=v;setBattleForm({...battleForm,predictions:{...battleForm.predictions,[predictor]:u}});}} />
                              ))}
                            </div>
                          );
                        })}
                      </div>

                      {/* Actual results (optional) */}
                      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:18, marginBottom:18 }}>
                        <div style={{ fontSize:10, color:T.green, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:700, marginBottom:10, fontFamily:"'Barlow Condensed',sans-serif" }}>
                          Actual Results <span style={{ color:T.textDim }}>(optional — fill in after race)</span>
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(210px, 1fr))", gap:4 }}>
                          {battleForm.actualResults.map((val,i)=>(
                            <BattleDriverInput key={i} rank={i+1} value={val} placeholder={`P${i+1} finish`}
                              onChange={v=>{const u=[...battleForm.actualResults];u[i]=v;setBattleForm({...battleForm,actualResults:u});}} />
                          ))}
                        </div>
                      </div>

                      <div style={{ display:"flex", gap:10 }}>
                        <button onClick={handleBattleSave} disabled={!battleForm.raceName||!battleForm.track||battleSaving} style={{ ...btnStyle(T.accent), boxShadow:`0 4px 14px ${T.accentGlow}`, opacity:(!battleForm.raceName||!battleForm.track)?0.5:1 }}>
                          {battleSaving?"Saving…":"Save Race"}
                        </button>
                        <button onClick={()=>setBattleView("list")} style={btnStyle("#334155")}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {battleView === "edit" && editingRaceId && (
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                        <button onClick={()=>setBattleView("list")} style={{ background:"transparent", color:T.textMid, border:`1px solid ${T.border}`, padding:"7px 14px", borderRadius:7, fontSize:13, cursor:"pointer" }}>← Back</button>
                        <h3 style={{ margin:0, fontSize:17, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", color:T.text, letterSpacing:1 }}>EDIT ACTUAL RESULTS</h3>
                        <span style={{ fontSize:12, color:T.textDim }}>— {battleRaces.find(r=>r.id===editingRaceId)?.raceName}</span>
                      </div>
                      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:4, marginBottom:16 }}>
                          {editActuals.map((val,i)=>(
                            <BattleDriverInput key={i} rank={i+1} value={val} placeholder={`P${i+1} finish`}
                              onChange={v=>{const u=[...editActuals];u[i]=v;setEditActuals(u);}} />
                          ))}
                        </div>
                        <button onClick={()=>handleUpdateActuals(editingRaceId)} style={{ ...btnStyle(T.accent), boxShadow:`0 4px 14px ${T.accentGlow}` }}>Save Results</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── CSV DATA ADMIN ─── */}
              {adminSection === "csv" && (
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  {/* Status */}
                  <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"18px 20px", display:"flex", flexDirection:"column", gap:10 }}>
                    <div style={{ fontSize:10, color:T.textDim, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>CSV Data Status</div>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:14, color:csvLoading ? T.gold : csvData.length > 0 ? T.green : T.red }}>●</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:T.text, fontFamily:"'IBM Plex Mono',monospace" }}>
                          {csvLoading ? "Loading…" : csvData.length > 0 ? `✓ ${csvData.length.toLocaleString()} records loaded` : "No data loaded"}
                        </div>
                        {csvError && <div style={{ fontSize:11, color:T.red, fontFamily:"'IBM Plex Mono',monospace", marginTop:4 }}>⚠ {csvError}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                    <label style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"8px 18px", background:T.accent, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase", boxShadow:`0 4px 14px ${T.accentGlow}` }}>
                      <Ic.Import /> Upload CSV
                      <input type="file" accept=".csv" style={{ display:"none" }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => { onCsvUpload(parseCSVData(ev.target.result)); };
                          reader.readAsText(file);
                          e.target.value = "";
                        }} />
                    </label>
                    <button onClick={onCsvRefresh} disabled={csvLoading}
                      style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"8px 18px", background:"#334155", color:"#fff", border:"none", borderRadius:8, cursor:csvLoading?"not-allowed":"pointer", fontSize:12, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase", opacity:csvLoading?0.5:1 }}>
                      {csvLoading ? <Ic.Spinner /> : <Ic.Refresh />} Refresh from GitHub
                    </button>
                  </div>
                </div>
              )}

              {/* ─── SEASON POINTS ADMIN ─── */}
              {adminSection === "points" && (
                <SeasonPointsAdmin
                  drivers={drivers}
                  seasonPoints={seasonPoints}
                  onSave={onSeasonPointsSave}
                />
              )}

              {/* ─── DFS SALARIES ADMIN ─── */}
              {adminSection === "dfs" && (
                <DFSAdminSection
                  dfsSalaries={dfsSalaries}
                  onDfsSalariesSave={onDfsSalariesSave}
                  dfsDisabled={dfsDisabled}
                  onDfsDisabledSave={onDfsDisabledSave}
                  qualPractice={qualPractice}
                  onQualPracticeSave={onQualPracticeSave}
                />
              )}

              {/* ─── TOOL USAGE ADMIN ─── */}
              {adminSection === "usage" && <UsageAdminSection toolUsage={toolUsage} />}

              {adminSection === "blog" && (
                <BlogAdminSection blogPosts={blogPosts} onBlogSave={onBlogSave} />
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TRACK LEADERBOARD — CSV-powered
// ─────────────────────────────────────────────────────────────


export function DFSAdminSection({ dfsSalaries, onDfsSalariesSave, dfsDisabled, onDfsDisabledSave, qualPractice, onQualPracticeSave }) {
  const [activePlatform, setActivePlatform] = useState("dk");
  const [uploadMsg, setUploadMsg]           = useState("");
  const [disableDriverName, setDisableDriverName] = useState("");
  const [disableReason, setDisableReason]   = useState("");
  const [manualName, setManualName]         = useState("");
  const [manualSalary, setManualSalary]     = useState("");
  const [qualText, setQualText]             = useState("");
  const [practiceText, setPracticeText]     = useState("");
  const [qualWeek, setQualWeek]             = useState("");
  const [qualMsg, setQualMsg]               = useState("");

  const inputStyle = { width: "100%", background: T.surface2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "'Barlow',sans-serif" };
  const btnStyle = (c) => ({ padding: "8px 18px", background: c, border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" });

  const plat = DFS_PLATFORMS[activePlatform];

  const handleSalaryUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
        if (lines.length < 2) { setUploadMsg("❌ CSV appears empty"); return; }
        const cols = lines[0].toLowerCase().split(",").map(c => c.trim().replace(/"/g, ""));
        const nameIdx = cols.findIndex(c => c === "name" || c === "nickname" || c === "player" || c === "driver");
        const salaryIdx = cols.findIndex(c => c === "salary" || c === "sal" || c === "price");
        if (nameIdx < 0 || salaryIdx < 0) { setUploadMsg("❌ Could not find Name and Salary columns"); return; }
        const salaries = {};
        let matched = 0;
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const fields = [];
          let current = "", inQuotes = false;
          for (let c = 0; c < lines[i].length; c++) {
            const ch = lines[i][c];
            if (inQuotes) {
              if (ch === '"') { if (c + 1 < lines[i].length && lines[i][c + 1] === '"') { current += '"'; c++; } else inQuotes = false; }
              else current += ch;
            } else {
              if (ch === '"') inQuotes = true;
              else if (ch === ',') { fields.push(current.trim()); current = ""; }
              else current += ch;
            }
          }
          fields.push(current.trim());
          const rawName = (fields[nameIdx] || "").replace(/"/g, "").trim();
          const rawSal  = parseInt((fields[salaryIdx] || "").replace(/[^0-9]/g, "")) || 0;
          if (!rawName || rawSal <= 0) continue;
          // Normalize through alias map first (handles "John H. Nemechek" → "John Hunter Nemechek", etc.)
          const normalizedRaw = normalizeCsvDriverName(rawName);
          const matchedDriver = FULL_TIMER_NAMES.find(d => {
            const dn = d.toLowerCase();
            const rn = normalizedRaw.toLowerCase();
            return dn === rn || rn.includes(dn) || dn.includes(rn);
          });
          if (matchedDriver) { salaries[matchedDriver] = rawSal; matched++; }
        }
        if (matched === 0) { setUploadMsg("❌ No drivers matched"); return; }
        const updated = {
          ...dfsSalaries,
          [activePlatform]: salaries,
          [`${activePlatform}_updated`]: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
        };
        onDfsSalariesSave(updated);
        setUploadMsg(`✓ Imported ${matched} ${plat.abbr} salaries`);
        e.target.value = "";
      } catch (err) { setUploadMsg(`❌ Parse error: ${err.message}`); }
    };
    reader.readAsText(file);
  };

  const handleManualAdd = () => {
    const match = FULL_TIMER_NAMES.find(d => d.toLowerCase() === manualName.trim().toLowerCase());
    if (!match) { setUploadMsg("❌ Driver not found"); return; }
    const sal = parseInt(manualSalary.replace(/[^0-9]/g, "")) || 0;
    if (sal <= 0) { setUploadMsg("❌ Enter a valid salary"); return; }
    const current = dfsSalaries?.[activePlatform] || {};
    const updated = {
      ...dfsSalaries,
      [activePlatform]: { ...current, [match]: sal },
      [`${activePlatform}_updated`]: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
    };
    onDfsSalariesSave(updated);
    setManualName(""); setManualSalary("");
    setUploadMsg(`✓ Set ${match} → $${sal.toLocaleString()}`);
  };

  const handleDisableDriver = () => {
    const match = FULL_TIMER_NAMES.find(d => d.toLowerCase() === disableDriverName.trim().toLowerCase());
    if (!match) { setUploadMsg("❌ Driver not found"); return; }
    if ((dfsDisabled || []).find(d => d.name === match)) { setUploadMsg("⚠ Already disabled"); return; }
    const updated = [...(dfsDisabled || []), { name: match, reason: disableReason.trim() || "" }];
    onDfsDisabledSave(updated);
    setDisableDriverName(""); setDisableReason("");
    setUploadMsg(`✓ Disabled ${match}`);
  };

  const handleEnableDriver = (name) => {
    onDfsDisabledSave((dfsDisabled || []).filter(d => d.name !== name));
    setUploadMsg(`✓ Re-enabled ${name}`);
  };

  // Parse qualifying/practice text into { driverName: position } map
  const parseQualPracticeText = (text) => {
    if (!text || !text.trim()) return { results: {}, unmatched: [] };
    const lines = text.trim().split("\n").filter(l => l.trim());
    const results = {};
    const unmatched = [];
    let pendingPos = null; // Track standalone position numbers for multi-line format
    let driverCount = 0;  // Count matched drivers for fallback position

    const matchDriver = (raw) => {
      const normalized = normalizeCsvDriverName(raw);
      if (FULL_TIMER_NAMES.includes(normalized)) return normalized;
      const nl = normalized.toLowerCase();
      const fuzzy = FULL_TIMER_NAMES.find(d => {
        const dl = d.toLowerCase();
        return dl === nl || nl.includes(dl) || dl.includes(nl);
      });
      if (!fuzzy && /^[A-Za-z]/.test(raw.trim()) && raw.trim().includes(" ")) {
        console.warn("[QualPractice matchDriver] Unmatched driver name:", raw.trim(), "→ normalized:", normalized);
      }
      return fuzzy || null;
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip obvious header/junk lines
      if (/^(FINISH|POS|POSITION|TIME|BEHIND|BEST|SPEED|DRIVER|RANK|#|--|DNQ)/i.test(trimmed)) continue;
      // Skip lines that are purely numeric data (lap times like 29.14, speeds like 185.30, diffs like -0.02)
      if (/^-?\d*\.?\d+$/.test(trimmed)) {
        // But first check: is this a standalone integer 1-50? That's a position number.
        const asInt = parseInt(trimmed);
        if (/^\d+$/.test(trimmed) && asInt >= 1 && asInt <= 50) {
          pendingPos = asInt;
        }
        continue;
      }

      // Try tab-separated format (e.g. "1\tTyler Reddick\t45\tTeam\tMfg\t29.14")
      const tabParts = trimmed.split("\t").map(s => s.trim()).filter(Boolean);
      const spaceParts = trimmed.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
      const parts = tabParts.length >= 2 ? tabParts : spaceParts.length >= 2 ? spaceParts : null;

      let driverName = null;
      let pos = null;

      if (parts && parts.length >= 2) {
        // Multi-column line
        const firstNum = parseInt(parts[0]);
        if (!isNaN(firstNum) && firstNum >= 1 && firstNum <= 50) {
          pos = firstNum;
          for (let c = 1; c < parts.length; c++) {
            const m = matchDriver(parts[c]);
            if (m) { driverName = m; break; }
          }
          if (!driverName) {
            const m = matchDriver(parts[1]);
            if (m) driverName = m;
          }
        } else {
          for (let c = 0; c < parts.length; c++) {
            const m = matchDriver(parts[c]);
            if (m) { driverName = m; break; }
          }
        }
      } else {
        // Single-column: "1. Kyle Larson" or "Kyle Larson" or just a name
        const numbered = trimmed.match(/^(\d+)[.\s)\-]+\s*(.+)$/);
        if (numbered) {
          pos = parseInt(numbered[1]);
          driverName = matchDriver(numbered[2].trim());
          if (!driverName && /^[A-Za-z]/.test(numbered[2].trim())) {
            unmatched.push(numbered[2].trim());
          }
        } else {
          driverName = matchDriver(trimmed);
        }
      }

      if (driverName && !results[driverName]) {
        driverCount++;
        // Priority: explicit position from this line > pending position from previous line > driver count
        const finalPos = pos || pendingPos || driverCount;
        results[driverName] = Math.max(1, Math.min(50, finalPos));
        pendingPos = null; // Consume the pending position
      } else if (!driverName && pos == null && pendingPos == null) {
        // Non-driver, non-numeric, non-header line — skip silently (junk data)
      }
    }
    return { results, unmatched };
  };

  // Parse NASCAR practice lap-time data (tab-delimited format from NASCAR.com/app)
  // Format: POS\tOVERALL\t5-LAP\t10-LAP\t15-LAP\t20-LAP\t25-LAP\t30-LAP (header)
  //         1\tChristopher Bell\t30.20\t29.97\t30.06\t30.11\t...\t-- (data rows)
  const parsePracticeTimingText = (text, salaryDataForRank) => {
    if (!text || !text.trim()) return { results: {}, unmatched: [], isParsedTiming: false };
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return { results: {}, unmatched: [], isParsedTiming: false };

    // Detect if this looks like tab-delimited timing data (has numbers like 29.xx / 30.xx)
    const looksLikeTiming = lines.some(l => /\t\d+\.\d+/.test(l) || /\t--/.test(l));
    if (!looksLikeTiming) return { results: {}, unmatched: [], isParsedTiming: false };

    const matchDriver = (raw) => {
      if (!raw || !raw.trim()) return null;
      const normalized = normalizeCsvDriverName(raw.trim());
      if (FULL_TIMER_NAMES.includes(normalized)) return normalized;
      const nl = normalized.toLowerCase();
      const fuzzy = FULL_TIMER_NAMES.find(d => {
        const dl = d.toLowerCase();
        return dl === nl || nl.includes(dl) || dl.includes(nl);
      });
      if (!fuzzy && /^[A-Za-z]/.test(raw.trim()) && raw.trim().includes(" ")) {
        console.warn("[PracticeTiming] Unmatched driver:", raw.trim(), "→ normalized:", normalized);
      }
      return fuzzy || null;
    };

    const driverData = []; // { name, overall, lap5, lap10, lap15, lap20, lap25, lap30 }
    const unmatched = [];

    for (const line of lines) {
      const parts = line.split("\t").map(p => p.trim());
      if (parts.length < 3) continue;
      // Skip header
      if (/^(POS|POSITION|#)$/i.test(parts[0])) continue;
      // First field should be position (number), second is driver name
      let pos = -1, nameIdx = -1;
      if (/^\d+$/.test(parts[0])) { pos = parseInt(parts[0]); nameIdx = 1; }
      else if (/^\d+$/.test(parts[1])) { pos = parseInt(parts[1]); nameIdx = 2; }
      else { nameIdx = 0; } // fallback: first field is name

      const rawName = parts[nameIdx] || "";
      if (!rawName || !rawName.includes(" ")) continue;
      const driver = matchDriver(rawName);
      if (!driver) { if (rawName.length > 3) unmatched.push(rawName); continue; }

      // Extract lap time floats (-- → null)
      const parseTime = (s) => { if (!s || s === "--" || s === "-") return null; const n = parseFloat(s); return isNaN(n) ? null : n; };
      const dataStart = nameIdx + 1;
      const overall = parseTime(parts[dataStart]);
      const lap5    = parseTime(parts[dataStart + 1]);
      const lap10   = parseTime(parts[dataStart + 2]);
      const lap15   = parseTime(parts[dataStart + 3]);
      const lap20   = parseTime(parts[dataStart + 4]);
      const lap25   = parseTime(parts[dataStart + 5]);
      const lap30   = parseTime(parts[dataStart + 6]);
      driverData.push({ name: driver, overall, lap5, lap10, lap15, lap20, lap25, lap30 });
    }

    if (driverData.length === 0) return { results: {}, unmatched, isParsedTiming: false };

    // Compute derived metrics
    const N = driverData.length;
    // Sort by overall (ascending = faster)
    const byOverall = [...driverData].filter(d => d.overall != null).sort((a, b) => a.overall - b.overall);
    // Long-run rank: prefer 30-lap, fall back to 15-lap, then overall
    const byLongRun = [...driverData].filter(d => d.lap30 != null || d.lap15 != null || d.overall != null)
      .sort((a, b) => (a.lap30 || a.lap15 || a.overall) - (b.lap30 || b.lap15 || b.overall));
    // Delta rank: short-long delta (lap5 - lap30); lower = better tire management
    const withDelta = driverData.filter(d => d.lap5 != null && (d.lap30 != null || d.lap15 != null))
      .map(d => ({ ...d, delta: d.lap5 - (d.lap30 || d.lap15) }))
      .sort((a, b) => a.delta - b.delta); // lower delta = better = rank 1

    // Build salary rank map for speed-vs-salary gap
    const salaryRankMap = {};
    if (salaryDataForRank && Object.keys(salaryDataForRank).length > 0) {
      const sorted = driverData
        .filter(d => (salaryDataForRank[d.name] || 0) > 0)
        .sort((a, b) => (salaryDataForRank[b.name] || 0) - (salaryDataForRank[a.name] || 0));
      sorted.forEach((d, i) => { salaryRankMap[d.name] = i + 1; });
    }

    const results = {};
    for (const d of driverData) {
      const speedRank = byOverall.findIndex(x => x.name === d.name) + 1 || N;
      const longRunRank = byLongRun.findIndex(x => x.name === d.name) + 1 || null;
      const deltaEntry = withDelta.find(x => x.name === d.name);
      const deltaRank = deltaEntry ? withDelta.findIndex(x => x.name === d.name) + 1 : null;
      const salaryRank = salaryRankMap[d.name] || null;
      const speedVsSalaryGap = (salaryRank != null && speedRank > 0) ? salaryRank - speedRank : null;
      results[d.name] = {
        speedRank,
        longRunRank: longRunRank || null,
        longRunTotal: byLongRun.length,
        deltaRank: deltaRank || null,
        deltaTotal: withDelta.length,
        speedVsSalaryGap,
        totalDrivers: N,
        overall: d.overall,
        lap5: d.lap5,
        lap30: d.lap30 || d.lap15,
      };
    }
    return { results, unmatched, isParsedTiming: true, driverCount: N };
  };

  const handleQualImport = () => {
    if (!qualWeek) { setQualMsg("❌ Select a race week first"); return; }
    const { results: qualResults, unmatched: qualUnmatched } = parseQualPracticeText(qualText);
    // Try rich timing parser first for practice; fall back to position-only
    const currentSalaryData = dfsSalaries?.[activePlatform] || {};
    const { results: practiceRich, unmatched: practiceUnmatched, isParsedTiming } =
      parsePracticeTimingText(practiceText, currentSalaryData);
    let practiceResults;
    if (isParsedTiming) {
      practiceResults = practiceRich;
    } else {
      practiceResults = parseQualPracticeText(practiceText).results;
    }
    if (Object.keys(qualResults).length === 0 && Object.keys(practiceResults).length === 0) {
      setQualMsg("❌ No drivers matched from either text area");
      return;
    }
    const weekVal = qualWeek === "allstar" ? "allstar" : parseInt(qualWeek);
    const updated = {
      week: weekVal,
      qualifying: qualResults,
      practice: practiceResults,
      practiceIsTiming: isParsedTiming,
      updated: new Date().toISOString(),
    };
    onQualPracticeSave(updated);
    const allUnmatched = [...new Set([...qualUnmatched, ...practiceUnmatched])];
    const qCount = Object.keys(qualResults).length;
    const pCount = Object.keys(practiceResults).length;
    let msg = `✓ Imported ${qCount} qualifying`;
    if (pCount > 0) msg += ` + ${pCount} practice${isParsedTiming ? " (timing data ✓)" : ""}`;
    msg += " drivers";
    if (allUnmatched.length > 0) msg += ` · Unmatched: ${allUnmatched.join(", ")}`;
    setQualMsg(msg);
    setQualText("");
    setPracticeText("");
  };

  // Current qualifying status
  const qualWeekLabel = qualPractice?.week != null
    ? (qualPractice.week === "allstar" ? "All-Star" : `Week ${qualPractice.week}`)
    : null;
  const qualCount = qualPractice?.qualifying ? Object.keys(qualPractice.qualifying).length : 0;
  const practiceCount = qualPractice?.practice ? Object.keys(qualPractice.practice).length : 0;

  const currentSalaries = dfsSalaries?.[activePlatform] || {};
  const salaryCount = Object.keys(currentSalaries).length;
  const updatedAt = dfsSalaries?.[`${activePlatform}_updated`] || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Platform toggle */}
      <div style={{ display: "flex", gap: 8 }}>
        {Object.values(DFS_PLATFORMS).map(p => {
          const active = activePlatform === p.id;
          return (
            <button key={p.id} onClick={() => { setActivePlatform(p.id); setUploadMsg(""); }}
              style={{ flex: 1, padding: "8px 14px", borderRadius: 8, cursor: "pointer", background: active ? p.colorSoft : T.surface3, border: `1px solid ${active ? p.color : T.border}`, color: active ? p.color : T.textDim, fontSize: 12, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
              {p.name}
            </button>
          );
        })}
      </div>
      {/* Status */}
      <div style={{ padding: "10px 14px", background: T.surface3, border: `1px solid ${T.border}`, borderRadius: 8 }}>
        <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 4 }}>{plat.abbr} Salary Status</div>
        <div style={{ fontSize: 12, color: salaryCount > 0 ? T.green : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
          {salaryCount > 0 ? `✓ ${salaryCount} drivers` : "No salaries yet"}
          {updatedAt && <span style={{ color: T.textDim }}> · Updated: {updatedAt}</span>}
        </div>
      </div>
      {/* CSV Upload */}
      <div>
        <label style={{ fontSize: 10, color: T.textDim, display: "block", marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif" }}>Upload {plat.name} Salary CSV</label>
        <div style={{ fontSize: 10, color: T.textDim, marginBottom: 8, fontFamily: "'IBM Plex Mono',monospace" }}>
          Export CSV from {plat.name} contest page. Needs: Name (or Nickname/Driver), Salary columns.
        </div>
        <input type="file" accept=".csv" onChange={handleSalaryUpload}
          style={{ fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace" }} />
      </div>
      {/* Manual entry */}
      <div>
        <label style={{ fontSize: 10, color: T.textDim, display: "block", marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif" }}>Manual Salary Entry</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Driver name" style={{ ...inputStyle, flex: 2 }} />
          <input value={manualSalary} onChange={e => setManualSalary(e.target.value)} placeholder="Salary (e.g. 10200)" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={handleManualAdd} style={btnStyle(plat.color)}>Set</button>
        </div>
      </div>
      {/* View current salaries */}
      {salaryCount > 0 && (
        <details style={{ background: T.surface3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px" }}>
          <summary style={{ cursor: "pointer", fontSize: 11, color: T.textMid, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
            View {plat.abbr} Salaries ({salaryCount})
          </summary>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", maxHeight: 300, overflowY: "auto" }}>
            {Object.entries(currentSalaries).sort((a, b) => b[1] - a[1]).map(([name, sal]) => (
              <div key={name} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: T.textMid, padding: "2px 0", display: "flex", justifyContent: "space-between" }}>
                <span>{name}</span>
                <span style={{ color: plat.color, fontWeight: 700 }}>${sal.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      {/* Clear */}
      {salaryCount > 0 && (
        <button onClick={() => {
          if (!window.confirm(`Clear all ${plat.abbr} salaries?`)) return;
          const updated = { ...dfsSalaries };
          delete updated[activePlatform];
          delete updated[`${activePlatform}_updated`];
          onDfsSalariesSave(updated);
          setUploadMsg(`✓ Cleared`);
        }} style={{ ...btnStyle("#334155"), alignSelf: "flex-start" }}>
          Clear {plat.abbr} Salaries
        </button>
      )}
      {/* DRIVER AVAILABILITY */}
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Driver Availability</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={disableDriverName} onChange={e => setDisableDriverName(e.target.value)} placeholder="Driver name" style={{ ...inputStyle, flex: 2 }} />
          <input value={disableReason} onChange={e => setDisableReason(e.target.value)} placeholder="Reason (optional)" style={{ ...inputStyle, flex: 2 }} />
          <button onClick={handleDisableDriver} style={btnStyle(T.red)}>Disable</button>
        </div>
        {(dfsDisabled || []).length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 4 }}>Currently Disabled</div>
            {dfsDisabled.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: T.redBg, border: `1px solid ${T.red}30`, borderRadius: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.red, flex: 1 }}>{d.name}</span>
                {d.reason && <span style={{ fontSize: 10, color: T.textDim, fontStyle: "italic" }}>{d.reason}</span>}
                <button onClick={() => handleEnableDriver(d.name)} style={{ background: "none", border: `1px solid ${T.green}40`, color: T.green, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif" }}>
                  Re-enable
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>All drivers active</div>
        )}
      </div>
      {/* Status msg */}
      {uploadMsg && (
        <div style={{ fontSize: 12, color: uploadMsg.startsWith("✓") ? T.green : uploadMsg.startsWith("⚠") ? T.gold : T.red, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 0" }}>
          {uploadMsg}
        </div>
      )}

      {/* ─── QUALIFYING & PRACTICE DATA ─── */}
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.accent, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>🏁 Qualifying & Practice Data</div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>Paste from NASCAR.com. Practice results are optional.</div>
        </div>

        {/* Current status */}
        <div style={{ padding: "8px 12px", background: T.surface3, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 2 }}>Current Data</div>
          <div style={{ fontSize: 12, color: qualCount > 0 ? T.green : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
            {qualCount > 0
              ? `✓ ${qualWeekLabel} qualifying: ${qualCount} drivers${practiceCount > 0 ? ` + ${practiceCount} practice` : ""}${qualPractice?.updated ? ` · ${new Date(qualPractice.updated).toLocaleString()}` : ""}`
              : "No qualifying data saved"
            }
          </div>
        </div>

        {/* Race week selector */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: T.textDim, display: "block", marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif" }}>Race Week</label>
          <select value={qualWeek} onChange={e => setQualWeek(e.target.value)}
            style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none" }}>
            <option value="">Choose a race…</option>
            {SCHEDULE.map(r => (
              <option key={r.allStar ? "allstar" : r.week} value={r.allStar ? "allstar" : r.week}>
                {r.allStar ? "★" : `Wk ${r.week}`} · {r.date} · {r.name}{r.allStar ? " (Non-Points)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Qualifying text area */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: T.textDim, display: "block", marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif" }}>Qualifying Results (paste from qualifying tab)</label>
          <textarea value={qualText} onChange={e => setQualText(e.target.value)} rows={7}
            placeholder="Paste qualifying results here…"
            style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "10px 12px", fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", outline: "none", resize: "vertical", lineHeight: 1.6 }} />
        </div>

        {/* Practice text area */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: T.textDim, display: "block", marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif" }}>Practice Results (optional) — paste tab-delimited timing from NASCAR app</label>
          <textarea value={practiceText} onChange={e => setPracticeText(e.target.value)} rows={5}
            placeholder={"Paste practice results…\nFormat A (timing): POS\\tDRIVER\\tOVERALL\\t5-LAP\\t10-LAP\\t15-LAP\\t20-LAP\\t25-LAP\\t30-LAP\nFormat B (positions): standard name/position list"}
            style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "10px 12px", fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", outline: "none", resize: "vertical", lineHeight: 1.6 }} />
        </div>

        {/* Import button + status */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={handleQualImport}
            style={{ padding: "9px 22px", background: "linear-gradient(135deg, #06b6d4, #1e90ff)", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase", boxShadow: "0 4px 14px rgba(6,182,212,0.3)" }}>
            Import & Save
          </button>
          {qualCount > 0 && (
            <button onClick={() => { if (window.confirm("Clear qualifying & practice data?")) { onQualPracticeSave(null); setQualMsg("✓ Cleared"); } }}
              style={{ ...btnStyle("#334155"), padding: "9px 16px" }}>
              Clear Data
            </button>
          )}
          {qualMsg && (
            <span style={{ fontSize: 12, color: qualMsg.startsWith("✓") ? T.green : qualMsg.includes("Unmatched") ? T.gold : T.red, fontFamily: "'IBM Plex Mono',monospace" }}>
              {qualMsg}
            </span>
          )}
        </div>

        {/* View imported qualifying data */}
        {qualCount > 0 && (
          <details style={{ background: T.surface3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 11, color: T.textMid, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
              View Qualifying Data ({qualCount} drivers)
            </summary>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", maxHeight: 300, overflowY: "auto" }}>
              {Object.entries(qualPractice.qualifying).sort((a, b) => a[1] - b[1]).map(([name, pos]) => (
                <div key={name} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: T.textMid, padding: "2px 0", display: "flex", justifyContent: "space-between" }}>
                  <span>{name}</span>
                  <span style={{ color: T.accent, fontWeight: 700 }}>P{pos}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* View imported practice data */}
        {practiceCount > 0 && (
          <details style={{ background: T.surface3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontSize: 11, color: T.textMid, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
              View Practice Data ({practiceCount} drivers){qualPractice?.practiceIsTiming ? " — Timing ✓" : ""}
            </summary>
            <div style={{ marginTop: 8, maxHeight: 350, overflowY: "auto" }}>
              {qualPractice.practiceIsTiming ? (
                // Rich timing data view
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "2px 8px", padding: "4px 0", borderBottom: `1px solid ${T.border}`, fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                    <span>Driver</span><span>Spd Rank</span><span>LR Rank</span><span>Δ Rank</span><span>Sal Gap</span>
                  </div>
                  {Object.entries(qualPractice.practice)
                    .sort((a, b) => (a[1].speedRank || 99) - (b[1].speedRank || 99))
                    .map(([name, pd]) => (
                    <div key={name} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "2px 8px", padding: "3px 0", borderBottom: `1px solid ${T.border}10`, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: T.textMid }}>
                      <span style={{ color: T.text, fontWeight: pd.speedRank <= 5 ? 700 : 400 }}>{name}</span>
                      <span style={{ color: pd.speedRank <= 3 ? T.green : pd.speedRank <= 10 ? T.accent : T.textDim }}>#{pd.speedRank}</span>
                      <span style={{ color: pd.longRunRank <= 3 ? T.green : T.textDim }}>{pd.longRunRank ? `#${pd.longRunRank}` : "—"}</span>
                      <span style={{ color: pd.deltaRank <= 3 ? T.green : T.textDim }}>{pd.deltaRank ? `#${pd.deltaRank}` : "—"}</span>
                      <span style={{ color: pd.speedVsSalaryGap > 3 ? T.green : pd.speedVsSalaryGap < -3 ? T.red : T.textDim }}>
                        {pd.speedVsSalaryGap != null ? (pd.speedVsSalaryGap > 0 ? `+${pd.speedVsSalaryGap}` : pd.speedVsSalaryGap) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                // Legacy position view
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px" }}>
                  {Object.entries(qualPractice.practice).sort((a, b) => a[1] - b[1]).map(([name, pos]) => (
                    <div key={name} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: T.textMid, padding: "2px 0", display: "flex", justifyContent: "space-between" }}>
                      <span>{name}</span>
                      <span style={{ color: T.green, fontWeight: 700 }}>P{pos}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BLOG TAB — Public blog reader
// ─────────────────────────────────────────────────────────────


export function BlogAdminSection({ blogPosts, onBlogSave }) {
  const [blogView, setBlogView] = useState("list"); // "list" | "editor"
  const [editingPost, setEditingPost] = useState(null);
  const [blogTitle, setBlogTitle] = useState("");
  const [blogCategory, setBlogCategory] = useState("General");
  const [blogBody, setBlogBody] = useState("");
  const [blogFeaturedImage, setBlogFeaturedImage] = useState("");
  const [blogStatus, setBlogStatus] = useState("draft");
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogMsg, setBlogMsg] = useState("");
  const editorRef = useRef(null);

  const inputStyle = { width:"100%", background:T.surface2, border:`1px solid ${T.border}`, color:T.text, borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", fontFamily:"'Barlow',sans-serif" };
  const btnStyle = (col) => ({ padding:"8px 18px", background:col, border:"none", color:"#fff", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" });

  const sortedPosts = useMemo(() =>
    [...(blogPosts || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [blogPosts]
  );

  const formatDate = (d) => {
    try { return new Date(d).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }); }
    catch { return d; }
  };

  const resetEditor = () => {
    setBlogTitle(""); setBlogCategory("General"); setBlogBody(""); setBlogFeaturedImage(""); setBlogStatus("draft"); setEditingPost(null); setBlogMsg("");
    if (editorRef.current) editorRef.current.innerHTML = "";
  };

  const openEditor = (post) => {
    if (post) {
      setEditingPost(post);
      setBlogTitle(post.title || "");
      setBlogCategory(post.category || "General");
      setBlogBody(post.body || "");
      setBlogFeaturedImage(post.featured_image || "");
      setBlogStatus(post.status || "draft");
      setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = post.body || ""; }, 50);
    } else {
      resetEditor();
    }
    setBlogView("editor");
  };

  const execCmd = (cmd, val) => {
    document.execCommand(cmd, false, val || null);
    editorRef.current?.focus();
  };

  const handleInsertLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) execCmd("createLink", url);
  };

  const handleInsertImage = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        execCmd("insertImage", ev.target.result);
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
  };

  const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  // Build provider embed HTML from a pasted URL. Returns null when the URL
  // isn't a recognized embeddable link (caller falls back to a plain link).
  const buildEmbedHtml = (url) => {
    let m;
    // TikTok — https://www.tiktok.com/@user/video/1234567890
    m = url.match(/tiktok\.com\/@[^/?#]+\/video\/(\d+)/);
    if (m) {
      const id = m[1];
      return `<blockquote class="tiktok-embed" cite="${escAttr(url)}" data-video-id="${id}" style="max-width:605px;min-width:325px;"><section><p>TikTok embed (renders when published)</p></section></blockquote><p><br></p>`;
    }
    // YouTube — watch?v=, youtu.be/, shorts/, embed/
    m = url.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m) {
      const id = m[1];
      return `<div class="blog-embed-video"><iframe src="https://www.youtube.com/embed/${id}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><p><br></p>`;
    }
    // X / Twitter — https://x.com/user/status/1234567890
    m = url.match(/(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+\/status\/(\d+)/);
    if (m) {
      return `<blockquote class="twitter-tweet" data-dnt="true"><p>X post embed (renders when published)</p><a href="${escAttr(url)}"></a></blockquote><p><br></p>`;
    }
    // Instagram — /p/ or /reel/
    m = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    if (m) {
      const canon = `https://www.instagram.com/p/${m[1]}/`;
      return `<blockquote class="instagram-media" data-instgrm-permalink="${canon}" data-instgrm-version="14"><p>Instagram embed (renders when published)</p><a href="${canon}"></a></blockquote><p><br></p>`;
    }
    return null;
  };

  const handleInsertEmbed = () => {
    const url = window.prompt("Paste a TikTok, YouTube, X, or Instagram URL to embed:");
    if (!url || !url.trim()) return;
    const clean = url.trim();
    const html = buildEmbedHtml(clean) || `<p><a href="${escAttr(clean)}">${escAttr(clean)}</a></p>`;
    editorRef.current?.focus();
    execCmd("insertHTML", html);
    setBlogBody(editorRef.current?.innerHTML || "");
  };

  const handleFeaturedImage = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) { setBlogMsg("⚠ Image too large — max 4MB."); return; }
      const reader = new FileReader();
      reader.onload = (ev) => { setBlogFeaturedImage(ev.target.result); };
      reader.readAsDataURL(file);
    };
    fileInput.click();
  };

  const handleSavePost = async () => {
    const body = editorRef.current?.innerHTML || "";
    if (!blogTitle.trim()) { setBlogMsg("⚠ Title is required."); return; }
    if (!body.trim() || body === "<br>") { setBlogMsg("⚠ Post body is required."); return; }
    setBlogSaving(true);
    const now = new Date().toISOString();
    const post = {
      id: editingPost?.id || Date.now().toString(),
      title: blogTitle.trim(),
      category: blogCategory,
      body: body,
      featured_image: blogFeaturedImage || "",
      status: blogStatus,
      created_at: editingPost?.created_at || now,
      updated_at: now,
    };
    let updated;
    if (editingPost) {
      updated = (blogPosts || []).map(p => p.id === editingPost.id ? post : p);
    } else {
      updated = [...(blogPosts || []), post];
    }
    await onBlogSave(updated);
    setBlogSaving(false);
    setBlogMsg(`✓ Post ${editingPost ? "updated" : "created"} as ${blogStatus}.`);
    resetEditor();
    setBlogView("list");
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Delete this blog post?")) return;
    const updated = (blogPosts || []).filter(p => p.id !== postId);
    await onBlogSave(updated);
  };

  // Posts list view
  if (blogView === "list") {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.5, textTransform:"uppercase" }}>
            Blog Posts ({(blogPosts || []).length})
          </div>
          <button onClick={() => openEditor(null)} style={{ ...btnStyle(T.accent), boxShadow:`0 4px 16px ${T.accentGlow}` }}>+ New Post</button>
        </div>

        {blogMsg && <div style={{ padding:"8px 14px", borderRadius:8, fontSize:12, color:blogMsg.startsWith("✓") ? T.green : T.gold, background:blogMsg.startsWith("✓") ? T.greenBg : T.goldBg, fontFamily:"'IBM Plex Mono',monospace" }}>{blogMsg}</div>}

        {sortedPosts.length === 0 ? (
          <div style={{ padding:30, textAlign:"center", color:T.textDim, fontSize:13, background:T.surface3, border:`1px solid ${T.border}`, borderRadius:10 }}>No blog posts yet. Click "+ New Post" to create your first.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {sortedPosts.map(post => (
              <div key={post.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:T.surface, border:`1px solid ${T.border}`, borderRadius:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:"'Barlow Condensed',sans-serif" }}>{post.title}</span>
                    <span style={{
                      padding:"2px 8px", borderRadius:4, fontSize:9, fontWeight:700,
                      fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.5, textTransform:"uppercase",
                      background: post.status === "published" ? T.greenBg : T.goldBg,
                      color: post.status === "published" ? T.green : T.gold,
                    }}>{post.status}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>
                    <span style={{ color: BLOG_CAT_COLORS[post.category] || T.textDim }}>{post.category}</span>
                    <span>{formatDate(post.created_at)}</span>
                  </div>
                </div>
                <button onClick={() => openEditor(post)} style={{ ...btnStyle(T.accent), padding:"5px 12px", fontSize:10 }}>Edit</button>
                <button onClick={() => handleDeletePost(post.id)} style={{ ...btnStyle(T.red), padding:"5px 12px", fontSize:10 }}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Editor view
  const toolbarBtnStyle = (active) => ({
    padding:"6px 8px", background: active ? T.accentSoft : "transparent", border:`1px solid ${active ? T.accent : T.border}`,
    color: active ? T.accent : T.textMid, borderRadius:6, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, animation:"fadeIn 0.2s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <button onClick={() => { resetEditor(); setBlogView("list"); }} style={{
          display:"flex", alignItems:"center", gap:5, background:"none", border:"none",
          color:T.accent, cursor:"pointer", fontSize:12, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase",
        }}><Ic.ArrowLeft /> Back to Posts</button>
        <div style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.5, textTransform:"uppercase" }}>
          {editingPost ? "Edit Post" : "New Post"}
        </div>
      </div>

      {blogMsg && <div style={{ padding:"8px 14px", borderRadius:8, fontSize:12, color:blogMsg.startsWith("✓") ? T.green : T.gold, background:blogMsg.startsWith("✓") ? T.greenBg : T.goldBg, fontFamily:"'IBM Plex Mono',monospace" }}>{blogMsg}</div>}

      {/* Title */}
      <div>
        <label style={{ fontSize:10, color:T.textDim, display:"block", marginBottom:6, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Title</label>
        <input value={blogTitle} onChange={e => setBlogTitle(e.target.value)} placeholder="Enter post title…" style={inputStyle} />
      </div>

      {/* Category & Status */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div>
          <label style={{ fontSize:10, color:T.textDim, display:"block", marginBottom:6, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Category</label>
          <select value={blogCategory} onChange={e => setBlogCategory(e.target.value)} style={{ ...inputStyle, cursor:"pointer" }}>
            {BLOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:10, color:T.textDim, display:"block", marginBottom:6, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Status</label>
          <select value={blogStatus} onChange={e => setBlogStatus(e.target.value)} style={{ ...inputStyle, cursor:"pointer" }}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      {/* Featured Image */}
      <div>
        <label style={{ fontSize:10, color:T.textDim, display:"block", marginBottom:6, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Featured Image</label>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <button onClick={handleFeaturedImage} style={btnStyle("#334155")}>
            <span style={{ display:"flex", alignItems:"center", gap:5 }}><Ic.Image /> {blogFeaturedImage ? "Change Image" : "Upload Image"}</span>
          </button>
          {blogFeaturedImage && (
            <>
              <img src={blogFeaturedImage} alt="" style={{ height:48, borderRadius:6, border:`1px solid ${T.border}` }} />
              <button onClick={() => setBlogFeaturedImage("")} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:11 }}>Remove</button>
            </>
          )}
        </div>
      </div>

      {/* Rich Text Editor */}
      <div>
        <label style={{ fontSize:10, color:T.textDim, display:"block", marginBottom:6, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Body</label>

        {/* Toolbar */}
        <div style={{ display:"flex", gap:4, padding:"6px 8px", background:T.surface3, border:`1px solid ${T.border}`, borderRadius:"8px 8px 0 0", borderBottom:"none", flexWrap:"wrap" }}>
          <button onClick={() => execCmd("bold")} style={toolbarBtnStyle(false)} title="Bold"><Ic.Bold /></button>
          <button onClick={() => execCmd("italic")} style={toolbarBtnStyle(false)} title="Italic"><Ic.Italic /></button>
          <div style={{ width:1, background:T.border, margin:"0 4px" }} />
          <button onClick={() => execCmd("formatBlock", "h2")} style={toolbarBtnStyle(false)} title="Heading 2">
            <span style={{ fontSize:12, fontWeight:900, fontFamily:"'Barlow Condensed',sans-serif" }}>H2</span>
          </button>
          <button onClick={() => execCmd("formatBlock", "h3")} style={toolbarBtnStyle(false)} title="Heading 3">
            <span style={{ fontSize:12, fontWeight:900, fontFamily:"'Barlow Condensed',sans-serif" }}>H3</span>
          </button>
          <button onClick={() => execCmd("formatBlock", "p")} style={toolbarBtnStyle(false)} title="Paragraph">
            <span style={{ fontSize:12, fontFamily:"'Barlow Condensed',sans-serif" }}>P</span>
          </button>
          <div style={{ width:1, background:T.border, margin:"0 4px" }} />
          <button onClick={() => execCmd("insertUnorderedList")} style={toolbarBtnStyle(false)} title="Bullet List"><Ic.List /></button>
          <button onClick={() => execCmd("insertOrderedList")} style={toolbarBtnStyle(false)} title="Numbered List">
            <span style={{ fontSize:12, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif" }}>1.</span>
          </button>
          <div style={{ width:1, background:T.border, margin:"0 4px" }} />
          <button onClick={handleInsertLink} style={toolbarBtnStyle(false)} title="Insert Link"><Ic.Link /></button>
          <button onClick={handleInsertImage} style={toolbarBtnStyle(false)} title="Insert Image"><Ic.Image /></button>
          <button onClick={handleInsertEmbed} style={toolbarBtnStyle(false)} title="Embed media (TikTok, YouTube, X, Instagram)"><Ic.Embed /></button>
          <button onClick={() => execCmd("formatBlock", "blockquote")} style={toolbarBtnStyle(false)} title="Quote">
            <span style={{ fontSize:14, fontWeight:700, fontFamily:"serif" }}>"</span>
          </button>
        </div>

        {/* Editable area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Post body"
          aria-multiline="true"
          tabIndex={0}
          data-testid="blog-body-editor"
          data-placeholder="Write your post here…"
          onInput={() => setBlogBody(editorRef.current?.innerHTML || "")}
          style={{
            minHeight:300, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:"0 0 8px 8px",
            padding:"16px 18px", fontSize:15, lineHeight:1.8, color:T.text,
            fontFamily:"'Barlow',sans-serif", outline:"none", overflowY:"auto", maxHeight:500,
          }}
        />

        <style>{`
          [contenteditable] h2,[contenteditable] h3{font-family:'Barlow Condensed',sans-serif;font-weight:800;letter-spacing:1px;margin:12px 0 8px}
          [contenteditable] h2{font-size:22px} [contenteditable] h3{font-size:18px}
          [contenteditable] p{margin:0 0 8px}
          [contenteditable] a{color:${T.accent}}
          [contenteditable] img{max-width:100%;border-radius:8px;margin:8px 0}
          [contenteditable] blockquote{border-left:3px solid ${T.accent};padding:4px 12px;margin:8px 0;color:${T.textMid}}
          [contenteditable]:empty:before{content:attr(data-placeholder);color:${T.textDim}}
          [contenteditable] .blog-embed-video{position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:8px 0}
          [contenteditable] .blog-embed-video iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:8px}
          [contenteditable] .tiktok-embed,[contenteditable] .twitter-tweet,[contenteditable] .instagram-media{border:2px dashed ${T.accent};border-radius:8px;padding:14px 16px;margin:8px 0;background:transparent}
          [contenteditable] .tiktok-embed section p,[contenteditable] .twitter-tweet p,[contenteditable] .instagram-media p{color:${T.textDim};font-size:13px;margin:0;text-align:center}
        `}</style>
      </div>

      {/* Save buttons */}
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={handleSavePost} disabled={blogSaving} style={{ ...btnStyle(T.accent), flex:1, boxShadow:`0 4px 16px ${T.accentGlow}`, opacity:blogSaving ? 0.6 : 1 }}>
          {blogSaving ? "Saving…" : (editingPost ? "Update Post" : "Save Post")}
        </button>
        <button onClick={() => { resetEditor(); setBlogView("list"); }} style={btnStyle("#334155")}>Cancel</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RACE HUBS — forward-only archive of per-race hub pages.
// Each hub gets a page at /race/<slug>. New hubs are appended to the
// FRONT of this list (newest first) as the season goes on. No backfill:
// the archive starts with Kansas (week 30) and grows from here.
// Hub content is a view over existing data: battle tracker picks and
// results (Supabase app_state "battleRaces"), DFS practice/qualifying
// (qualPractice), and the static schedule below. No new data model.
// ─────────────────────────────────────────────────────────────
