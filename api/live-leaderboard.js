// api/live-leaderboard.js
// Vercel serverless proxy for NASCAR's official live running-order feed.
//
// Why a proxy: NASCAR's CDN (cf.nascar.com) does not send CORS headers,
// so the browser cannot fetch the feed directly. This function fetches it
// server-side, verifies the expected race is genuinely live, and returns a
// compact running order. When the race is not live it answers
// { live: false } and the race page renders nothing (no errors, no boxes).
//
// Two modes: explicit (?race_id=5628) requires the feed's race_id to match;
// auto (no race_id) reports whichever Cup race is currently live. Auto mode
// is how race hubs show live running order every week with no per-race setup.
//
// "Live" requires ALL of:
//   - the feed's race_id matches the requested race_id (explicit mode only)
//   - run_type is 3 (race session, not practice/qualifying)
//   - laps_to_go > 0 (the race has not finished)
//   - the feed timestamp is fresh (updated within the last 15 minutes),
//     which proves NASCAR's timing feed is actively flowing
//
// Data source: https://cf.nascar.com/live/feeds/live-feed.json
// (NASCAR's official public live feed, no key required). It only carries
// live data while a race is actually running; at all other times the
// checks above fail and the panel stays hidden.

const LIVE_FEED = "https://cf.nascar.com/live/feeds/live-feed.json";
const FRESH_MS = 15 * 60 * 1000;
const FLAG_LABELS = { 1: "GREEN", 2: "CAUTION", 3: "RED FLAG", 4: "CHECKERED" };

function cleanName(full) {
  return String(full || "")
    .replace(/^\s*[*#]+/, "")        // strip * / # markers
    .replace(/\s*\([^)]*\)\s*$/, "") // strip suffixes like " (C)"
    .trim();
}

// Gap display: the feed reports seconds behind for cars on the lead lap and a
// negative lap count for lapped cars (e.g. -1 = one lap down). Render the
// latter as "N LAP(S) DOWN" instead of a bogus "+-1.00s".
function fmtDelta(pos, raw) {
  if (pos === 1) return "Leader";
  if (raw == null || !isFinite(Number(raw))) return "";
  const d = Number(raw);
  if (d < 0) {
    const laps = Math.abs(Math.round(d));
    return laps + (laps === 1 ? " LAP DOWN" : " LAPS DOWN");
  }
  return "+" + d.toFixed(2) + "s";
}

export default async function handler(req, res) {
  const raceId = parseInt((req.query && req.query.race_id) || "", 10);
  const explicit = Number.isFinite(raceId) && raceId > 0;
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=15");
  // CORS: the native app's WebView fetches this endpoint cross-origin, so it
  // needs an explicit allow-origin (the site itself is same-origin and worked
  // without it, which is why the app's live panel never loaded).
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const r = await fetch(LIVE_FEED, {
      headers: { "User-Agent": "vanbonisports-racehub/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error("feed responded " + r.status);
    const f = await r.json();

    const updatedAt = Date.parse(f.time_of_day_os);
    const fresh = Number.isFinite(updatedAt) && Date.now() - updatedAt < FRESH_MS;
    const matches = !explicit || Number(f.race_id) === raceId;
    const isRace = Number(f.run_type) === 3;
    const inProgress = Number(f.laps_to_go) > 0;
    // After the checkered flag the feed freezes on the final running order.
    // Keep serving it (flagged final) so the hub shows the unofficial results
    // until the official Race Results tab lands (~90 min for inspection).
    const isCheckered = Number(f.flag_state) === 4;
    const final = isCheckered && !inProgress;

    if (!(matches && isRace && (inProgress || isCheckered) && (fresh || isCheckered))) {
      res.status(200).json({ live: false });
      return;
    }

    const vehicles = (f.vehicles || [])
      .slice()
      .sort((a, b) => (a.running_position || 999) - (b.running_position || 999));
    const order = vehicles.map((v) => ({
      pos: v.running_position,
      number: v.vehicle_number,
      name: cleanName(v.driver && v.driver.full_name),
      mfr: v.vehicle_manufacturer,
      delta: fmtDelta(v.running_position, v.delta),
      running: v.status === 1,
      pitStops: (v.pit_stops || []).filter(s => (s.pit_in_lap_count || 0) > 0).length,
    }));

    res.status(200).json({
      live: true,
      final,
      raceId: f.race_id,
      trackName: f.track_name,
      runName: f.run_name,
      lap: f.lap_number,
      lapsTotal: f.laps_in_race,
      lapsToGo: f.laps_to_go,
      flag: FLAG_LABELS[f.flag_state] || null,
      stage: f.stage && f.stage.stage_num,
      leadChanges: f.number_of_lead_changes,
      cautions: f.number_of_caution_segments,
      updatedAt: f.time_of_day_os,
      order,
    });
  } catch (e) {
    res.status(200).json({ live: false });
  }
}
