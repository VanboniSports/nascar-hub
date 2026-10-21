// ───────────────────────────────────────────────────────────
// SERIES DIMENSION — Phase 4 (public series switcher + hub separation)
// ───────────────────────────────────────────────────────────
// One place for everything that varies by NASCAR national series.
//
// Internal series ids stay "cup" | "xfinity" | "truck" so they match the
// existing filenames (nascar_scraped_data_xfinity.csv), schedule modules
// (schedule-xfinity.js) and driver lists (INITIAL_DRIVERS_XFINITY).
// The user-facing label for "xfinity" is "O'Reilly", never "Xfinity".
// Every helper defaults unknown or missing input to "cup", so Cup users
// see zero behavior change when no series is passed.
//
// Data currency note: the lower-series CSVs in the repo are current only
// through early October 2026. The Phoenix lower-series updates (O'Reilly
// Oct 17, Trucks Oct 16) are still local and unpushed as of this build,
// so the UI must never claim Phoenix lower-series data it does not have.
// This module carries no race data itself; it only maps series to the
// sources that do.
// ───────────────────────────────────────────────────────────

export const SERIES_IDS = ["cup", "xfinity", "truck"];

export const SERIES_LABELS = {
  cup: "Cup",
  xfinity: "O'Reilly",
  truck: "Trucks",
};

export function normalizeSeries(series) {
  return SERIES_IDS.includes(series) ? series : "cup";
}

export function seriesLabel(series) {
  return SERIES_LABELS[normalizeSeries(series)];
}

const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/VanboniSports/nascar-hub/main/";

export const SERIES_CSV_URLS = {
  cup: GITHUB_RAW_BASE + "nascar_scraped_data.csv",
  xfinity: GITHUB_RAW_BASE + "nascar_scraped_data_xfinity.csv",
  truck: GITHUB_RAW_BASE + "nascar_scraped_data_trucks.csv",
};

export function seriesCsvUrl(series) {
  return SERIES_CSV_URLS[normalizeSeries(series)];
}

// localStorage cache keys for parsed CSV data. Cup keeps the legacy key
// "nascar_csv_data" exactly, so existing Cup caches keep working.
export const SERIES_CSV_CACHE_KEYS = {
  cup: "nascar_csv_data",
  xfinity: "nascar_csv_data_xfinity",
  truck: "nascar_csv_data_truck",
};

export function seriesCsvCacheKey(series) {
  return SERIES_CSV_CACHE_KEYS[normalizeSeries(series)];
}

// Hub slug rules. Cup hubs keep their legacy slugs exactly
// (for example "phoenix-ii-2026"), so existing /race/<slug> links keep
// working. Lower-series hubs get a series prefix, so a Cup hub and a
// lower-series hub on the same weekend and track can never collide:
// "oreilly-phoenix-ii-2026" and "truck-phoenix-2026" are distinct from
// "phoenix-ii-2026" and from each other.
export function hubSlugForSeries(series, baseSlug) {
  const s = normalizeSeries(series);
  if (s === "cup") return baseSlug;
  if (s === "xfinity") return "oreilly-" + baseSlug;
  return "truck-" + baseSlug;
}
