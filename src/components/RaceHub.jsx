// Race-hub pages (/race/<slug>) + hub helpers. Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useEffect, useRef } from "react";
import { T, TC, TL } from "../theme.js";
import { sb } from "../lib/supabase.js";
import { PREDICTORS, PREDICTOR_COLORS } from "../data/siteMeta.js";
import { HubStatusBadge, sectionTitle } from "./ui.jsx";
import { MobileSection, MobileJumpNav, BackToTop } from "./MobileNav.jsx";
import { Ic } from "./icons.jsx";
import { getThisWeeksRace } from "../data/schedule.js";
import { scoreEntry } from "../models/battle.js";

export const RACE_HUBS = [
  { slug:"kansas-2026", name:"Kansas II", officialName:"Hollywood Casino 400", track:"Kansas Speedway", date:"2026-09-27", dateLabel:"Sun Sep 27", trackType:"intermediate", length:1.5, laps:267, week:30,
    nascarRaceId:5628,
    intro:[
      "Kansas Speedway is a 1.5-mile tri-oval outside Kansas City, and it has quietly become one of the best pure racing tracks in the Cup Series. The progressive banking gives drivers three or four usable grooves, so restarts get chaotic in the best way and track position is never quite safe. Long green-flag runs are the norm here, which means tire management decides about as many races as raw speed does.",
      "Here is how this page works. Every week four pick sources submit a top 10: Pure Stats (track-type history), Enhanced Pure Stats (which folds in manufacturer trends, momentum, and playoff math), the site's own Power Rankings, and my gut. The Battle Tracker scores all four against the official results, and the season-long tally keeps me honest. Check back through the week as practice, qualifying, and the race itself fill in the blanks.",
    ] },
];
// Predictors shown on race hub pages. The ML model is retired from hubs.


export const HUB_PREDICTORS = ["Pure Stats", "Enhanced Pure Stats", "Power Rankings", "My Gut"];


export function hubBySlug(slug) {
  return RACE_HUBS.find(h => h.slug === slug) || null;
}
// upcoming = race day is in the future, live = race day is today, completed = race day has passed.
// hub.statusOverride ("upcoming" | "live" | "completed") forces a status manually.


export function hubStatus(hub) {
  if (!hub) return "upcoming";
  if (hub.statusOverride) return hub.statusOverride;
  const d = new Date(hub.date + "T12:00:00");
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (day === today) return "live";
  return day > today ? "upcoming" : "completed";
}


export function hubCountdown(hub) {
  if (!hub) return null;
  const now = new Date();
  const d = new Date(hub.date + "T23:59:59");
  return Math.max(0, Math.ceil((d - now) / 86400000));
}
// Match a battle tracker race entry to a hub. Race-name match comes first:
// tracks that host twice a year (Kansas, Texas, Darlington...) must never
// match the other race at the same track. Falls back to track + closest date.


export function findBattleForHub(battleRaces, hub) {
  if (!hub || !battleRaces || !battleRaces.length) return null;
  const norm = s => (s || "").toLowerCase().trim();
  const byName = battleRaces.find(r => norm(r.raceName) === norm(hub.officialName) || norm(r.raceName) === norm(hub.name));
  if (byName) return byName;
  const byTrack = battleRaces.filter(r => norm(r.track) === norm(hub.track));
  if (!byTrack.length) return null;
  if (hub.date) {
    const t = new Date(hub.date + "T12:00:00").getTime();
    const dist = r => { const d = new Date((r.date || "") + "T12:00:00").getTime(); return isNaN(d) ? Infinity : Math.abs(d - t); };
    byTrack.sort((a, b) => dist(a) - dist(b));
    // Same-track fallback only counts for the same race week: never borrow
    // another race at this track from months away.
    return dist(byTrack[0]) <= 10 * 86400000 ? byTrack[0] : null;
  }
  return byTrack[0] || null;
}
// Match a power-rankings race archive entry to a hub, so the race page can
// show the full official results. Name match first, then closest date.

// NASCAR Cup points for a finishing position: 40 for the win, 35 for 2nd,
// then 34 down to 1 for the rest of the field. 2026 rules add a 15-point
// win bonus and 1 point for the fastest lap of the race.
export function raceFinishPoints(fin) {
  if (fin === 1) return 40 + 15;
  if (fin >= 2 && fin <= 40) return 37 - fin;
  return 0;
}
export function findArchiveForHub(raceArchive, hub) {
  if (!hub || !raceArchive || !raceArchive.length) return null;
  const norm = s => (s || "").toLowerCase().trim();
  const byName = raceArchive.find(a => norm(a.raceName) === norm(hub.officialName) || norm(a.raceName) === norm(hub.name));
  if (byName) return byName;
  if (hub.date) {
    const t = new Date(hub.date + "T12:00:00").getTime();
    const close = raceArchive
      .map(a => ({ a, dist: Math.abs(new Date(a.date).getTime() - t) }))
      .filter(x => !isNaN(x.dist) && x.dist <= 3 * 86400000)
      .sort((x, y) => x.dist - y.dist);
    if (close.length) return close[0].a;
  }
  return null;
}
// Highest-scoring predictor for a race that has actual results.
// `models` limits which predictors are eligible (race hubs exclude the
// retired ML model; the Battle Tracker tab keeps its own list).


