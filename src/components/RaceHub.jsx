// Race-hub pages (/race/<slug>) + hub helpers. Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useEffect, useRef } from "react";
import { T, TC, TL } from "../theme.js";
import { sb } from "../lib/supabase.js";
import { PREDICTORS, PREDICTOR_COLORS } from "../data/siteMeta.js";
import { HubStatusBadge, sectionTitle } from "./ui.jsx";
import { MobileSection, MobileJumpNav, BackToTop } from "./MobileNav.jsx";
import { Ic } from "./icons.jsx";
import { SCHEDULE, SCHEDULE_YEAR, getThisWeeksRace } from "../data/schedule.js";
import { SCHEDULE_XFINITY, getThisWeeksRaceXfinity } from "../data/schedule-xfinity.js";
import { SCHEDULE_TRUCK, getThisWeeksRaceTruck } from "../data/schedule-truck.js";
import { SERIES_IDS, normalizeSeries, seriesLabel, hubSlugForSeries } from "../data/series.js";
import { SeriesSwitcher } from "./SeriesSwitcher.jsx";
import { scoreEntry } from "../models/battle.js";

// ── RACE HUBS: auto-generated from the season schedule ─────────────────────────
// Every week gets a hub automatically from src/data/schedule.js — no more
// hardcoding one race at a time. Races with rich extras (editorial intro,
// official race name, NASCAR live-feed race id, slug) are stored in Supabase
// (one app_state key per series, one entry per race week) and applied at boot
// by loadHubEditorial(); every other week gets a fully working hub with a
// generic preview. Editing copy in the admin panel's Race Hubs tab updates the
// site (and the app) with no code push.
// Newest week first, so olderHub/newerHub navigation keeps working.
// Hub editorial storage (Phase 3, series-namespaced, matching the
// seasonPoints pattern): Cup keeps the legacy key "hubEditorial" exactly,
// so all existing Cup editorial is untouched; O'Reilly uses
// "hubEditorialXfinity" and Trucks uses "hubEditorialTruck", each with the
// same inner week-keyed format. Week numbers are per-series schedules, so
// a Cup week must never be read as another series' week.
const HUB_EDITORIAL_KEYS = { cup: "hubEditorial", xfinity: "hubEditorialXfinity", truck: "hubEditorialTruck" };
let hubEditorialBySeries = { cup: {}, xfinity: {}, truck: {} };
let editorialReady = false;
export function hubEditorialReady() { return editorialReady; }
// Apply Supabase editorial rows to the generated hubs, in place so every
// existing hubBySlug/currentHub reference picks them up. Each hub reads
// only its own series' record at its own week, so Cup editorial can never
// attach to a lower-series hub (and vice versa). Accepts either the new
// per-series map { cup, xfinity, truck } or, for backward compatibility, a
// plain week-keyed object, which is treated as the Cup record.
export function setHubEditorialData(rowsOrMap) {
  const isMap = rowsOrMap && (Object.prototype.hasOwnProperty.call(rowsOrMap, "cup") || Object.prototype.hasOwnProperty.call(rowsOrMap, "xfinity") || Object.prototype.hasOwnProperty.call(rowsOrMap, "truck"));
  hubEditorialBySeries = isMap
    ? { cup: rowsOrMap.cup || {}, xfinity: rowsOrMap.xfinity || {}, truck: rowsOrMap.truck || {} }
    : { cup: rowsOrMap || {}, xfinity: {}, truck: {} };
  for (const hub of RACE_HUBS) {
    const ov = (hubEditorialBySeries[hub.series] || {})[hub.week];
    if (!ov) continue;
    if (ov.slug) hub.slug = ov.slug;
    if (ov.officialName) hub.officialName = ov.officialName;
    if (ov.nascarRaceId) hub.nascarRaceId = ov.nascarRaceId; else delete hub.nascarRaceId;
    if (Array.isArray(ov.intro) && ov.intro.length) hub.intro = ov.intro;
  }
  editorialReady = true;
}
export async function loadHubEditorial() {
  try {
    const results = await Promise.all(Object.values(HUB_EDITORIAL_KEYS).map(async (key) => {
      const { data } = await sb.from("app_state").select("value").eq("key", key).maybeSingle();
      return data && data.value;
    }));
    setHubEditorialData({ cup: results[0], xfinity: results[1], truck: results[2] });
    return Object.values(hubEditorialBySeries).reduce((n, rows) => n + Object.keys(rows || {}).length, 0);
  } catch (e) {
    console.error("hubEditorial load error:", e);
    editorialReady = true;
    return 0;
  }
}

