import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";

// ── Phase-1 module split: pure logic lives in src/ (see src/*/<module>.js) ──
import { TRACK_KEYS, INITIAL_DRIVERS, FULL_TIMER_NAMES, normalizeCsvDriverName } from "./src/data/drivers.js";
import { processRace } from "./src/models/ratings.js";
import { parseCSVData } from "./src/lib/csv.js";
import { lbAvg, lbGetRank } from "./src/lib/stats.js";
import { parsePaste, findDriver } from "./src/lib/pasteParser.js";
import { scoreEntry } from "./src/models/battle.js";
import { runPureStatsPrediction, runEnhancedPureStatsPrediction, runPowerRankingsPrediction } from "./src/models/predictors.js";

// ── Phase-2 module split: theme, data, and tab components live in src/ ──
import { VBS_LOGO } from "./src/data/logo.js";
import { T } from "./src/theme.js";
import { Ic } from "./src/components/icons.jsx";
import { sb } from "./src/lib/supabase.js";
import { logUsageEvent, tabIdFromPath, raceSlugFromPath, pathForTab, applyTabMeta, trackRacePageView, trackRaceTabView, applyRaceMeta } from "./src/lib/analytics.js";
import { hubBySlug, findBattleForHub, currentHub, RacesTab, RaceHubPage, RaceHeroCard } from "./src/components/RaceHub.jsx";
// Code-split: tabs are lazy-loaded so first paint ships only the Race Hub shell.
// RaceHub.jsx stays eager (it renders the default Race Hub tab and the hero card).
const PowerRankingsTab = lazy(() => import("./src/components/PowerRankingsTab.jsx"));
const PredictorTab = lazy(() => import("./src/components/PredictorTab.jsx"));
const StatsTab = lazy(() => import("./src/components/StatsTab.jsx"));
const BattleTrackerTab = lazy(() => import("./src/components/BattleTrackerTab.jsx"));
const ScorecardTab = lazy(() => import("./src/components/ScorecardTab.jsx"));
const TrackStatsTab = lazy(() => import("./src/components/TrackTabs.jsx"));
const DriverAnalyticsTab = lazy(() => import("./src/components/DriverAnalyticsTab.jsx"));
const DFSTab = lazy(() => import("./src/components/DFSTab.jsx"));
const BlogTab = lazy(() => import("./src/components/BlogTab.jsx"));
const GlobalAdminPanel = lazy(() => import("./src/components/AdminPanel.jsx"));
import { WelcomeModal } from "./src/components/ui.jsx";

const TabLoading = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:"60px 24px", color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", fontSize:12 }}>
    <Ic.Spinner /> Loading tab…
  </div>
);

// ─────────────────────────────────────────────────────────────
// THEME — Steel Blue
// ─────────────────────────────────────────────────────────────




const CSV_URL = "https://raw.githubusercontent.com/VanboniSports/nascar-hub/refs/heads/main/nascar_scraped_data.csv";


// ─────────────────────────────────────────────────────────────
// SCHEDULE
// ─────────────────────────────────────────────────────────────
const TABS = [
  { id:"race",      label:"Race Hub",       icon:"Car"     },
  { id:"power",     label:"Power Rankings", icon:"Trophy"  },
  { id:"predictor", label:"Race Predictor", icon:"Flag"    },
  { id:"tracker",   label:"Battle Tracker", icon:"Chart"   },
  { id:"scorecard", label:"Scorecard",      icon:"Trophy"  },
  { id:"races",     label:"Races",          icon:"Flag"    },
  { id:"tracks",    label:"Track Stats",    icon:"Flag"    },
  { id:"analytics", label:"Driver Analytics",icon:"Trend"  },
  { id:"season",    label:"Season Stats",   icon:"Chart"   },
  { id:"dfs",       label:"DFS Optimizer",  icon:"Trophy"  },
  { id:"blog",      label:"Blog",           icon:"Edit"    },
];





























function trackHubTabView(tabId) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const label = TABS.find(t => t.id === tabId)?.label || tabId;
  const page_path = pathForTab(tabId);
  window.gtag("event", "page_view", {
    page_title: "Vanboni Sports - " + label,
    page_location: window.location.origin + page_path,
    page_path: page_path,
  });
}
// GA4 custom event helper for useful actions (predictor runs, DFS actions, shares).