export function battleWinnerFor(race, models) {
  if (!race || !race.actualResults || !race.actualResults.length) return null;
  const list = models || PREDICTORS;
  let best = null;
  for (const p of list) {
    const preds = race.predictions && race.predictions[p];
    if (!preds || !preds.length) continue;
    const s = scoreEntry(preds, race.actualResults);
    if (s && (!best || s.points > best.points)) best = { predictor: p, points: s.points };
  }
  return best;
}
// Drivers the predictors disagree on most: biggest rank spread across models.


export function topDisagreements(predictions) {
  const models = Object.keys(predictions || {}).filter(m => predictions[m] && predictions[m].length);
  if (models.length < 2) return [];
  const ranks = {};
  models.forEach(m => predictions[m].forEach((d, i) => { (ranks[d] = ranks[d] || {})[m] = i + 1; }));
  return Object.entries(ranks)
    .filter(([, r]) => Object.keys(r).length >= 2)
    .map(([driver, r]) => {
      const vals = Object.entries(r).sort((a, b) => a[1] - b[1]);
      return { driver, spread: vals[vals.length - 1][1] - vals[0][1], high: vals[0], low: vals[vals.length - 1] };
    })
    .filter(x => x.spread >= 3)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 3);
}
// The hub matching this week's scheduled race (for the homepage hero card).


export function currentHub() {
  const race = getThisWeeksRace();
  return (race && RACE_HUBS.find(h => h.week === race.week)) || RACE_HUBS[0] || null;
}

// ─────────────────────────────────────────────────────────────
// ROUTES + GA4 VIRTUAL PAGEVIEWS
// The Hub is a single-page app, but each tab gets its own real URL
// (e.g. /dfs) so sections are shareable and indexable by search engines.
// Vercel rewrites every path to index.html; on load the tab is picked
// from the URL, and tab clicks update the URL via history.pushState.
// Each tab switch also fires a manual GA4 page_view (gtag's automatic
// pageview is disabled in index.html) so Analytics reports per-section
// traffic under the real page path.
// ─────────────────────────────────────────────────────────────