const MONTH_IDX = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
const DAY_ABBR = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function hubFromSchedule(r, series = "cup") {
  const [mon, day] = r.date.split(" ");
  const d = new Date(SCHEDULE_YEAR, MONTH_IDX[mon], parseInt(day, 10));
  const officialName = r.name;
  const baseSlug = (r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + "-" + SCHEDULE_YEAR);
  return {
    series: normalizeSeries(series),
    seriesLabel: seriesLabel(series),
    slug: hubSlugForSeries(series, baseSlug),
    name: r.name,
    officialName,
    track: r.track,
    date: `${SCHEDULE_YEAR}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    dateLabel: `${DAY_ABBR[d.getDay()]} ${mon} ${d.getDate()}`,
    trackType: r.type,
    length: r.length,
    laps: r.laps,
    week: r.week,
    // Session times (Phase 4 session-times fix). practice is an explicit
    // null when a race has no practice session at all (e.g. Talladega
    // 2026, all three series); undefined on a hub means no session data
    // was recorded for that race yet, and the timeline must never fall
    // back to a hardcoded time in that case.
    practice: r.practice,
    qualifying: r.qualifying,
    raceTime: r.raceTime,
    hasSessionData: r.practice !== undefined || r.qualifying !== undefined || r.raceTime !== undefined,
    intro: [
      `${r.track} hosts the ${officialName}, a ${r.laps}-lap run on a ${r.length}-mile ${r.type} track. The full preview for this one is still coming together. Check back through the week as practice, qualifying, and the race itself fill in the blanks.`,
      normalizeSeries(series) === "cup"
        ? "Here is how this page works. Every week four pick sources submit a top 10: Pure Stats (track-type history), Enhanced Pure Stats (which folds in manufacturer trends, momentum, and playoff math), the site's own Power Rankings, and my gut. The Battle Tracker scores all four against the official results, and the season-long tally keeps me honest."
        : "Battle Tracker is Cup-only for 2026, so this hub does not carry battle scoring. Model predictions for this series appear in the Model Predictions section below when available, and on the Race Predictor tab. Official results for this series appear here once they are in the site's race data.",
    ],
  };
}

// Combined hub list, newest first within each series, Cup first, then
// O'Reilly, then Trucks. The Cup block is exactly the old reverse-schedule
// order, so Cup RacesTab order and Cup prev/next navigation are unchanged.
// Navigation and filtering stay within one series (see hubsForSeries), so
// prev/next never jumps from a Cup hub to a lower-series hub.
export const RACE_HUBS = [
  ...SCHEDULE.map((r) => hubFromSchedule(r, "cup")).reverse(),
  ...SCHEDULE_XFINITY.map((r) => hubFromSchedule(r, "xfinity")).reverse(),
  ...SCHEDULE_TRUCK.map((r) => hubFromSchedule(r, "truck")).reverse(),
];

export function hubsForSeries(series) {
  return RACE_HUBS.filter((h) => h.series === normalizeSeries(series));
}

// Same-weekend hub in another series: same track first, then closest date.
// For a shared weekend this is the hub the series selector jumps to, for
// example Cup Phoenix II (Oct 18) -> O'Reilly Phoenix II (Oct 17) ->
// Truck Phoenix (Oct 16), all at Phoenix Raceway. If a series never visits
// that track, it falls back to the closest date in that series.
export function findHubForSeries(series, hub) {
  if (!hub) return null;
  const list = hubsForSeries(series);
  if (!list.length) return null;
  const target = new Date(hub.date + "T12:00:00").getTime();
  const dist = (h) => {
    const t = new Date(h.date + "T12:00:00").getTime();
    return Number.isFinite(t) && Number.isFinite(target) ? Math.abs(t - target) : Infinity;
  };
  const sameTrack = list.filter((h) => h.track === hub.track).sort((a, b) => dist(a) - dist(b));
  if (sameTrack.length) return sameTrack[0];
  return [...list].sort((a, b) => dist(a) - dist(b))[0] || null;
}
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
  // Battle Tracker stays Cup-only for 2026. Returning null for lower-series
  // hubs is the central guard that stops Cup battle predictions, dark horse
  // and suck picks, and Cup results from ever appearing on another series'
  // hub, even if a caller forgets to gate them itself.
  if (!hub || (hub.series && hub.series !== "cup") || !battleRaces || !battleRaces.length) return null;
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
  // Race archive (power-rankings results) is Cup-only today, same guard as
  // findBattleForHub: never borrow Cup results for another series' hub.
  if (!hub || (hub.series && hub.series !== "cup") || !raceArchive || !raceArchive.length) return null;
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

// Match a series' race-data CSV rows to a hub, so a lower-series race page
// can show official results from that series' own data. Parsed CSV rows
// are arrays: [driver, track, year, finish, start, lapsLed, ..., raceDate
// at index 9]. Matching is by track + race date, never by week number
// (weeks collide across series) and never across series: the caller
// passes only this hub's series' rows. Stage points are not in the CSV,
// so sp is null and Pts is the base race-finish points from
// raceFinishPoints; the table renders Stage as an em dash for these rows
// rather than a zero that would imply known stage points.
const normTrackName = s => (s || "").toLowerCase().trim().replace(/\s*\([^)]*\)\s*$/, "");
export function findCsvResultsForHub(csvRows, hub) {
  if (!hub || !csvRows || !csvRows.length || !hub.date) return null;
  const track = normTrackName(hub.track);
  const byDate = csvRows.filter(r => r && r[9] === hub.date && normTrackName(r[1]) === track && r[3] > 0);
  let rows = byDate;
  if (!rows.length) {
    // CSV race dates are occasionally a day off (Trucks Charlotte and
    // Richmond 2026). Fall back to the same track within 3 days, but
    // only when that window holds exactly one race date, so a fallback
    // can never merge two races at the same track.
    const t = new Date(hub.date + "T12:00:00").getTime();
    const near = csvRows.filter(r => {
      if (!r || normTrackName(r[1]) !== track || !(r[3] > 0)) return false;
      const d = new Date((r[9] || "") + "T12:00:00").getTime();
      return !isNaN(d) && Math.abs(d - t) <= 3 * 86400000;
    });
    const dates = [...new Set(near.map(r => r[9]))];
    if (dates.length === 1) rows = near;
  }
  if (!rows.length) return null;
  return rows.map(r => ({ fin: r[3], name: r[0], st: r[4], led: r[5], sp: null, pts: raceFinishPoints(r[3]) })).sort((a, b) => a.fin - b.fin);
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


export function currentHub(series = "cup") {
  // Week numbers collide across series (for example Cup week 33 and
  // O'Reilly week 33 are different races), so the lookup must filter by
  // series. With series "cup" this is exactly the old behavior: the Cup
  // schedule's current race, falling back to the newest Cup hub.
  const s = normalizeSeries(series);
  const race = s === "xfinity" ? getThisWeeksRaceXfinity() : s === "truck" ? getThisWeeksRaceTruck() : getThisWeeksRace();
  const list = hubsForSeries(s);
  return (race && list.find(h => h.week === race.week)) || list[0] || null;
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
  // Hub selection is series-dimensioned. Default is Cup, so the default
  // list is exactly the old Cup list, in the old order. Switching the
  // filter lists that series' hubs only; it never mixes series in one list.
  const [seriesFilter, setSeriesFilter] = useState("cup");
  const hubs = hubsForSeries(seriesFilter);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>Race Hubs</div>
        <div style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 4 }}>
          {seriesFilter === "cup"
            ? "Every race gets one page: model predictions, the battle tracker scoring, DFS notes and official results."
            : `Every ${seriesLabel(seriesFilter)} Series race gets one page: model predictions and official results. Battle Tracker and DFS are Cup-only for now.`}
        </div>
        <div style={{ marginTop: 12 }}>
          <SeriesSwitcher series={seriesFilter} onSeriesChange={setSeriesFilter} />
        </div>
      </div>
      {hubs.length === 0 ? (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, textAlign: "center", color: T.textDim, fontSize: 13 }}>
          No race hubs yet. The first one drops with Kansas.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {hubs.map(hub => {
            const status = hubStatus(hub);
            const battle = findBattleForHub(battleRaces, hub);
            const scored = battle && battle.actualResults && battle.actualResults.length > 0;
            const winner = battleWinnerFor(battle, HUB_PREDICTORS);
            return (
              // Key must be unique across the whole hub set, not just the
              // slug: Supabase editorial rows can overwrite a Cup hub's
              // slug (week 30 Kansas II is stored as "kansas-2026", the
              // same slug as week 9 Kansas), giving the Cup list duplicate
              // keys. Duplicate keys corrupt React's list reconciliation
              // when the series filter switches lists, which can leave a
              // stale Cup card in the DOM on a lower-series list. Series +
              // week + slug is unique for every hub and does not change
              // list order or navigation.
              <button key={`${hub.series}-${hub.week}-${hub.slug}`} onClick={() => onOpenRace(hub.slug)} style={{
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
                    {hub.series !== "cup" ? `${seriesLabel(hub.series)} · ` : ""}{hub.track} · {hub.dateLabel} · {hub.laps} laps
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
// cannot fetch it directly). Polls every 20 seconds. Renders nothing when
// the race is not live or the feed is unreachable: no errors, no boxes.
// After the checkered flag the proxy keeps serving the frozen feed flagged
// final: the panel shows a FINAL header, stops polling, and stays up until
// the official Race Results tab appears.
// The timeline is derived client-side by diffing each poll against the previous
// one (passes for position, lead changes, cautions/restarts, pit stops, stage
// ends) and merged with the recorder's back-history, so opening mid-race still
// shows everything captured since the recorder started.
// Live mode is automatic: hubs near their race date poll the proxy without a
// race id and show whichever Cup race is currently live, so no per-week race
// id is needed. A hub's Supabase editorial row can still set nascarRaceId to
// pin the panel to one specific race.

// Series guard for the live feed. The proxy's auto mode returns whichever
// race is currently live, with no series filter, which is how a hub could
// show another series' race. Before a live order is shown, it must match
// this hub: same track (with Atlanta/Echopark and Dover name aliases) and
// a scheduled lap count within 10 laps of the hub's. Series lap counts on
// a shared weekend differ by far more than 10 (Phoenix: Cup 312, O'Reilly
// 200, Trucks 150; Talladega: 188, 113, 94), while overtime adds only a
// few laps, so 10 is a safe tolerance. A mismatch renders nothing, the
// same as when no race is live, instead of showing the wrong series.
function trackNamesMatch(a, b) {
  const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  const isAtlanta = (x) => x.includes("atlanta") || x.includes("echopark");
  if (isAtlanta(na) && isAtlanta(nb)) return true;
  if (na.includes("dover") && nb.includes("dover")) return true;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function liveFeedMatchesHub(data, hub) {
  if (!data || !hub) return false;
  if (data.trackName && hub.track && !trackNamesMatch(data.trackName, hub.track)) return false;
  if (data.lapsTotal && hub.laps && Math.abs(data.lapsTotal - hub.laps) > 10) return false;
  // DATE guard: laps alone are insufficient. Talladega 2026 proves it: the
  // O'Reilly race is 94 laps and the Trucks entry is site-listed at 94, so a
  // Saturday O'Reilly feed passes a Friday Trucks hub's track + laps check.
  // The feed's updatedAt, converted to its America/New_York calendar date,
  // must equal hub.date (YYYY-MM-DD). Fail closed if updatedAt is missing or
  // unparseable, or hub.date is missing, the same as a mismatch.
  if (!hub.date) return false;
  const ts = Date.parse(data.updatedAt);
  if (!Number.isFinite(ts)) return false;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ts));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const feedDate = `${get("year")}-${get("month")}-${get("day")}`;
  if (feedDate !== hub.date) return false;
  return true;
}

const liveOrdinal = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");

export function LiveRunningOrder({ hub }) {
  const [data, setData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const prevRef = useRef(null);
  const seenRef = useRef(new Set());
  const historyLoadedRef = useRef(false);
  const finalRef = useRef(false);
  // Explicit (hub declares nascarRaceId) vs automatic (hub is near race day:
  // raced within the last 4 days or starts within 36h). Auto mode asks the
  // proxy which Cup race is live instead of needing a pre-configured id.
  const explicitId = hub && hub.nascarRaceId ? String(hub.nascarRaceId) : null;
  const autoEligible = (() => {
    if (!hub || !hub.date || explicitId) return false;
    const t = new Date(hub.date + "T12:00:00").getTime();
    if (!Number.isFinite(t)) return false;
    const now = Date.now();
    return now - t < 4 * 864e5 && t - now < 36 * 36e5;
  })();
  const liveActive = !!(hub && (explicitId || autoEligible));
  // Backfill the recorder's timeline history. Retries on failure: a single
  // flaky read must not leave the timeline permanently empty. Also called
  // from the poll loop below until it succeeds (self-healing).
  const loadHistory = (rid) => {
    if (!hub || !rid || historyLoadedRef.current) return;
    let tries = 0;
    const attempt = () => {
      tries++;
      sb.from("app_state").select("value").eq("key", `livetimeline:${rid}`).maybeSingle()
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
    if (!liveActive) return;
    historyLoadedRef.current = false;
    finalRef.current = false;
    prevRef.current = null;
    seenRef.current = new Set();
    setData(null);
    setTimeline([]);
    if (explicitId) loadHistory(explicitId);
  }, [hub ? hub.slug : null]);
  useEffect(() => {
    if (!liveActive) return;
    let alive = true;
    const feedUrl = explicitId
      ? `https://www.vanbonisports.com/api/live-leaderboard?race_id=${explicitId}`
      : "https://www.vanbonisports.com/api/live-leaderboard";
    const load = async () => {
      try {
        const r = await fetch(feedUrl);
        const j = await r.json();
        if (!alive) return;
        if (!(j && j.live)) { setData(null); return; }
        // Never show another series' live race on this hub. See
        // liveFeedMatchesHub above: a mismatch renders nothing.
        if (!liveFeedMatchesHub(j, hub)) { setData(null); return; }
        setData(j);
        // Once the final order arrives, stop polling: the data is frozen.
        if (j.final) finalRef.current = true;
        if (!historyLoadedRef.current) loadHistory(j.raceId || explicitId);
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
    const t = setInterval(() => { if (alive && !finalRef.current) load(); }, 20000);
    const tick = setInterval(() => { if (alive) setNowTs(Date.now()); }, 30000);
    return () => { alive = false; clearInterval(t); clearInterval(tick); };
  }, [hub ? hub.slug : null]);
  if (!data) return (
    <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 8, textAlign: "center" }}>Live timing appears automatically once NASCAR's feed starts flowing.</div>
  );
  const flagColors = { GREEN: T.green, CAUTION: "#f59e0b", "RED FLAG": T.red, CHECKERED: T.textDim };
  return (
    <div style={{ background: T.surface, border: `1px solid ${data.final ? T.border : `${T.red}55`}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        {data.final ? (
          <>
            <span style={{ fontSize: 13 }}>🏁</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: T.gold, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2 }}>FINAL</span>
            <span style={{ fontSize: 11, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace" }}>
              Lap {data.lap} of {data.lapsTotal}
            </span>
            {data.flag && (
              <span style={{ fontSize: 10, fontWeight: 800, color: flagColors[data.flag] || T.textMid, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1 }}>{data.flag}</span>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
        <span style={{ marginLeft: "auto", fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{data.final ? "final" : "refreshes every 20s"}</span>
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
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {timeline.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: T.green, fontFamily: "'IBM Plex Mono',monospace", minWidth: 46, paddingTop: 1 }}>LAP {e.lap}</span>
                <span style={{ fontSize: 12, color: T.textMid }}>{e.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// RACE HUB PAGE — /race/<slug>


export function RaceHubPage({ hub, battleRace, hubPredictions, qualPractice, qualPracticeBySeries, csvDataBySeries, onOpenRace, onOpenTab, raceArchive, drivers }) {
  if (!hub) {
    // Direct /race/<slug> links for weeks whose slug comes from the Supabase
    // editorial rows resolve on the first paint after boot loads them.
    if (!editorialReady) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>Loading race hub…</div>
          <div style={{ fontSize: 13, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>Pulling the latest race info.</div>
        </div>
      );
    }
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

  // Series gating for this page. Battle Tracker and the race archive
  // are Cup-only today. Practice/qualifying data is per-series since
  // Oct 24, 2026 (see the qp block below), and official results for a
  // lower-series hub come from that series' own race-data CSV (see the
  // csvResults block below). For a lower-series hub every Cup-only
  // source is forced to empty, so the page shows an honest pending note
  // instead of Cup data wearing another series' name.
  // findBattleForHub and findArchiveForHub gate the same way; this is
  // the second, page-level guard.
  const isCupHub = hub.series === "cup";
  const effectiveBattleRace = isCupHub ? battleRace : null;
  const status = hubStatus(hub);
  // Lower-series model picks (Oct 22, 2026): display-only picks from
  // app_state hubPredictionsXfinity / hubPredictionsTruck, keyed by hub
  // slug. Battle Tracker stays Cup-only: these picks never feed battle
  // scoring, and Gut / dark horse / suck pick sections stay Cup-only
  // (they are gated by isCupHub below). Cup hubs keep using the battle
  // entry exactly as before.
  const lowerModelPredictions = !isCupHub && hubPredictions && hubPredictions[hub.series] && hubPredictions[hub.series][hub.slug] ? (hubPredictions[hub.series][hub.slug].predictions || {}) : {};
  const predictions = isCupHub ? ((effectiveBattleRace && effectiveBattleRace.predictions) || {}) : lowerModelPredictions;
  const MODELS = isCupHub ? HUB_PREDICTORS : ["Pure Stats", "Enhanced Pure Stats", "Power Rankings"];
  const hasAnyPredictions = MODELS.some(m => predictions[m] && predictions[m].length);
  // Disagreements and the battle winner only consider hub predictors,
  // so the retired ML model can never appear on this page.
  const hubModelPicks = Object.fromEntries(Object.entries(predictions).filter(([m]) => MODELS.includes(m)));
  const disagreements = hasAnyPredictions ? topDisagreements(hubModelPicks) : [];
  const darkHorse = effectiveBattleRace && effectiveBattleRace.darkHorse;
  const suckPick = effectiveBattleRace && effectiveBattleRace.suckPick;
  const darkHorseReason = effectiveBattleRace && effectiveBattleRace.darkHorseReason;
  const suckPickReason = effectiveBattleRace && effectiveBattleRace.suckPickReason;
  const actuals = (effectiveBattleRace && effectiveBattleRace.actualResults && effectiveBattleRace.actualResults.length) ? effectiveBattleRace.actualResults : null;
  const winner = battleWinnerFor(effectiveBattleRace, HUB_PREDICTORS);
  // Full official results with points, from the power-rankings race archive.
  // Falls back to the battle top-10 list until the archive has this race.
  const archiveEntry = isCupHub ? findArchiveForHub(raceArchive, hub) : null;
  const fullResults = archiveEntry && archiveEntry.results ? archiveEntry.results
    .filter(r => r.fin > 0)
    .map(r => {
      const d = (drivers || []).find(x => String(x.num) === String(r.num));
      return { ...r, name: d ? d.name : (r.name || `Car #${r.num}`), pts: raceFinishPoints(r.fin) + (r.sp || 0) + (r.fl ? 1 : 0) };
    })
    .sort((a, b) => a.fin - b.fin) : null;
  // Lower-series official results (Oct 24, 2026): from this series' own
  // race-data CSV rows, matched by track + date by findCsvResultsForHub.
  // Cup keeps the battle/archive path exactly as before; lower hubs never
  // read Cup results, and Cup hubs never read CSV rows here.
  const csvResults = !isCupHub && csvDataBySeries && csvDataBySeries[hub.series]
    ? findCsvResultsForHub(csvDataBySeries[hub.series], hub) : null;
  const lowerActuals = csvResults ? csvResults.map(r => r.name) : null;
  const raceActuals = isCupHub ? actuals : lowerActuals;
  const raceFullResults = isCupHub ? fullResults : csvResults;
  const typeColor = TC[hub.trackType] || T.accent;

  // Practice/qualifying: per-series record (Oct 24, 2026), matched
  // against THAT series' hub week. Week numbers collide across series,
  // so a Cup week-33 record must never match an O'Reilly week-33 hub,
  // and a lower-series record must never match a Cup hub. Falls back
  // to the legacy single prop for Cup callers that do not pass the
  // per-series map, so Cup behaviour is unchanged without the map.
  const qp = qualPracticeBySeries ? (qualPracticeBySeries[hub.series] || null)
    : (isCupHub ? qualPractice : null);
  const qpMatch = qp && qp.week === hub.week;
  const pracCount = qpMatch && qp.practice ? Object.keys(qp.practice).length : 0;
  const qualCount = qpMatch && qp.qualifying ? Object.keys(qp.qualifying).length : 0;
  const pracCanceled = qpMatch && !!qp.practiceCanceled;
  const qualCanceled = qpMatch && !!qp.qualifyingCanceled;
  const practiceList = (qpMatch && qp.practice)
    ? Object.entries(qp.practice)
        .map(([name, v]) => ({ name, pos: typeof v === "number" ? v : (v.speedRank || 9999), overall: (v && typeof v === "object") ? v.overall : null }))
        .sort((a, b) => a.pos - b.pos)
    : [];
  const qualList = (qpMatch && qp.qualifying)
    ? Object.entries(qp.qualifying).map(([name, pos]) => ({ name, pos })).sort((a, b) => a.pos - b.pos)
    : [];
  // The Live tab stays up after the checkered flag until official results land:
  // it shows the final running order in the gap between the feed ending and
  // the Race Results tab appearing (~90 min for post-race inspection).
  // Cup keeps the old rule (Live stays up after the checkered flag until
  // official results land). For a lower-series hub the Race Results tab
  // appears once that series' CSV has the race, so keeping Live open
  // forever after race day would be wrong; Live is offered on race day
  // only.
  const liveTabOpen = isCupHub
    ? (status === "live" || (status === "completed" && !actuals))
    : status === "live";
  const resultTabs = [
    { id: "practice", label: "Practice" },
    { id: "qualifying", label: "Qualifying" },
    ...(liveTabOpen ? [{ id: "live", label: "Live" }] : []),
    ...(raceActuals ? [{ id: "race", label: "Race Results" }] : []),
  ];
  const [resultsTab, setResultsTab] = useState(
    liveTabOpen ? "live" : raceActuals ? "race" : qualCount > 0 ? "qualifying" : "practice"
  );
  // When official results land mid-session, hand off from the Live tab.
  const sawActualsRef = useRef(false);
  useEffect(() => {
    if (raceActuals && !sawActualsRef.current) setResultsTab("race");
    sawActualsRef.current = !!raceActuals;
  }, [raceActuals]);

  // Prev/next stay within the same series, in the same newest-first
  // order as before. For Cup this is exactly the old navigation.
  const seriesHubs = hubsForSeries(hub.series);
  const idx = seriesHubs.findIndex(h => h.slug === hub.slug);
  const olderHub = idx >= 0 ? seriesHubs[idx + 1] : null;
  const newerHub = idx > 0 ? seriesHubs[idx - 1] : null;

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" };

  // Mobile jump-nav sections (rendered by MobileJumpNav, mobile only)
  const jumpSections = [
    ...(hub.intro && hub.intro.length > 0 ? [{ id: "preview", label: "Preview" }] : []),
    { id: "predictions", label: "Predictions" },
    ...(isCupHub ? [{ id: "calls", label: "My Calls" }] : []),
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
          {hub.series !== "cup" ? `${seriesLabel(hub.series)} Series · ` : ""}{hub.name} · {hub.track} · {hub.dateLabel} · {hub.length} mi · {hub.laps} laps · <span style={{ color: typeColor }}>{TL[hub.trackType] || hub.trackType}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>Same weekend in</span>
          {SERIES_IDS.map((id) => {
            const target = id === hub.series ? null : findHubForSeries(id, hub);
            const active = id === hub.series;
            return (
              <button key={id} disabled={active || !target} onClick={() => target && onOpenRace(target.slug)} style={{ padding: "5px 12px", borderRadius: 20, cursor: active || !target ? "default" : "pointer", fontSize: 11, fontWeight: active ? 800 : 500, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase", background: active ? T.accentSoft : "transparent", color: active ? T.accent : T.textDim, border: `1px solid ${active ? T.accent : T.border}`, opacity: !target && !active ? 0.5 : 1 }}>
                {seriesLabel(id)}
              </button>
            );
          })}
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
        {sectionTitle("Model Predictions", hasAnyPredictions ? (isCupHub ? "Top 10 from each predictor, via the Battle Tracker" : "Top 10 from each model — model predictions only, no Battle Tracker scoring, no Gut picks for this series") : null)}
        {!hasAnyPredictions ? (
          <div style={{ ...card, textAlign: "center", color: T.textDim, fontSize: 13, padding: "28px 20px" }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>🔮</div>
            <div>{isCupHub ? "Predictions drop Monday morning." : `Battle Tracker is Cup-only for 2026, so this hub does not show Cup predictions. Model predictions for the ${seriesLabel(hub.series)} Series are on the Race Predictor tab.`}</div>
            <div style={{ fontSize: 11, marginTop: 6, fontFamily: "'IBM Plex Mono',monospace" }}>{isCupHub ? "Check back once the models and my gut have weighed in." : "No gut picks for this series: Battle Tracker stays Cup-only for 2026."}</div>
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

      {/* DARK HORSE + SUCK PICK (Cup only: lower-series hubs do not get
          dark horse or suck picks, so this section is not rendered for
          them at all, instead of showing "Cup-only" placeholder cards) */}
      {isCupHub && (
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
              : <div style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{isCupHub ? "I name my dark horse Wednesday morning." : "Cup-only for 2026."}</div>}
          </div>
          <div style={{ ...card, borderLeft: `3px solid ${T.red}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.red, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Suck Pick</div>
            {suckPick
              ? <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{suckPick}</div>
                  {suckPickReason && <div style={{ fontSize: 12, color: T.textMid, marginTop: 6, lineHeight: 1.5 }}>{suckPickReason}</div>}
                </div>
              : <div style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{isCupHub ? "I name my suck pick Wednesday morning." : "Cup-only for 2026."}</div>}
          </div>
        </div>
      </div>

      </MobileSection>
      )}

      {/* WEEKEND TIMELINE */}
      <MobileSection id="weekend" title="Race Weekend">
      <div>
        {sectionTitle("Race Weekend")}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            // Session times come from the hub's schedule data, never from
            // hardcoded text: practice/qualifying days and times vary by
            // race and series, and some races (Talladega 2026) have no
            // practice at all. Hubs with no session data recorded show a
            // neutral "Session times not recorded" instead of a wrong time.
            { label: "Practice", when: !hub.hasSessionData ? "Session times not recorded" : hub.practice ? hub.practice : "No practice scheduled", done: pracCount > 0, canceled: pracCount === 0 && pracCanceled, note: !hub.hasSessionData ? "Not recorded" : hub.practice === null ? "No practice scheduled" : pracCount > 0 ? `${pracCount} drivers logged` : pracCanceled ? "Canceled" : "Scheduled" },
            { label: "Qualifying", when: !hub.hasSessionData ? "Session times not recorded" : (hub.qualifying || "Not confirmed"), done: qualCount > 0, canceled: qualCount === 0 && qualCanceled, note: !hub.hasSessionData ? "Not recorded" : qualCount > 0 ? `${qualCount} drivers logged` : qualCanceled ? "Canceled" : "Scheduled" },
            { label: "Race", when: !hub.hasSessionData ? `${hub.dateLabel}, session times not recorded` : `${hub.dateLabel}, ${hub.raceTime || "time not confirmed"}`, done: status !== "upcoming", canceled: false, note: status === "live" ? "Green flag today" : status === "completed" ? (raceActuals ? `Winner: ${raceActuals[0]}` : "Results pending") : "Scheduled" },
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

      {/* DFS CALLOUT (Cup only): the optimizer and its salaries are Cup data, so a lower-series hub must not point at them as if they were that series. */}
      {isCupHub && (
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: `linear-gradient(135deg, ${T.goldBg}, ${T.surface} 70%)` }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase" }}>Building a DFS lineup?</div>
          <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 4 }}>Run the optimizer with this week's salaries and projections.</div>
        </div>
        <button onClick={() => onOpenTab("dfs")} style={{ padding: "9px 20px", borderRadius: 6, border: `1px solid ${T.gold}60`, background: `${T.gold}18`, color: T.gold, fontSize: 12, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
          Open DFS Optimizer
        </button>
      </div>
      )}

      {/* RESULTS — tabbed: practice / qualifying before the race, live during, race results after */}
      <MobileSection id="results" title="Official Results">
      <div>
        {sectionTitle("Official Results")}
        {!isCupHub && status === "completed" && !raceActuals && (
          <div style={{ ...card, marginBottom: 12, fontSize: 12, color: T.textMid, lineHeight: 1.6 }}>
            Official results for the {seriesLabel(hub.series)} Series are not in the site's race data for this race yet. This page never shows another series' results here. Results appear here once the race data is updated, and the Live tab on race day only shows this series' race.
          </div>
        )}
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
        {resultsTab === "live" && <LiveRunningOrder hub={hub} />}
        {resultsTab === "race" && raceActuals && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 22 }}>🏆</span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 2, textTransform: "uppercase" }}>Winner</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: T.gold, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>{raceActuals[0]}</div>
              </div>
              {winner && (
                <div style={{ marginLeft: "auto", fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
                  Battle winner: <span style={{ color: T.accentText, fontWeight: 700 }}>{winner.predictor}</span> ({winner.points} pts)
                </div>
              )}
            </div>
            {raceFullResults ? (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                    {[["Pos", 44], ["Driver", null], ["Start", 52], ["Led", 48], ["Stage", 56], ["Pts", 52]].map(([h, w]) => (
                      <th key={h} style={{ textAlign: h === "Driver" ? "left" : "center", fontSize: 10, fontWeight: 800, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1.5, textTransform: "uppercase", padding: "6px 4px", width: w || undefined }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {raceFullResults.map((r, i) => (
                    <tr key={r.num != null ? r.num : r.name} style={{ borderBottom: i < raceFullResults.length - 1 ? `1px solid ${T.border}` : "none", background: r.fin === 1 ? `${T.gold}0d` : "none" }}>
                      <td data-label="Pos" style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: r.fin === 1 ? T.gold : T.textDim, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>P{r.fin}</td>
                      <td data-label="Driver" style={{ fontSize: 13, fontWeight: r.fin === 1 ? 800 : 500, color: T.text, padding: "6px 4px" }}>{r.name}</td>
                      <td data-label="Start" style={{ textAlign: "center", fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.st > 0 ? `P${r.st}` : "—"}</td>
                      <td data-label="Led" style={{ textAlign: "center", fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.led || 0}</td>
                      <td data-label="Stage" style={{ textAlign: "center", fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.sp == null ? "—" : r.sp}</td>
                      <td data-label="Pts" style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: T.accentText, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : raceActuals.slice(0, 10).map((d, i) => (
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


export function RaceHeroCard({ hub, battleRace, hubPredictions, qualPractice, qualPracticeBySeries, onOpen, defaultOpen, collapsible }) {
  const [open, setOpen] = useState(!!defaultOpen || !collapsible);
  if (!hub) return null;
  const status = hubStatus(hub);
  const days = hubCountdown(hub);
  const typeColor = TC[hub.trackType] || T.accent;
  // Lower-series hero picks (Oct 22, 2026): display-only model picks from
  // hubPredictions, keyed by hub slug. No battle scoring for lower hubs.
  const lowerModelPredictions = hub && hub.series !== "cup" && hubPredictions && hubPredictions[hub.series] && hubPredictions[hub.series][hub.slug] ? (hubPredictions[hub.series][hub.slug].predictions || {}) : {};
  const predictions = (battleRace && battleRace.predictions) || lowerModelPredictions;
  const heroModels = hub && hub.series !== "cup" ? ["Pure Stats", "Enhanced Pure Stats", "Power Rankings"] : HUB_PREDICTORS;
  const hasAnyPredictions = heroModels.some(m => predictions[m] && predictions[m].length);
  const actuals = (battleRace && battleRace.actualResults && battleRace.actualResults.length) ? battleRace.actualResults : null;
  const winner = actuals ? battleWinnerFor(battleRace, HUB_PREDICTORS) : null;
  const darkHorse = battleRace && battleRace.darkHorse;
  const suckPick = battleRace && battleRace.suckPick;
  // Practice/qualifying counts from the hub's own series' record
  // (Oct 24, 2026), matched against that series' hub week — never
  // another series' record. Falls back to the legacy single prop for
  // Cup callers that do not pass the per-series map.
  const qp = qualPracticeBySeries ? (qualPracticeBySeries[hub.series] || null)
    : (hub.series === "cup" ? qualPractice : null);
  const qpMatch = qp && qp.week === hub.week;
  const pracCount = qpMatch && qp.practice ? Object.keys(qp.practice).length : 0;
  const qualCount = qpMatch && qp.qualifying ? Object.keys(qp.qualifying).length : 0;
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
          ) : heroModels.map(m => {
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
            {hub && hub.series !== "cup"
              ? "Model predictions only — no Battle Tracker scoring for this series."
              : actuals && winner
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
