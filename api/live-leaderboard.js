// api/live-leaderboard.js
// Vercel serverless proxy for NASCAR's official live running-order feed.
//
// Why a proxy: NASCAR's CDN (cf.nascar.com) does not send CORS headers,
// so the browser cannot fetch the feed directly. This function fetches it
// server-side, verifies the expected race is genuinely live, and returns a
// compact running order. When the race is not live it answers
// { live: false } and the race page renders nothing (no errors, no boxes).
//
// "Live" requires ALL of:
//   - the feed's race_id matches the requested race_id
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

export default async function handler(req, res) {
  const raceId = parseInt((req.query && req.query.race_id) || "", 10);
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=30");
  if (!raceId) {
    res.status(200).json({ live: false });
    return;
  }
  try {
    const r = await fetch(LIVE_FEED, {
      headers: { "User-Agent": "vanbonisports-racehub/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error("feed responded " + r.status);
    const f = await r.json();

    const updatedAt = Date.parse(f.time_of_day_os);
    const fresh = Number.isFinite(updatedAt) && Date.now() - updatedAt < FRESH_MS;
    const matches = Number(f.race_id) === raceId;
    const isRace = Number(f.run_type) === 3;
    const inProgress = Number(f.laps_to_go) > 0;

    if (!(matches && isRace && inProgress && fresh)) {
      res.status(200).json({ live: false });
      return;
    }

    const vehicles = (f.vehicles || [])
      .slice()
      .sort((a, b) => (a.running_position || 999) - (b.running_position || 999));
    const order = vehicles.slice(0, 15).map((v) => ({
      pos: v.running_position,
      number: v.vehicle_number,
      name: cleanName(v.driver && v.driver.full_name),
      mfr: v.vehicle_manufacturer,
      delta:
        v.running_position === 1
          ? "Leader"
          : v.delta != null && isFinite(Number(v.delta))
            ? "+" + Number(v.delta).toFixed(2) + "s"
            : "",
      running: v.status === 1,
    }));

    res.status(200).json({
      live: true,
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
