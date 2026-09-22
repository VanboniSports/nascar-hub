// GA4 / usage analytics helpers. Extracted from NASCARHub.jsx (phase 2).
// NOTE: trackHubTabView stays in NASCARHub.jsx (needs the TABS tab config).
import { sb } from "./supabase.js";

export function logUsageEvent(toolName, metadata) {
  if (!sb) return;
  const row = { tool_name: toolName };
  if (metadata) row.metadata = metadata;
  sb.from("usage_events").insert(row).then(({ error }) => {
    if (error) console.warn("Usage event log error:", error);
  });
}

// ─────────────────────────────────────────────────────────────
// ADMIN PASSWORD
// ─────────────────────────────────────────────────────────────


export const TAB_ROUTES = {
  "/": "race",
  "/power": "power",
  "/predictions": "predictor",
  "/battle": "tracker",
  "/scorecard": "scorecard",
  "/races": "races",
  "/tracks": "tracks",
  "/drivers": "analytics",
  "/season": "season",
  "/dfs": "dfs",
  "/blog": "blog",
};
// NOTE: /race/<slug> pages are handled separately (tab id "race") via
// raceSlugFromPath / applyRaceMeta / trackRacePageView below.


export const TAB_META = {
  power:     { title: "NASCAR Cup Series Power Rankings | Vanboni Sports", desc: "Weekly NASCAR Cup Series power rankings computed from official race results, updated after every race." },
  predictor: { title: "NASCAR Race Predictor: Model Picks & Win Probabilities | Vanboni Sports", desc: "Data-driven NASCAR race predictions from Pure Stats, Enhanced Pure Stats and power-ranking models, with winner probabilities for every driver." },
  tracker:   { title: "Predictor Battle Tracker: Models vs. the Gut | Vanboni Sports", desc: "Follow the season-long battle between the Vanboni Sports models and Morgan's gut picks, scored against actual NASCAR race results." },
  scorecard: { title: "NASCAR Model Scorecard: Prediction Accuracy & Track Splits | Vanboni Sports", desc: "How accurate are the Vanboni Sports NASCAR prediction models? Winner accuracy, top-10 hit rates and track-type splits, graded against actual race results every week." },
  races:     { title: "NASCAR Race Hubs: Every Race, One Page | Vanboni Sports", desc: "Browse every NASCAR Cup Series race hub: model predictions, battle tracker scoring, DFS notes and official results for each race." },
  tracks:    { title: "NASCAR Track Stats & History | Vanboni Sports", desc: "Track-by-track NASCAR Cup Series stats: past winners, track types, and how each track plays." },
  analytics: { title: "NASCAR Driver Analytics | Vanboni Sports", desc: "Deep NASCAR driver stats, trends and head-to-head comparisons across the Cup Series field." },
  season:    { title: "NASCAR Cup Series Season Stats & Standings | Vanboni Sports", desc: "2026 NASCAR Cup Series points standings and season-long driver statistics, updated weekly." },
  dfs:       { title: "NASCAR DFS Optimizer: DraftKings & FanDuel Lineups | Vanboni Sports", desc: "Build optimal NASCAR DFS lineups with projections, salaries and value plays for DraftKings and FanDuel." },
  blog:      { title: "Vanboni Sports Blog: NASCAR Predictions & Race Recaps | Vanboni Sports", desc: "Weekly NASCAR predictions, race recaps and model scorecards from Vanboni Sports." },
};


export function tabIdFromPath() {
  if (typeof window === "undefined") return "power";
  const p = window.location.pathname.replace(/\/+$/, "") || "/";
  if (p === "/race" || p.startsWith("/race/")) return "race";
  return TAB_ROUTES[p] || "power";
}


export function raceSlugFromPath() {
  if (typeof window === "undefined") return null;
  const p = window.location.pathname.replace(/\/+$/, "") || "/";
  if (p === "/race") return null;
  if (p.startsWith("/race/")) return decodeURIComponent(p.slice(6)) || null;
  return null;
}


export function pathForTab(tabId) {
  for (const path in TAB_ROUTES) if (TAB_ROUTES[path] === tabId) return path;
  return "/";
}


export function applyTabMeta(tabId) {
  const meta = TAB_META[tabId] || TAB_META.power;
  document.title = meta.title;
  const tag = document.querySelector('meta[name="description"]');
  if (tag) tag.setAttribute("content", meta.desc);
}


export function trackEvent(name, params) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params || {});
}
// GA4 pageview for /race/<slug> pages (not Hub tabs, so tracked separately).


export function trackRacePageView(slug, hubName) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const page_path = "/race/" + slug;
  window.gtag("event", "page_view", {
    page_title: "Vanboni Sports - " + (hubName ? hubName + " Race Hub" : "Race Hub"),
    page_location: window.location.origin + page_path,
    page_path: page_path,
  });
}
// GA4 pageview for the Race Hub tab at / (shows the current week's hub).


export function trackRaceTabView(hub) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_title: "Vanboni Sports - " + (hub ? hub.name + " Race Hub" : "Race Hub"),
    page_location: window.location.origin + "/",
    page_path: "/",
  });
}


export function applyRaceMeta(hub) {
  if (typeof document === "undefined") return;
  const name = hub ? (hub.officialName || hub.name) : null;
  document.title = name
    ? `${name} Race Hub: Predictions, Battle & Results | Vanboni Sports`
    : "Race Hub | Vanboni Sports";
  const tag = document.querySelector('meta[name="description"]');
  if (tag) tag.setAttribute("content", hub
    ? `NASCAR race hub for ${name} at ${hub.track}: model predictions, battle tracker scoring, DFS notes and official results.`
    : "NASCAR race hubs from Vanboni Sports: predictions, results and the model battle for every race.");
}

// ─────────────────────────────────────────────────────────────
// RACE HUBS — Races tab (archive index), per-race hub page, homepage hero card
// ─────────────────────────────────────────────────────────────