export default function NASCARHub() {
  const [activeTab, setActiveTab] = useState(() => tabIdFromPath());
  const [raceSlug, setRaceSlug] = useState(() => raceSlugFromPath());
  // Apply the title/meta and track the initial view on first load
  useEffect(() => {
    if (tabIdFromPath() === "race") {
      const slug = raceSlugFromPath();
      // No slug (i.e. plain /) means the Race Hub tab: show the current week's hub.
      const hub = slug ? hubBySlug(slug) : currentHub();
      applyRaceMeta(hub);
      if (slug) trackRacePageView(slug, hub && hub.name);
      else trackRaceTabView(hub);
    } else {
      applyTabMeta(activeTab);
      trackHubTabView(activeTab);
    }
  }, []);
  // Keep the view in sync with the browser back/forward buttons
  useEffect(() => {
    const onPopState = () => {
      if (tabIdFromPath() === "race") {
        const slug = raceSlugFromPath();
        setRaceSlug(slug);
        setActiveTab("race");
        // No slug (i.e. plain /) means the Race Hub tab: show the current week's hub.
        const hub = slug ? hubBySlug(slug) : currentHub();
        applyRaceMeta(hub);
        if (slug) trackRacePageView(slug, hub && hub.name);
        else trackRaceTabView(hub);
      } else {
        const tabId = tabIdFromPath();
        setActiveTab(tabId);
        applyTabMeta(tabId);
        trackHubTabView(tabId);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  // Tab clicks update state, URL, page meta and analytics together
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "race") {
      // The Race Hub tab lives at / and always shows the current week's hub.
      setRaceSlug(null);
      const hub = currentHub();
      if (window.location.pathname !== "/") window.history.pushState({ tab: tabId }, "", "/");
      applyRaceMeta(hub);
      trackRaceTabView(hub);
      try { window.scrollTo(0, 0); } catch (e) {}
      return;
    }
    const path = pathForTab(tabId);
    if (window.location.pathname !== path) window.history.pushState({ tab: tabId }, "", path);
    applyTabMeta(tabId);
    trackHubTabView(tabId);
  };
  // Open a race hub page at /race/<slug>
  const openRacePage = (slug) => {
    const path = "/race/" + slug;
    setRaceSlug(slug);
    setActiveTab("race");
    if (window.location.pathname !== path) window.history.pushState({ race: slug }, "", path);
    const hub = hubBySlug(slug);
    applyRaceMeta(hub);
    trackRacePageView(slug, hub && hub.name);
    try { window.scrollTo(0, 0); } catch (e) {}
  };
  const [drivers,         setDrivers]         = useState(JSON.parse(JSON.stringify(INITIAL_DRIVERS)));
  const [prevRanks,       setPrevRanks]       = useState({});
  const [recentFinishes,  setRecentFinishes]  = useState({});
  const [raceHistory,     setRaceHistory]     = useState([]);
  const [ratingHistory,   setRatingHistory]   = useState([]);
  const [seasonStats,     setSeasonStats]     = useState({});
  const [raceArchive,     setRaceArchive]     = useState([]);
  const [undoStack,       setUndoStack]       = useState([]);
  const [sbStatus,        setSbStatus]        = useState("idle");
  const [saving,          setSaving]          = useState(false);

  // Battle Tracker state — persisted via window.storage
  const [battleRaces, setBattleRaces] = useState([]);

  // CSV Data state — shared across Track Stats tools
  const [csvData, setCsvData] = useState([]);
  const [csvLoading, setCsvLoading] = useState(true);
  const [csvError, setCsvError] = useState(null);

  // Season Points — manually entered NASCAR official points, keyed by "driverName__year"
  const [seasonPoints, setSeasonPoints] = useState({});

  // DFS Optimizer state — persisted via Supabase
  const [dfsSalaries, setDfsSalaries] = useState({});
  const [dfsDisabled, setDfsDisabled] = useState([]);
  const [qualPractice, setQualPractice] = useState(null);

  // Blog state — persisted via Supabase
  const [blogPosts, setBlogPosts] = useState([]);

  // Tool Usage — per-tool counters, persisted via Supabase
  const [toolUsage, setToolUsage] = useState({});
  const toolUsageRef = useRef({});
  const toolUsageLoaded = useRef(false);
  const toolUsageQueue = useRef([]);

  // Welcome Modal — show on first visit unless dismissed
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return !localStorage.getItem("nascar_hub_welcome_dismissed"); } catch { return true; }
  });

  // Load CSV from GitHub + Battle Tracker data (battle races now loaded via Supabase below)
  useEffect(() => {
    // Auto-fetch CSV from GitHub, fall back to localStorage cache
    setCsvLoading(true);
    setCsvError(null);
    fetch(CSV_URL)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(text => {
        const parsed = parseCSVData(text);
        if (parsed.length > 0) {
          setCsvData(parsed);
          try { localStorage.setItem("nascar_csv_data", JSON.stringify(parsed)); } catch {}
        } else {
          throw new Error("CSV parsed but produced 0 records");
        }
        setCsvLoading(false);
      })
      .catch(err => {
        console.warn("CSV auto-fetch failed, trying localStorage cache:", err);
        setCsvError(`Auto-load failed: ${err.message}. Use Admin Panel to upload CSV manually or refresh to retry.`);
        // Fall back to localStorage cache
        try {
          const csvRaw = localStorage.getItem("nascar_csv_data");
          if (csvRaw) {
            const cached = JSON.parse(csvRaw);
            const renormed = cached.map(r => {
              const fixed = normalizeCsvDriverName(r[0] || "");
              return fixed !== r[0] ? [fixed, ...r.slice(1)] : r;
            });
            setCsvData(renormed);
            setCsvError(null); // Clear error since cache worked
          }
        } catch {}
        setCsvLoading(false);
      });

  }, []);

  const saveCsvData = useCallback(async (parsed) => {
    setCsvData(parsed);
    try { localStorage.setItem("nascar_csv_data", JSON.stringify(parsed)); } catch {}
  }, []);

  const refreshCsv = useCallback(() => {
    setCsvLoading(true);
    setCsvError(null);
    fetch(CSV_URL)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(text => {
        const parsed = parseCSVData(text);
        if (parsed.length > 0) {
          setCsvData(parsed);
          try { localStorage.setItem("nascar_csv_data", JSON.stringify(parsed)); } catch {}
        } else {
          throw new Error("CSV parsed but produced 0 records");
        }
        setCsvLoading(false);
      })
      .catch(err => {
        setCsvError(`Refresh failed: ${err.message}`);
        setCsvLoading(false);
      });
  }, []);

  const saveBattleRaces = useCallback(async (updated) => {
    setBattleRaces(updated);
    try {
      await sb.from("app_state").upsert({ key:"battleRaces", value:updated }, { onConflict:"key" });
    } catch (e) { console.error("Battle races save error:", e); }
  }, []);

  const saveSeasonPoints = useCallback(async (updated) => {
    setSeasonPoints(updated);
    try {
      await sb.from("app_state").upsert({ key:"seasonPoints", value:updated }, { onConflict:"key" });
    } catch (e) { console.error("Season points save error:", e); }
  }, []);

  const saveDfsSalaries = useCallback(async (updated) => {
    setDfsSalaries(updated);
    try {
      await sb.from("app_state").upsert({ key:"dfsSalaries", value:updated }, { onConflict:"key" });
    } catch (e) { console.error("DFS salary save:", e); }
  }, []);

  const saveDfsDisabled = useCallback(async (updated) => {
    setDfsDisabled(updated);
    try {
      await sb.from("app_state").upsert({ key:"dfsDisabled", value:updated }, { onConflict:"key" });
    } catch (e) { console.error("DFS disabled save:", e); }
  }, []);

  const saveQualPractice = useCallback(async (updated) => {
    setQualPractice(updated);
    try {
      await sb.from("app_state").upsert({ key:"dfsQualifying", value:updated }, { onConflict:"key" });
    } catch (e) { console.error("DFS qualifying save:", e); }
  }, []);

  const saveBlogPosts = useCallback(async (updated) => {
    setBlogPosts(updated);
    try {
      await sb.from("app_state").upsert({ key:"blogPosts", value:updated }, { onConflict:"key" });
    } catch (e) { console.error("Blog posts save:", e); }
  }, []);

  // Increment a tool usage counter — queues if Supabase hasn't loaded yet
  // Uses read-merge-write so concurrent visitors don't overwrite each other's counts
  const toolUsageSaveTimer = useRef(null);
  const toolUsagePending = useRef({}); // pending increments not yet saved to Supabase

  const flushToolUsage = useCallback((base, keys) => {
    // Update local state immediately for responsive UI
    let merged = { ...base };
    for (const k of keys) merged[k] = (merged[k] || 0) + 1;
    toolUsageRef.current = merged;
    setToolUsage(merged);
    // Track pending increments (keys that haven't been saved to Supabase yet)
    for (const k of keys) toolUsagePending.current[k] = (toolUsagePending.current[k] || 0) + 1;
    // Debounce save — read latest from Supabase, merge our pending increments, write back
    if (toolUsageSaveTimer.current) clearTimeout(toolUsageSaveTimer.current);
    toolUsageSaveTimer.current = setTimeout(async () => {
      const pending = { ...toolUsagePending.current };
      toolUsagePending.current = {};
      try {
        // Read latest from Supabase (another visitor may have incremented)
        const { data: rows, error: readErr } = await sb.from("app_state").select("*").eq("key","toolUsage");
        // SAFETY: if the read fails or returns nothing, fall back to our best
        // local state so we never overwrite remote data with an empty object
        if (readErr) throw readErr;
        const remote = (rows && rows.length > 0 && rows[0].value && typeof rows[0].value === "object")
          ? rows[0].value
          : toolUsageRef.current;  // fall back to local instead of {}
        // Merge: take the MAX of remote vs local for each key (prevents data loss),
        // then add pending increments on top
        const safeBase = {};
        const allKeys = new Set([...Object.keys(remote), ...Object.keys(toolUsageRef.current)]);
        for (const k of allKeys) safeBase[k] = Math.max(remote[k] || 0, toolUsageRef.current[k] || 0);
        const final = { ...safeBase };
        for (const [k, inc] of Object.entries(pending)) {
          final[k] = (final[k] || 0) + inc;
        }
        // Write merged result back
        await sb.from("app_state").upsert({ key:"toolUsage", value:final }, { onConflict:"key" });
        // Update local state to match what we just wrote
        toolUsageRef.current = final;
        setToolUsage(final);
      } catch (e) {
        // On error, put pending increments back so they retry next flush
        for (const [k, inc] of Object.entries(pending)) {
          toolUsagePending.current[k] = (toolUsagePending.current[k] || 0) + inc;
        }
        console.error("Tool usage save error:", e);
      }
    }, 2000);
  }, []);

  const incrementTool = useCallback((toolKey, metadata) => {
    // Always log the timestamped event (even if cumulative counter is still loading)
    logUsageEvent(toolKey, metadata);
    if (!toolUsageLoaded.current) {
      // Supabase data not yet loaded — queue this increment
      toolUsageQueue.current.push(toolKey);
      return;
    }
    flushToolUsage(toolUsageRef.current, [toolKey]);
  }, [flushToolUsage]);

  // Load from Supabase on mount
  useEffect(() => {
    if (!sb) return;
    setSbStatus("loading");
    loadFromSupabase().then(data => {
      if (!data) { setSbStatus("error"); return; }
      const { drvRows, logRows, statRows, histRows, prRows, rfRows, raRows, spRows, btRows, dsRows, ddRows, qpRows, bpRows } = data;
      if (drvRows?.length > 0) setDrivers(drvRows.filter(r=>r.name!=="Kyle Busch").map(r=>({num:r.num,name:r.name,team:r.team,mfg:r.mfg,overall:r.overall,superspeedway:r.superspeedway,intermediate:r.intermediate,short:r.short,road:r.road,rookie:r.rookie||false})));
      if (logRows?.length > 0) setRaceHistory(logRows.map(r=>({race:r.race_name,trackType:r.track_type,date:r.race_date,topFinishers:r.top_finishers})));
      if (statRows?.length > 0) { const ss={}; statRows.forEach(r=>{ss[r.num]={races:r.races,totalFin:r.total_fin,totalSt:r.total_st,wins:r.wins,t5:r.t5,t10:r.t10,led:r.led,best:r.best,dnf:r.dnf};}); setSeasonStats(ss); }
      if (histRows?.length > 0) setRatingHistory(histRows.map(r=>r.snapshot));
      if (prRows?.[0]) setPrevRanks(prRows[0].value||{});
      if (rfRows?.[0]) setRecentFinishes(rfRows[0].value||{});
      if (raRows?.[0]) setRaceArchive(raRows[0].value||[]);
      if (spRows?.[0]) setSeasonPoints(spRows[0].value||{});
      if (btRows?.[0]) setBattleRaces(btRows[0].value||[]);
      if (dsRows?.[0]) setDfsSalaries(dsRows[0].value||{});
      if (ddRows?.[0]) setDfsDisabled(ddRows[0].value||[]);
      if (qpRows?.[0]) setQualPractice(qpRows[0].value||null);
      if (bpRows?.[0]) setBlogPosts(bpRows[0].value||[]);
      setSbStatus("live");
    });
    // Load tool usage separately (it's also in app_state)
    sb.from("app_state").select("*").eq("key","toolUsage").then(({ data: tuRows }) => {
      const loaded = tuRows?.[0]?.value || {};
      toolUsageRef.current = loaded;
      toolUsageLoaded.current = true;
      // Flush any increments that were queued before load completed
      const queued = toolUsageQueue.current;
      toolUsageQueue.current = [];
      if (queued.length > 0) {
        flushToolUsage(loaded, queued);
      } else {
        setToolUsage(loaded);
      }
    }).catch(() => {
      // Even on error, mark as loaded so increments aren't lost forever
      // But do NOT flush with an empty base — that could overwrite remote data
      toolUsageLoaded.current = true;
      const queued = toolUsageQueue.current;
      toolUsageQueue.current = [];
      // Queue will be picked up by next incrementTool call which uses toolUsageRef.current as base
      if (queued.length > 0) flushToolUsage(toolUsageRef.current, queued);
    });
  }, []);

  const doSave = useCallback((d,rh,ss,rth,pr,rf,ra) => {
    setSaving(true);
    saveToSupabase(d,rh,ss,rth,pr,rf,ra).finally(()=>setSaving(false));
  }, []);

  const handleRaceApplied = useCallback(({ raceName, trackType, totalLaps, results }) => {
    setUndoStack(prev => [...prev, { drivers, prevRanks, recentFinishes, raceHistory, ratingHistory, seasonStats, raceArchive }]);

    const { drivers:newDrivers, prevRanks:newPR, recentFinishes:newRF, preSnap, postSnap, topFinishers, seasonStatsOut } = processRace(drivers, raceName, trackType, totalLaps, results, prevRanks, recentFinishes);

    const newSeasonStats = { ...seasonStats };
    Object.entries(seasonStatsOut).forEach(([num, r]) => {
      if (!newSeasonStats[num]) newSeasonStats[num] = { races:0, totalFin:0, totalSt:0, wins:0, t5:0, t10:0, led:0, best:40, dnf:0 };
      const ss = newSeasonStats[num];
      ss.races++; ss.totalFin+=r.fin; ss.totalSt+=r.st; ss.led+=r.led;
      if (r.fin===1) ss.wins++;
      if (r.fin<=5) ss.t5++;
      if (r.fin<=10) ss.t10++;
      if (r.fin<ss.best) ss.best=r.fin;
      if (r.fin>=36) ss.dnf++;
    });

    const newRaceHistory = [{ race:raceName, trackType, date:new Date().toLocaleDateString(), topFinishers }, ...raceHistory];
    const newRatingHistory = [...ratingHistory, preSnap, postSnap];
    const newRaceArchive = [...raceArchive, { raceName, trackType, totalLaps, date:new Date().toLocaleDateString(), results }];

    setDrivers(newDrivers);
    setPrevRanks(newPR);
    setRecentFinishes(newRF);
    setRaceHistory(newRaceHistory);
    setRatingHistory(newRatingHistory);
    setSeasonStats(newSeasonStats);
    setRaceArchive(newRaceArchive);
    doSave(newDrivers, newRaceHistory, newSeasonStats, newRatingHistory, newPR, newRF, newRaceArchive);
  }, [drivers, prevRanks, recentFinishes, raceHistory, ratingHistory, seasonStats, raceArchive, doSave]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const snap = undoStack[undoStack.length-1];
    setUndoStack(prev => prev.slice(0,-1));
    setDrivers(snap.drivers);
    setPrevRanks(snap.prevRanks);
    setRecentFinishes(snap.recentFinishes);
    setRaceHistory(snap.raceHistory);
    setRatingHistory(snap.ratingHistory);
    setSeasonStats(snap.seasonStats);
    setRaceArchive(snap.raceArchive);
    doSave(snap.drivers, snap.raceHistory, snap.seasonStats, snap.ratingHistory, snap.prevRanks, snap.recentFinishes, snap.raceArchive);
  }, [undoStack, doSave]);

  const handleReset = useCallback(() => {
    if (!window.confirm(`Reset all ratings to defaults?\nRace archive (${raceArchive.length} race${raceArchive.length!==1?"s":""}) will be preserved.`)) return;
    const d=JSON.parse(JSON.stringify(INITIAL_DRIVERS));
    setDrivers(d); setPrevRanks({}); setRecentFinishes({});
    setRaceHistory([]); setRatingHistory([]); setSeasonStats({});
    setUndoStack([]);
    doSave(d,[],{},[],[],{},raceArchive);
  }, [raceArchive, doSave]);

  const handleReplay = useCallback(() => {
    if (raceArchive.length === 0) { window.alert("No archived races to replay."); return; }
    if (!window.confirm(`Replay ${raceArchive.length} race(s) from scratch?`)) return;
    let d=JSON.parse(JSON.stringify(INITIAL_DRIVERS)), pr={}, rf={}, rh=[], rth=[], ss={}, ra=JSON.parse(JSON.stringify(raceArchive));
    ra.forEach(race => {
      const out = processRace(d, race.raceName, race.trackType, race.totalLaps, race.results, pr, rf);
      d=out.drivers; pr=out.prevRanks; rf=out.recentFinishes;
      rth=[...rth, out.preSnap, out.postSnap];
      rh=[{race:race.raceName,trackType:race.trackType,date:race.date,topFinishers:out.topFinishers},...rh];
      Object.entries(out.seasonStatsOut).forEach(([num,r])=>{
        if(!ss[num]) ss[num]={races:0,totalFin:0,totalSt:0,wins:0,t5:0,t10:0,led:0,best:40,dnf:0};
        const s=ss[num]; s.races++; s.totalFin+=r.fin; s.totalSt+=r.st; s.led+=r.led;
        if(r.fin===1) s.wins++; if(r.fin<=5) s.t5++; if(r.fin<=10) s.t10++;
        if(r.fin<s.best) s.best=r.fin; if(r.fin>=36) s.dnf++;
      });
    });
    setDrivers(d); setPrevRanks(pr); setRecentFinishes(rf);
    setRaceHistory(rh); setRatingHistory(rth); setSeasonStats(ss); setUndoStack([]);
    doSave(d,rh,ss,rth,pr,rf,ra);
  }, [raceArchive, doSave]);

  const sbColor = { idle:T.textDim, loading:T.gold, live:T.green, error:T.red }[sbStatus];
  const sbLabel = { idle:"Local only", loading:"Connecting…", live:"Supabase Live", error:"DB Error" }[sbStatus];

  return (
    <>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes hubBlink{0%,100%{opacity:1}50%{opacity:0.25}}
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:${T.bg}}
        ::-webkit-scrollbar-thumb{background:${T.scrollThumb};border-radius:3px}
        select,input,textarea{color-scheme:dark}
        textarea{color-scheme:dark}
        .nascar-sidebar{display:flex}
        .nascar-mobile-banner{display:none}
        @media(min-width:1800px){.nascar-main{zoom:1.15}}
        @media(min-width:2400px){.nascar-main{zoom:1.3}}
        @media(max-width:768px){
          .nascar-sidebar{display:none!important}
          .nascar-mobile-banner{display:block}
        }
      `}</style>

      {/* WELCOME MODAL */}
      {showWelcome && <WelcomeModal onDismiss={() => setShowWelcome(false)} />}

      <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"'Barlow',sans-serif", color:T.text, display:"flex", flexDirection:"column" }}>

        {/* HEADER */}
        <header style={{ background:T.headerBg, borderBottom:`1px solid ${T.border}`, padding:"12px 24px 0", position:"sticky", top:0, zIndex:100 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14, paddingBottom:10 }}>
            <div style={{ width:32, height:32, background:"linear-gradient(135deg,#1e90ff,#0066cc)", clipPath:"polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}><Ic.Car /></div>
            <div>
              <div style={{ fontSize:20, fontWeight:900, lineHeight:1, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:3, textTransform:"uppercase" }}>NASCAR <span style={{ color:T.accent }}>HUB</span></div>
              <div style={{ fontSize:8, color:T.textDim, letterSpacing:3, textTransform:"uppercase", fontFamily:"'IBM Plex Mono',monospace" }}>2026 ANALYTICS SYSTEM</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:4, paddingLeft:14, borderLeft:`1px solid ${T.border}` }}>
              <span style={{ fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1.5, textTransform:"uppercase", whiteSpace:"nowrap" }}>by</span>
              <img src={VBS_LOGO} alt="Vanboni Sports" style={{ height:28, opacity:0.9 }} />
            </div>
            <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
              {(() => { const total = Object.values(toolUsage).reduce((a,b)=>a+b,0); return total > 0 ? (
                <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:6, background:T.accentSoft, border:`1px solid ${T.accent}30` }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>
                  <span style={{ fontSize:11, fontWeight:700, color:T.accent, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5 }}>{total.toLocaleString()}</span>
                  <span style={{ fontSize:9, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1, textTransform:"uppercase" }}>tools used</span>
                </div>
              ) : null; })()}
              {saving && <span style={{ fontSize:10, color:T.textDim, display:"flex", alignItems:"center", gap:5 }}><Ic.Spinner />Saving…</span>}
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1 }}>
                <span style={{ color:sbColor, fontSize:8 }}>●</span>
                <span style={{ color:sbColor }}>{sbLabel}</span>
              </div>
            </div>
          </div>
          <nav style={{ display:"flex", overflowX:"auto", msOverflowStyle:"none", scrollbarWidth:"none" }}>
            {TABS.map(tab => {
              const active = tab.id === activeTab;
              return (
                <button key={tab.id} onClick={()=>handleTabChange(tab.id)} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", fontSize:11, fontWeight:active?700:500, background:active?T.accentSoft:"transparent", color:active?T.accent:T.textDim, border:"none", borderBottom:`2px solid ${active?T.accent:"transparent"}`, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" }}>
                  <span style={{ opacity:active?1:0.5 }}>{Ic[tab.icon]?.()}</span>
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </header>

        {/* CSV AUTO-LOAD STATUS */}
        {csvLoading && (
          <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"10px 24px", display:"flex", alignItems:"center", gap:10, fontSize:12, color:T.gold, fontFamily:"'IBM Plex Mono',monospace" }}>
            <Ic.Spinner /> Loading race data from GitHub…
          </div>
        )}
        {csvError && !csvLoading && csvData.length === 0 && (
          <div style={{ background:T.redBg, borderBottom:`1px solid ${T.red}`, padding:"10px 24px", fontSize:12, color:T.red, fontFamily:"'IBM Plex Mono',monospace" }}>
            ⚠ {csvError}
          </div>
        )}

        {/* MOBILE HERO CARD — sits on top (replaces the old next-race banner); hidden on the Race Hub tab itself */}
        {activeTab !== "race" && (
        <div className="nascar-mobile-banner">
          <RaceHeroCard hub={currentHub()} battleRace={findBattleForHub(battleRaces, currentHub())} qualPractice={qualPractice} onOpen={openRacePage} collapsible />
        </div>
        )}

        {/* CONTENT + SIDEBAR */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          <main className="nascar-main" style={{ flex:"1 1 1000px", minWidth:0, overflow:"auto", padding:"24px 28px", width:"100%" }}>
            <Suspense fallback={<TabLoading />}>
            <div key={activeTab} style={{ animation:"fadeIn 0.2s ease" }}>
              {activeTab === "power"     && <PowerRankingsTab drivers={drivers} prevRanks={prevRanks} ratingHistory={ratingHistory} incrementTool={incrementTool} />}
              {activeTab === "predictor" && <PredictorTab drivers={drivers} csvData={csvData} incrementTool={incrementTool} />}
              {activeTab === "tracker"   && <BattleTrackerTab battleRaces={battleRaces} incrementTool={incrementTool} />}
              {activeTab === "scorecard" && <ScorecardTab battleRaces={battleRaces} incrementTool={incrementTool} />}
              {activeTab === "races"     && <RacesTab battleRaces={battleRaces} onOpenRace={openRacePage} />}
              {activeTab === "race"      && <RaceHubPage hub={raceSlug ? hubBySlug(raceSlug) : currentHub()} battleRace={findBattleForHub(battleRaces, raceSlug ? hubBySlug(raceSlug) : currentHub())} qualPractice={qualPractice} onOpenRace={openRacePage} onOpenTab={handleTabChange} />}
              {activeTab === "tracks"    && <TrackStatsTab csvData={csvData} incrementTool={incrementTool} />}
              {activeTab === "analytics" && <DriverAnalyticsTab csvData={csvData} incrementTool={incrementTool} />}
              {activeTab === "season"    && <StatsTab drivers={drivers} seasonStats={seasonStats} raceHistory={raceHistory} csvData={csvData} seasonPoints={seasonPoints} incrementTool={incrementTool} />}
              {activeTab === "dfs"       && <DFSTab csvData={csvData} dfsSalaries={dfsSalaries} dfsDisabled={dfsDisabled} qualPractice={qualPractice} incrementTool={incrementTool} />}
              {activeTab === "blog"      && <BlogTab blogPosts={blogPosts} incrementTool={incrementTool} />}
            </div>
            </Suspense>
          </main>

          {/* DESKTOP SIDEBAR — hero card sits to the side; hidden on the Race Hub tab itself */}
          {activeTab !== "race" && (
          <div className="nascar-sidebar" style={{ flex: "0 1 320px", minWidth: 280, maxWidth: 320 }}>
            <RaceHeroCard hub={currentHub()} battleRace={findBattleForHub(battleRaces, currentHub())} qualPractice={qualPractice} onOpen={openRacePage} defaultOpen />
          </div>
          )}
        </div>

        {/* GLOBAL ADMIN */}
        <Suspense fallback={null}>
        <GlobalAdminPanel
          drivers={drivers}
          onRaceApplied={handleRaceApplied}
          raceHistory={raceHistory}
          raceArchive={raceArchive}
          onUndo={handleUndo}
          onReset={handleReset}
          onReplay={handleReplay}
          canUndo={undoStack.length>0}
          battleRaces={battleRaces}
          onBattleSave={saveBattleRaces}
          csvData={csvData}
          csvLoading={csvLoading}
          csvError={csvError}
          onCsvUpload={saveCsvData}
          onCsvRefresh={refreshCsv}
          seasonPoints={seasonPoints}
          onSeasonPointsSave={saveSeasonPoints}
          toolUsage={toolUsage}
          dfsSalaries={dfsSalaries}
          onDfsSalariesSave={saveDfsSalaries}
          dfsDisabled={dfsDisabled}
          onDfsDisabledSave={saveDfsDisabled}
          qualPractice={qualPractice}
          onQualPracticeSave={saveQualPractice}
          blogPosts={blogPosts}
          onBlogSave={saveBlogPosts}
        />
        </Suspense>

        {/* FOOTER */}
        <footer style={{ borderTop:`1px solid ${T.border}`, padding:"7px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:10, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", background:T.footerBg }}>
          <span>NASCAR HUB v2.6 · Vanboni Sports</span>
          <span>{raceArchive.length} race{raceArchive.length!==1?"s":""} archived · {battleRaces.length} battle race{battleRaces.length!==1?"s":""} · {(blogPosts||[]).filter(p=>p.status==="published").length} blog post{(blogPosts||[]).filter(p=>p.status==="published").length!==1?"s":""} · {csvLoading ? "loading CSV…" : csvData.length > 0 ? `${csvData.length} CSV records` : "no CSV"} · {Object.keys(dfsSalaries?.dk||{}).length + Object.keys(dfsSalaries?.fd||{}).length > 0 ? `${Object.keys(dfsSalaries?.dk||{}).length}DK/${Object.keys(dfsSalaries?.fd||{}).length}FD salaries` : "no DFS salaries"} · {drivers.length} drivers</span>
          <span style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span>2026 Cup Series</span>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSclS_CfKMfb8MuCkeW1uLH6RSImBJTXSlF4FqfFjvjqPHn9uQ/viewform?usp=publish-editor"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:"inline-flex", alignItems:"center", gap:4,
                padding:"3px 9px", borderRadius:4,
                border:`1px solid ${T.border2}`,
                background:"rgba(30,144,255,0.07)",
                color:T.accentText, fontFamily:"'Barlow Condensed',sans-serif",
                fontSize:11, fontWeight:600, letterSpacing:"0.04em",
                textDecoration:"none", cursor:"pointer",
                transition:"background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e=>{ e.currentTarget.style.background="rgba(30,144,255,0.16)"; e.currentTarget.style.borderColor=T.accent; }}
              onMouseLeave={e=>{ e.currentTarget.style.background="rgba(30,144,255,0.07)"; e.currentTarget.style.borderColor=T.border2; }}
            >
              📝 Submit Feedback
            </a>
          </span>
        </footer>
      </div>
    </>
  );
}