export function RacesTab({ battleRaces, onOpenRace }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>Race Hubs</div>
        <div style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 4 }}>
          Every race gets one page: model predictions, the battle tracker scoring, DFS notes and official results.
        </div>
      </div>
      {RACE_HUBS.length === 0 ? (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, textAlign: "center", color: T.textDim, fontSize: 13 }}>
          No race hubs yet. The first one drops with Kansas.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {RACE_HUBS.map(hub => {
            const status = hubStatus(hub);
            const battle = findBattleForHub(battleRaces, hub);
            const scored = battle && battle.actualResults && battle.actualResults.length > 0;
            const winner = battleWinnerFor(battle, HUB_PREDICTORS);
            return (
              <button key={hub.slug} onClick={() => onOpenRace(hub.slug)} style={{
                display: "flex", alignItems: "center", gap: 14, textAlign: "left",
                background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
                padding: "14px 18px", cursor: "pointer", width: "100%",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
                    {hub.officialName || hub.name}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", marginTop: 3 }}>
                    {hub.track} · {hub.dateLabel} · {hub.laps} laps
                  </div>
                  {scored && (
                    <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 3 }}>
                      Winner: <span style={{ color: T.gold, fontWeight: 700 }}>{battle.actualResults[0]}</span>
                      {winner && <> · Battle: <span style={{ color: T.accentText, fontWeight: 700 }}>{winner.predictor}</span></>}
                    </div>
                  )}
                </div>
                <HubStatusBadge status={status} />
                <span style={{ color: T.textDim, fontSize: 18 }}>›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// LIVE RUNNING ORDER + TIMELINE — shown on a race hub while that race is actually live.
// Data comes from /api/live-leaderboard, a Vercel serverless proxy for
// NASCAR's official live feed (the CDN sends no CORS headers, so the browser
// cannot fetch it directly). Polls every 35 seconds. Renders nothing when
// the race is not live or the feed is unreachable: no errors, no boxes.
// The timeline is derived client-side by diffing each poll against the previous
// one (passes for position, lead changes, cautions/restarts, pit stops, stage
// ends) and merged with the recorder's back-history, so opening mid-race still
// shows everything captured since the recorder started.

const liveOrdinal = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");

export function LiveRunningOrder({ hub }) {
  const [data, setData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const prevRef = useRef(null);
  const seenRef = useRef(new Set());
  const historyLoadedRef = useRef(false);
  // Backfill the recorder's timeline history. Retries on failure: a single
  // flaky read must not leave the timeline permanently empty. Also called
  // from the poll loop below until it succeeds (self-healing).
  const loadHistory = () => {
    if (!hub || !hub.nascarRaceId || historyLoadedRef.current) return;
    let tries = 0;
    const attempt = () => {
      tries++;
      sb.from("app_state").select("value").eq("key", `livetimeline:${hub.nascarRaceId}`).maybeSingle()
        .then(({ data: row }) => {
          if (row && row.value && Array.isArray(row.value.events)) {
            const evs = row.value.events.filter(e => e && e.text).slice(0, 200);
            evs.forEach(e => seenRef.current.add(`${e.lap}:${e.text}`));
            setTimeline(evs);
            historyLoadedRef.current = true;
          } else if (tries < 4) {
            setTimeout(attempt, 2500 * tries);
          }
        })
        .catch(() => { if (tries < 4) setTimeout(attempt, 2500 * tries); });
    };
    attempt();
  };
  const [nowTs, setNowTs] = useState(() => Date.now());
  // Load the recorder's back-history so the timeline is complete even when
  // the page is opened mid-race. Live-derived events below dedupe against it.
  useEffect(() => {
    if (!hub || !hub.nascarRaceId) return;
    historyLoadedRef.current = false;
    loadHistory();
  }, [hub ? hub.slug : null]);
  useEffect(() => {
    if (!hub || !hub.nascarRaceId) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`https://www.vanbonisports.com/api/live-leaderboard?race_id=${hub.nascarRaceId}`);
        const j = await r.json();
        if (!alive) return;
        if (!(j && j.live)) { setData(null); return; }
        setData(j);
        if (!historyLoadedRef.current) loadHistory();
        const prev = prevRef.current;
        if (prev && prev.order && prev.order.length) {
          const events = [];
          const oldPos = new Map(prev.order.map(o => [o.number, o.pos]));
          const oldPit = new Map(prev.order.map(o => [o.number, o.pitStops || 0]));
          const newPit = new Map(j.order.map(o => [o.number, o.pitStops || 0]));
          const oldLeader = prev.order.find(o => o.pos === 1);
          const newLeader = j.order.find(o => o.pos === 1);
          const leadPair = new Set();
          if (oldLeader && newLeader && oldLeader.number !== newLeader.number) {
            leadPair.add(oldLeader.number); leadPair.add(newLeader.number);
            events.push(`${newLeader.name} takes the lead from ${oldLeader.name}`);
          }
          if (prev.stage != null && j.stage != null && j.stage > prev.stage) {
            events.push(`End of Stage ${prev.stage}: ${newLeader ? newLeader.name : "Unknown"} wins the stage`);
          }
          for (const o of j.order) {
            const op = oldPos.get(o.number);
            if (op == null || o.pos >= op || leadPair.has(o.number)) continue;
            const overtaken = prev.order.filter(c => c.number !== o.number && c.pos >= o.pos && c.pos < op);
            if (overtaken.length && overtaken.every(c => (newPit.get(c.number) || 0) > (c.pitStops || 0))) continue;
            if (op - o.pos === 1) {
              const passed = j.order.find(c => c.number !== o.number && oldPos.get(c.number) === o.pos && c.pos === o.pos + 1);
              events.push(passed ? `${o.name} passes ${passed.name} for ${liveOrdinal(o.pos)}` : `${o.name} moves up to ${liveOrdinal(o.pos)}`);
            } else {
              events.push(`${o.name} gains ${op - o.pos} spots to ${liveOrdinal(o.pos)}`);
            }
          }
          for (const o of j.order) {
            if ((o.pitStops || 0) > (oldPit.get(o.number) || 0)) {
              const op2 = oldPos.get(o.number);
              events.push(`${o.name} pits from ${liveOrdinal(op2 || o.pos)}`);
            }
          }
          if (prev.flag === "GREEN" && j.flag === "CAUTION") events.push("Caution is out");
          else if (prev.flag === "CAUTION" && j.flag === "GREEN") events.push("Back to green");
          else if (prev.flag !== "RED FLAG" && j.flag === "RED FLAG") events.push("Red flag is out");
          if (events.length) {
            const seen = seenRef.current;
            const fresh = [];
            for (const text of events) {
              const k = `${j.lap}:${text}`;
              if (!seen.has(k)) { seen.add(k); fresh.push({ lap: j.lap, text }); }
            }
            if (fresh.length) setTimeline(t => [...fresh.reverse(), ...t].slice(0, 300));
          }
        }
        prevRef.current = { order: j.order, flag: j.flag, stage: j.stage };
      } catch (e) { /* keep last good data; the FEED DELAYED banner covers outages */ }
    };
    load();
    const t = setInterval(load, 35000);
    const tick = setInterval(() => { if (alive) setNowTs(Date.now()); }, 30000);
    return () => { alive = false; clearInterval(t); clearInterval(tick); };
  }, [hub ? hub.slug : null]);
  if (!data) return null;
  const flagColors = { GREEN: T.green, CAUTION: "#f59e0b", "RED FLAG": T.red, CHECKERED: T.textDim };
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.red}55`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.red, animation: "hubBlink 1.2s infinite" }} />
        <span style={{ fontSize: 12, fontWeight: 900, color: T.red, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2 }}>LIVE</span>
        <span style={{ fontSize: 11, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace" }}>
          Lap {data.lap} of {data.lapsTotal}
        </span>
        {data.flag && (
          <span style={{ fontSize: 10, fontWeight: 800, color: flagColors[data.flag] || T.textMid, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1 }}>{data.flag}</span>
        )}
        {data.stage != null && (
          <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>Stage {data.stage}</span>
        )}
        {data.updatedAt && (nowTs - Date.parse(data.updatedAt) > 180000) && (
          <span style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1 }}>FEED DELAYED</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>refreshes every 35s</span>
      </div>
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {data.order.map(o => (
          <div key={o.pos} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ width: 22, fontSize: 11, fontWeight: 800, color: o.pos <= 3 ? T.gold : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{o.pos}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", minWidth: 28 }}>#{o.number}</span>
            <span style={{ fontSize: 12, fontWeight: o.pos === 1 ? 800 : 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</span>
            {!o.running && <span style={{ fontSize: 9, fontWeight: 700, color: T.red, fontFamily: "'IBM Plex Mono',monospace" }}>OUT</span>}
            <span style={{ marginLeft: "auto", fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{o.delta}</span>
          </div>
        ))}
      </div>
      {timeline.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: T.textDim, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, marginBottom: 8 }}>LIVE TIMELINE</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
            {timeline.map((e, i) => (
              <div key={i} style={{ background: T.surface3, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.green }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: T.text, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1 }}>LAP {e.lap}</span>
                </div>
                <div style={{ padding: "8px 10px", fontSize: 12, color: T.textMid }}>{e.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// RACE HUB PAGE — /race/<slug>


export function RaceHubPage({ hub, battleRace, qualPractice, onOpenRace, onOpenTab, raceArchive, drivers }) {
  if (!hub) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>Unknown race hub</div>
        <div style={{ fontSize: 13, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>That race page does not exist yet. The archive starts with Kansas and grows from here.</div>
        <button onClick={() => onOpenTab("races")} style={{ padding: "8px 18px", borderRadius: 6, border: `1px solid ${T.accent}50`, background: T.accentSoft, color: T.accentText, fontSize: 12, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
          Back to Races
        </button>
      </div>
    );
  }

  const status = hubStatus(hub);
  const predictions = (battleRace && battleRace.predictions) || {};
  const MODELS = HUB_PREDICTORS;
  const hasAnyPredictions = MODELS.some(m => predictions[m] && predictions[m].length);
  // Disagreements and the battle winner only consider hub predictors,
  // so the retired ML model can never appear on this page.
  const hubPredictions = Object.fromEntries(Object.entries(predictions).filter(([m]) => MODELS.includes(m)));
  const disagreements = hasAnyPredictions ? topDisagreements(hubPredictions) : [];
  const darkHorse = battleRace && battleRace.darkHorse;
  const suckPick = battleRace && battleRace.suckPick;
  const darkHorseReason = battleRace && battleRace.darkHorseReason;
  const suckPickReason = battleRace && battleRace.suckPickReason;
  const actuals = (battleRace && battleRace.actualResults && battleRace.actualResults.length) ? battleRace.actualResults : null;
  const winner = battleWinnerFor(battleRace, HUB_PREDICTORS);
  // Full official results with points, from the power-rankings race archive.
  // Falls back to the battle top-10 list until the archive has this race.
  const archiveEntry = findArchiveForHub(raceArchive, hub);
  const fullResults = archiveEntry && archiveEntry.results ? archiveEntry.results
    .filter(r => r.fin > 0)
    .map(r => {
      const d = (drivers || []).find(x => String(x.num) === String(r.num));
      return { ...r, name: d ? d.name : `Car #${r.num}`, pts: raceFinishPoints(r.fin) + (r.sp || 0) + (r.fl ? 1 : 0) };
    })
    .sort((a, b) => a.fin - b.fin) : null;
  const typeColor = TC[hub.trackType] || T.accent;

  const qpMatch = qualPractice && qualPractice.week === hub.week;
  const pracCount = qpMatch && qualPractice.practice ? Object.keys(qualPractice.practice).length : 0;
  const qualCount = qpMatch && qualPractice.qualifying ? Object.keys(qualPractice.qualifying).length : 0;
  const pracCanceled = qpMatch && !!qualPractice.practiceCanceled;
  const qualCanceled = qpMatch && !!qualPractice.qualifyingCanceled;
  const practiceList = (qpMatch && qualPractice.practice)
    ? Object.entries(qualPractice.practice)
        .map(([name, v]) => ({ name, pos: typeof v === "number" ? v : (v.speedRank || 9999), overall: (v && typeof v === "object") ? v.overall : null }))
        .sort((a, b) => a.pos - b.pos)
    : [];
  const qualList = (qpMatch && qualPractice.qualifying)
    ? Object.entries(qualPractice.qualifying).map(([name, pos]) => ({ name, pos })).sort((a, b) => a.pos - b.pos)
    : [];
  const resultTabs = [
    { id: "practice", label: "Practice" },
    { id: "qualifying", label: "Qualifying" },
    ...(status === "live" ? [{ id: "live", label: "Live" }] : []),
    ...(actuals ? [{ id: "race", label: "Race Results" }] : []),
  ];
  const [resultsTab, setResultsTab] = useState(
    status === "live" ? "live" : actuals ? "race" : qualCount > 0 ? "qualifying" : "practice"
  );

  const idx = RACE_HUBS.findIndex(h => h.slug === hub.slug);
  const olderHub = idx >= 0 ? RACE_HUBS[idx + 1] : null;
  const newerHub = idx > 0 ? RACE_HUBS[idx - 1] : null;

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" };

  // Mobile jump-nav sections (rendered by MobileJumpNav, mobile only)
  const jumpSections = [
    ...(hub.intro && hub.intro.length > 0 ? [{ id: "preview", label: "Preview" }] : []),
    { id: "predictions", label: "Predictions" },
    { id: "calls", label: "My Calls" },
    { id: "weekend", label: "Weekend" },
    { id: "results", label: "Results" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
      {/* HERO */}
      <div style={{ ...card, background: `linear-gradient(135deg, ${typeColor}14, ${T.surface} 60%)`, borderLeft: `3px solid ${typeColor}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 2, textTransform: "uppercase" }}>Race Hub</span>
          <HubStatusBadge status={status} />
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase", lineHeight: 1.1 }}>
          {hub.officialName || hub.name}
        </div>
        <div style={{ fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", marginTop: 6 }}>
          {hub.name} · {hub.track} · {hub.dateLabel} · {hub.length} mi · {hub.laps} laps · <span style={{ color: typeColor }}>{TL[hub.trackType] || hub.trackType}</span>
        </div>
      </div>

      {/* MOBILE SECTION JUMP NAV — renders null on desktop */}
      <MobileJumpNav sections={jumpSections} />

      {/* LIVE RUNNING ORDER — only renders while the race is actually live */}
      {/* LIVE RUNNING ORDER now lives in the Official Results tabs during the race */}

      {/* INTRO — per-race editorial, above the predictions */}
      {hub.intro && hub.intro.length > 0 && (
      <MobileSection id="preview" title="Race Preview">
        <div style={{ ...card }}>
          {hub.intro.map((p, i) => (
            <p key={i} style={{ fontSize: 13, color: T.textMid, lineHeight: 1.75, margin: i > 0 ? "12px 0 0" : 0 }}>{p}</p>
          ))}
        </div>
      </MobileSection>
      )}

      {/* PREDICTIONS */}
      <MobileSection id="predictions" title="Model Predictions">
      <div>
        {sectionTitle("Model Predictions", hasAnyPredictions ? "Top 10 from each predictor, via the Battle Tracker" : null)}
        {!hasAnyPredictions ? (
          <div style={{ ...card, textAlign: "center", color: T.textDim, fontSize: 13, padding: "28px 20px" }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>🔮</div>
            <div>Predictions drop Monday morning.</div>
            <div style={{ fontSize: 11, marginTop: 6, fontFamily: "'IBM Plex Mono',monospace" }}>Check back once the models and my gut have weighed in.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
            {MODELS.map(m => {
              const picks = predictions[m] || [];
              const color = PREDICTOR_COLORS[m] || T.accent;
              return (
                <div key={m} style={{ ...card, padding: "14px 16px", borderTop: `2px solid ${color}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>{m}</span>
                  </div>
                  {picks.length === 0 ? (
                    <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>No picks yet.</div>
                  ) : (
                    picks.slice(0, 10).map((d, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0", borderBottom: i < 9 ? `1px solid ${T.border}` : "none" }}>
                        <span style={{ width: 22, height: 22, borderRadius: "50%", background: i === 0 ? `${color}30` : `${T.border}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: i === 0 ? color : T.textDim, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: i === 0 ? 800 : 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d}</span>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
        {disagreements.length > 0 && (
          <div style={{ ...card, marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.textDim, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Biggest disagreements</div>
            {disagreements.map((x, i) => (
              <div key={i} style={{ fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.7 }}>
                <span style={{ color: T.text, fontWeight: 700 }}>{x.driver}</span>: {x.high[0]} has him P{x.high[1]}, {x.low[0]} has him P{x.low[1]}
              </div>
            ))}
          </div>
        )}
      </div>

      </MobileSection>

      {/* DARK HORSE + SUCK PICK */}
      <MobileSection id="calls" title="My Calls">
      <div>
        {sectionTitle("My Calls")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
          <div style={{ ...card, borderLeft: `3px solid ${T.green}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.green, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Dark Horse</div>
            {darkHorse
              ? <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{darkHorse}</div>
                  {darkHorseReason && <div style={{ fontSize: 12, color: T.textMid, marginTop: 6, lineHeight: 1.5 }}>{darkHorseReason}</div>}
                </div>
              : <div style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>I name my dark horse Wednesday morning.</div>}
          </div>
          <div style={{ ...card, borderLeft: `3px solid ${T.red}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.red, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Suck Pick</div>
            {suckPick
              ? <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{suckPick}</div>
                  {suckPickReason && <div style={{ fontSize: 12, color: T.textMid, marginTop: 6, lineHeight: 1.5 }}>{suckPickReason}</div>}
                </div>
              : <div style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>I name my suck pick Wednesday morning.</div>}
          </div>
        </div>
      </div>

      </MobileSection>

      {/* WEEKEND TIMELINE */}
      <MobileSection id="weekend" title="Race Weekend">
      <div>
        {sectionTitle("Race Weekend")}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Practice", when: "Saturday 10:00 AM ET", done: pracCount > 0, canceled: pracCount === 0 && pracCanceled, note: pracCount > 0 ? `${pracCount} drivers logged` : pracCanceled ? "Canceled" : "Scheduled" },
            { label: "Qualifying", when: "Saturday 11:10 AM ET", done: qualCount > 0, canceled: qualCount === 0 && qualCanceled, note: qualCount > 0 ? `${qualCount} drivers logged` : qualCanceled ? "Canceled" : "Scheduled" },
            { label: "Race", when: `${hub.dateLabel}, 3:00 PM ET`, done: status !== "upcoming", canceled: false, note: status === "live" ? "Green flag today" : status === "completed" ? (actuals ? `Winner: ${actuals[0]}` : "Results pending") : "Scheduled" },
          ].map((row, i) => (
            <div key={i} style={{ ...card, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: row.canceled ? T.red : row.done ? T.green : T.textDim, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase", minWidth: 90 }}>{row.label}</span>
              <span style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{row.when}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: row.canceled ? T.red : row.done ? T.green : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{row.note}</span>
            </div>
          ))}
        </div>
      </div>

      </MobileSection>

      {/* DFS CALLOUT */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: `linear-gradient(135deg, ${T.goldBg}, ${T.surface} 70%)` }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase" }}>Building a DFS lineup?</div>
          <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 4 }}>Run the optimizer with this week's salaries and projections.</div>
        </div>
        <button onClick={() => onOpenTab("dfs")} style={{ padding: "9px 20px", borderRadius: 6, border: `1px solid ${T.gold}60`, background: `${T.gold}18`, color: T.gold, fontSize: 12, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
          Open DFS Optimizer
        </button>
      </div>

      {/* RESULTS — tabbed: practice / qualifying before the race, live during, race results after */}
      <MobileSection id="results" title="Official Results">
      <div>
        {sectionTitle("Official Results")}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {resultTabs.map(t => (
            <button key={t.id} onClick={() => setResultsTab(t.id)} style={{
              padding: "7px 16px", borderRadius: 8, cursor: "pointer",
              fontSize: 11, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif",
              letterSpacing: 1.5, textTransform: "uppercase",
              background: resultsTab === t.id ? T.accentSoft : T.surface3,
              border: `1px solid ${resultsTab === t.id ? T.accent : T.border}`,
              color: resultsTab === t.id ? T.accentText : T.textDim,
            }}>{t.label}</button>
          ))}
        </div>
        {resultsTab === "practice" && (
          practiceList.length > 0 ? (
            <div style={card}>
              {practiceList.map((p, i) => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: i < practiceList.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <span style={{ width: 24, fontSize: 11, fontWeight: 800, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>P{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{p.name}</span>
                  {p.overall != null && <span style={{ marginLeft: "auto", fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{p.overall}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...card, textAlign: "center", color: T.textDim, padding: "30px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: pracCanceled ? T.red : T.textMid, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>{pracCanceled ? "Practice canceled" : "No practice data yet"}</div>
              <div style={{ fontSize: 11, marginTop: 6, fontFamily: "'IBM Plex Mono',monospace" }}>{pracCanceled ? "This session was canceled and no practice running took place." : "Practice results will appear here once logged."}</div>
            </div>
          )
        )}
        {resultsTab === "qualifying" && (
          qualList.length > 0 ? (
            <div style={card}>
              {qualList.map((q, i) => (
                <div key={q.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: i < qualList.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <span style={{ width: 24, fontSize: 11, fontWeight: 800, color: i === 0 ? T.gold : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>P{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: i === 0 ? 800 : 500, color: T.text }}>{q.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...card, textAlign: "center", color: T.textDim, padding: "30px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: qualCanceled ? T.red : T.textMid, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>{qualCanceled ? "Qualifying canceled" : "No qualifying data yet"}</div>
              <div style={{ fontSize: 11, marginTop: 6, fontFamily: "'IBM Plex Mono',monospace" }}>{qualCanceled ? "The starting grid will appear here once it is set." : "Qualifying results will appear here once logged."}</div>
            </div>
          )
        )}
        {resultsTab === "live" && (
          <div>
            <LiveRunningOrder hub={hub} />
            <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 8, textAlign: "center" }}>Live timing appears automatically once NASCAR's feed starts flowing.</div>
          </div>
        )}
        {resultsTab === "race" && actuals && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 22 }}>🏆</span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 2, textTransform: "uppercase" }}>Winner</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: T.gold, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>{actuals[0]}</div>
              </div>
              {winner && (
                <div style={{ marginLeft: "auto", fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
                  Battle winner: <span style={{ color: T.accentText, fontWeight: 700 }}>{winner.predictor}</span> ({winner.points} pts)
                </div>
              )}
            </div>
            {fullResults ? (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                    {[["Pos", 44], ["Driver", null], ["Start", 52], ["Led", 48], ["Stage", 56], ["Pts", 52]].map(([h, w]) => (
                      <th key={h} style={{ textAlign: h === "Driver" ? "left" : "center", fontSize: 10, fontWeight: 800, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1.5, textTransform: "uppercase", padding: "6px 4px", width: w || undefined }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fullResults.map((r, i) => (
                    <tr key={r.num} style={{ borderBottom: i < fullResults.length - 1 ? `1px solid ${T.border}` : "none", background: r.fin === 1 ? `${T.gold}0d` : "none" }}>
                      <td data-label="Pos" style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: r.fin === 1 ? T.gold : T.textDim, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>P{r.fin}</td>
                      <td data-label="Driver" style={{ fontSize: 13, fontWeight: r.fin === 1 ? 800 : 500, color: T.text, padding: "6px 4px" }}>{r.name}</td>
                      <td data-label="Start" style={{ textAlign: "center", fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.st > 0 ? `P${r.st}` : "—"}</td>
                      <td data-label="Led" style={{ textAlign: "center", fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.led || 0}</td>
                      <td data-label="Stage" style={{ textAlign: "center", fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.sp || 0}</td>
                      <td data-label="Pts" style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: T.accentText, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : actuals.slice(0, 10).map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: i < 9 ? `1px solid ${T.border}` : "none" }}>
                <span style={{ width: 24, fontSize: 11, fontWeight: 800, color: i === 0 ? T.gold : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>P{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: i === 0 ? 800 : 500, color: T.text }}>{d}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      </MobileSection>

      {/* PREV / NEXT */}
      <div style={{ display: "flex", gap: 10 }}>
        <button disabled={!olderHub} onClick={() => olderHub && onOpenRace(olderHub.slug)} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: olderHub ? T.textMid : T.textDim, fontSize: 12, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase", cursor: olderHub ? "pointer" : "default", opacity: olderHub ? 1 : 0.5 }}>
          {olderHub ? `← ${olderHub.name}` : "← No older race"}
        </button>
        <button disabled={!newerHub} onClick={() => newerHub && onOpenRace(newerHub.slug)} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: newerHub ? T.textMid : T.textDim, fontSize: 12, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase", cursor: newerHub ? "pointer" : "default", opacity: newerHub ? 1 : 0.5 }}>
          {newerHub ? `${newerHub.name} →` : "No newer race →"}
        </button>
      </div>

      {/* MOBILE BACK-TO-TOP — renders null on desktop */}
      <BackToTop />
    </div>
  );
}

// HOMEPAGE HERO CARD — replaces the old collapsible next-race banner.
// Mobile: sits on top. Desktop: sits to the side.
// Race hub summary card. Desktop sidebar: always open, a full race-at-a-glance
// panel that fills the column. Mobile banner: a collapsed dropdown, tap to
// expand inline, so checking the race never navigates you away from your tab.


export function RaceHeroCard({ hub, battleRace, qualPractice, onOpen, defaultOpen, collapsible }) {
  const [open, setOpen] = useState(!!defaultOpen || !collapsible);
  if (!hub) return null;
  const status = hubStatus(hub);
  const days = hubCountdown(hub);
  const typeColor = TC[hub.trackType] || T.accent;
  const predictions = (battleRace && battleRace.predictions) || {};
  const hasAnyPredictions = HUB_PREDICTORS.some(m => predictions[m] && predictions[m].length);
  const actuals = (battleRace && battleRace.actualResults && battleRace.actualResults.length) ? battleRace.actualResults : null;
  const winner = actuals ? battleWinnerFor(battleRace, HUB_PREDICTORS) : null;
  const darkHorse = battleRace && battleRace.darkHorse;
  const suckPick = battleRace && battleRace.suckPick;
  const qpMatch = qualPractice && qualPractice.week === hub.week;
  const pracCount = qpMatch && qualPractice.practice ? Object.keys(qualPractice.practice).length : 0;
  const qualCount = qpMatch && qualPractice.qualifying ? Object.keys(qualPractice.qualifying).length : 0;
  const sectionLabel = { fontSize: 11, fontWeight: 800, color: T.textDim, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase", margin: "16px 0 8px" };
  return (
    <div style={{
      width: "100%",
      background: `linear-gradient(135deg, ${typeColor}16, ${T.surface} 65%)`,
      borderBottom: `1px solid ${T.border}`,
      borderLeft: `3px solid ${typeColor}`,
      padding: "18px 22px",
    }}>
      <div onClick={collapsible ? () => setOpen(o => !o) : undefined} style={collapsible ? { cursor: "pointer" } : undefined}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 2, textTransform: "uppercase" }}>This week</span>
          <HubStatusBadge status={status} />
          {days != null && status === "upcoming" && (
            <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{days === 0 ? "RACE DAY" : `${days}d away`}</span>
          )}
          {collapsible && <span style={{ marginLeft: "auto", color: T.textDim, display: "flex" }}><Ic.Chevron open={open} /></span>}
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase", lineHeight: 1.1 }}>
          {hub.name}
        </div>
        <div style={{ fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", marginTop: 5 }}>
          {hub.track} · {hub.dateLabel} · {hub.laps} laps
        </div>
        {actuals && (
          <div style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 5 }}>
            Winner: <span style={{ color: T.gold, fontWeight: 700 }}>{actuals[0]}</span>
          </div>
        )}
      </div>
      {open && (
        <div>
          <div style={sectionLabel}>{hasAnyPredictions ? "Top 3 by predictor" : "Predictions"}</div>
          {!hasAnyPredictions ? (
            <div style={{ fontSize: 13, color: T.textDim }}>Models drop Monday, my picks land Wednesday.</div>
          ) : HUB_PREDICTORS.map(m => {
            const picks = (predictions[m] || []).slice(0, 3);
            const color = PREDICTOR_COLORS[m] || T.accent;
            return (
              <div key={m} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>{m}</span>
                </div>
                {picks.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", paddingLeft: 16 }}>No picks yet.</div>
                ) : picks.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 0 4px 16px", fontSize: 13 }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: i === 0 ? color : T.textDim, width: 13 }}>{i + 1}</span>
                    <span style={{ color: T.text, fontWeight: i === 0 ? 700 : 500 }}>{d}</span>
                    {actuals && actuals[0] === d && <span style={{ fontSize: 10, color: T.gold, fontWeight: 800, letterSpacing: 1 }}>WINNER</span>}
                  </div>
                ))}
              </div>
            );
          })}
          {(darkHorse || suckPick) && (
            <div>
              <div style={sectionLabel}>My calls</div>
              {darkHorse && <div style={{ fontSize: 13, color: T.textMid, padding: "3px 0" }}>Dark horse: <span style={{ color: T.text, fontWeight: 700 }}>{darkHorse}</span></div>}
              {suckPick && <div style={{ fontSize: 13, color: T.textMid, padding: "3px 0" }}>Suck pick: <span style={{ color: T.text, fontWeight: 700 }}>{suckPick}</span></div>}
            </div>
          )}
          <div style={sectionLabel}>Battle</div>
          <div style={{ fontSize: 13, color: T.textMid }}>
            {actuals && winner
              ? <span><span style={{ color: T.gold, fontWeight: 700 }}>{winner.predictor}</span> took it with {winner.points} pts.</span>
              : "Scored after the race."}
          </div>
          <div style={sectionLabel}>Weekend</div>
          <div style={{ fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace" }}>
            Practice: {pracCount ? `${pracCount} drivers` : "—"} · Qualifying: {qualCount ? `${qualCount} drivers` : "—"}
          </div>
          <button onClick={() => onOpen(hub.slug)} style={{ marginTop: 16, padding: 0, background: "none", border: "none", color: typeColor, fontSize: 13, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>
            Full race hub <span>→</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
