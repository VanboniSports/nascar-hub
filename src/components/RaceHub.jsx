// Race-hub pages (/race/<slug>) + hub helpers. Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useEffect } from "react";
import { T, TC, TL } from "../theme.js";
import { PREDICTORS, PREDICTOR_COLORS } from "../data/siteMeta.js";
import { HubStatusBadge, sectionTitle } from "./ui.jsx";
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

// LIVE RUNNING ORDER — shown on a race hub while that race is actually live.
// Data comes from /api/live-leaderboard, a Vercel serverless proxy for
// NASCAR's official live feed (the CDN sends no CORS headers, so the browser
// cannot fetch it directly). Polls every 45 seconds. Renders nothing when
// the race is not live or the feed is unreachable: no errors, no boxes.


export function LiveRunningOrder({ hub }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!hub || !hub.nascarRaceId) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/live-leaderboard?race_id=${hub.nascarRaceId}`);
        const j = await r.json();
        if (alive) setData(j && j.live ? j : null);
      } catch (e) { if (alive) setData(null); }
    };
    load();
    const t = setInterval(load, 45000);
    return () => { alive = false; clearInterval(t); };
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
        <span style={{ marginLeft: "auto", fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>auto-refreshes</span>
      </div>
      <div>
        {data.order.slice(0, 10).map(o => (
          <div key={o.pos} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ width: 22, fontSize: 11, fontWeight: 800, color: o.pos <= 3 ? T.gold : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{o.pos}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", minWidth: 28 }}>#{o.number}</span>
            <span style={{ fontSize: 12, fontWeight: o.pos === 1 ? 800 : 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</span>
            {!o.running && <span style={{ fontSize: 9, fontWeight: 700, color: T.red, fontFamily: "'IBM Plex Mono',monospace" }}>OUT</span>}
            <span style={{ marginLeft: "auto", fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{o.delta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// RACE HUB PAGE — /race/<slug>


export function RaceHubPage({ hub, battleRace, qualPractice, onOpenRace, onOpenTab }) {
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
  const actuals = (battleRace && battleRace.actualResults && battleRace.actualResults.length) ? battleRace.actualResults : null;
  const winner = battleWinnerFor(battleRace, HUB_PREDICTORS);
  const typeColor = TC[hub.trackType] || T.accent;

  const qpMatch = qualPractice && qualPractice.week === hub.week;
  const pracCount = qpMatch && qualPractice.practice ? Object.keys(qualPractice.practice).length : 0;
  const qualCount = qpMatch && qualPractice.qualifying ? Object.keys(qualPractice.qualifying).length : 0;

  const idx = RACE_HUBS.findIndex(h => h.slug === hub.slug);
  const olderHub = idx >= 0 ? RACE_HUBS[idx + 1] : null;
  const newerHub = idx > 0 ? RACE_HUBS[idx - 1] : null;

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" };

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

      {/* LIVE RUNNING ORDER — only renders while the race is actually live */}
      {status === "live" && <LiveRunningOrder hub={hub} />}

      {/* INTRO — per-race editorial, above the predictions */}
      {hub.intro && hub.intro.length > 0 && (
        <div style={{ ...card }}>
          {hub.intro.map((p, i) => (
            <p key={i} style={{ fontSize: 13, color: T.textMid, lineHeight: 1.75, margin: i > 0 ? "12px 0 0" : 0 }}>{p}</p>
          ))}
        </div>
      )}

      {/* PREDICTIONS */}
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
                <span style={{ color: T.text, fontWeight: 700 }}>{x.driver}</span>: {x.high[0]} has {x.high[0] === "My Gut" ? "me" : "them"} P{x.high[1]}, {x.low[0]} has {x.low[0] === "My Gut" ? "me" : "them"} P{x.low[1]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DARK HORSE + SUCK PICK */}
      <div>
        {sectionTitle("My Calls")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
          <div style={{ ...card, borderLeft: `3px solid ${T.green}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.green, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Dark Horse</div>
            {darkHorse
              ? <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{darkHorse}</div>
              : <div style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>I name my dark horse Wednesday morning.</div>}
          </div>
          <div style={{ ...card, borderLeft: `3px solid ${T.red}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.red, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Suck Pick</div>
            {suckPick
              ? <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{suckPick}</div>
              : <div style={{ fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>I name my suck pick Wednesday morning.</div>}
          </div>
        </div>
      </div>

      {/* WEEKEND TIMELINE */}
      <div>
        {sectionTitle("Race Weekend")}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Practice", when: "Friday 6:00 PM", done: pracCount > 0, note: pracCount > 0 ? `${pracCount} drivers logged` : "Scheduled" },
            { label: "Qualifying", when: "Saturday 3:00 PM", done: qualCount > 0, note: qualCount > 0 ? `${qualCount} drivers logged` : "Scheduled" },
            { label: "Race", when: hub.dateLabel, done: status !== "upcoming", note: status === "live" ? "Green flag today" : status === "completed" ? (actuals ? `Winner: ${actuals[0]}` : "Results pending") : "Scheduled" },
          ].map((row, i) => (
            <div key={i} style={{ ...card, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: row.done ? T.green : T.textDim, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase", minWidth: 90 }}>{row.label}</span>
              <span style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{row.when}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: row.done ? T.green : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>{row.note}</span>
            </div>
          ))}
        </div>
      </div>

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

      {/* RESULTS */}
      <div>
        {sectionTitle("Official Results")}
        {actuals ? (
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
            {actuals.slice(0, 10).map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: i < 9 ? `1px solid ${T.border}` : "none" }}>
                <span style={{ width: 24, fontSize: 11, fontWeight: 800, color: i === 0 ? T.gold : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>P{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: i === 0 ? 800 : 500, color: T.text }}>{d}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...card, textAlign: "center", color: T.textDim, padding: "30px 20px" }}>
            <div style={{ marginBottom: 10, opacity: 0.7 }}>{Ic.Lock()}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textMid, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>Results locked</div>
            <div style={{ fontSize: 11, marginTop: 6, fontFamily: "'IBM Plex Mono',monospace" }}>This section unlocks after the checkered flag on race day.</div>
          </div>
        )}
      </div>

      {/* PREV / NEXT */}
      <div style={{ display: "flex", gap: 10 }}>
        <button disabled={!olderHub} onClick={() => olderHub && onOpenRace(olderHub.slug)} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: olderHub ? T.textMid : T.textDim, fontSize: 12, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase", cursor: olderHub ? "pointer" : "default", opacity: olderHub ? 1 : 0.5 }}>
          {olderHub ? `← ${olderHub.name}` : "← No older race"}
        </button>
        <button disabled={!newerHub} onClick={() => newerHub && onOpenRace(newerHub.slug)} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: newerHub ? T.textMid : T.textDim, fontSize: 12, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase", cursor: newerHub ? "pointer" : "default", opacity: newerHub ? 1 : 0.5 }}>
          {newerHub ? `${newerHub.name} →` : "No newer race →"}
        </button>
      </div>
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
