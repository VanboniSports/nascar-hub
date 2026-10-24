// Supabase client singleton. Extracted from NASCARHub.jsx (phase 2).
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://xhywifoacvdwkrzunzpg.supabase.co";


export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoeXdpZm9hY3Zkd2tyenVuenBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3ODc2MTUsImV4cCI6MjA4NjM2MzYxNX0.rSF8GAI-yRMq63NAzQk3bsz6J9BIANE2ZOO34nYoT3M";


export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Log a timestamped usage event to the usage_events table (for date-range filtering)

// ─────────────────────────────────────────────────────────────
// ROOT STATE + SUPABASE PERSISTENCE
// (moved here from PowerRankingsTab.jsx in the phase-2 module split;
// NASCARHub.jsx calls both, so they live next to the sb client.)
// ─────────────────────────────────────────────────────────────
export async function loadFromSupabase() {
  if (!sb) return null;
  try {
    // All independent queries fire at once instead of one-after-another:
    // on a phone each sequential round trip was adding its full latency.
    // app_state is fetched as ONE query (all keys except the legacy blog
    // blob) instead of a separate request per key, which matters most on
    // high-latency cellular connections.
    const [
      { data:drvRows },
      { data:logRows },
      { data:statRows },
      { data:histRows },
      { data:stateRows },
      { data:bpLegacyMeta },
    ] = await Promise.all([
      sb.from("drivers").select("*"),
      sb.from("race_log").select("*").order("created_at",{ascending:false}),
      sb.from("season_stats").select("*"),
      sb.from("rating_history").select("*").order("created_at",{ascending:true}),
      // Every app_state key in one round trip. Excludes the legacy ~9MB
      // blogPosts blob AND the individual blogpost:* rows (~26MB total);
      // the page loads only the 7KB blogIndex, full bodies lazy-load on open.
      // Timestamps are checked separately below.
      sb.from("app_state").select("*").neq("key","blogPosts").not("key","like","blogpost:*"),
      // Legacy row: fetch ONLY its timestamp for the freshness check. The old
      // single-blob value is downloaded only if the fallback is needed.
      sb.from("app_state").select("key,updated_at").eq("key","blogPosts"),
    ]);
    // Partition the app_state rows by key.
    const byKey = {};
    (stateRows||[]).forEach(r => {
      byKey[r.key] = [r];
    });
    const prRows = byKey["prevRanks"] || [];
    const rfRows = byKey["recentFinishes"] || [];
    const raRows = byKey["raceArchive"] || [];
    const spRows = byKey["seasonPoints"] || [];
    // Phase 3: per-series points. Cup keeps the legacy "seasonPoints" key
    // exactly; lower series get their own keys with the same inner format
    // (`${driverName}__${year}` -> points), so a driver with points in two
    // series (e.g. Austin Hill) can never collide.
    const spxRows = byKey["seasonPointsXfinity"] || [];
    const spTruckRows = byKey["seasonPointsTruck"] || [];
    // Phase 3: per-series Power Rankings. Cup keeps the legacy drivers
    // table + prevRanks + recentFinishes + rating_history table exactly.
    // Lower series get their own app_state keys (car numbers collide
    // across series, so lower ratings must never go into the Cup drivers
    // table). recentFinishes per series is needed too: processRace uses
    // it for momentum, and without persisting it, admin applies after a
    // reload would compute momentum from an empty history.
    const powerDriversXfinityRows = byKey["powerDriversXfinity"] || [];
    const powerDriversTruckRows = byKey["powerDriversTruck"] || [];
    const prXfinityRows = byKey["prevRanksXfinity"] || [];
    const prTruckRows = byKey["prevRanksTruck"] || [];
    const rfXfinityRows = byKey["recentFinishesXfinity"] || [];
    const rfTruckRows = byKey["recentFinishesTruck"] || [];
    const rhXfinityRows = byKey["ratingHistoryXfinity"] || [];
    const rhTruckRows = byKey["ratingHistoryTruck"] || [];
    // Combo Power Score (approved Oct 21, 2026): NEW keys only, one per
    // series. The combo lives apart from the legacy ratings above so
    // production — which never reads these keys — is unchanged, and
    // the Cup drivers table / prevRanks / rating_history are never
    // overwritten by combo data.
    const comboCupRows = byKey["powerComboCup"] || [];
    const comboXfinityRows = byKey["powerComboXfinity"] || [];
    const comboTruckRows = byKey["powerComboTruck"] || [];
    // Hub model predictions for lower series (Oct 22, 2026): model-only
    // picks keyed by hub slug, one key per lower series. Battle Tracker
    // stays Cup-only; these keys never feed battle scoring.
    const hubPredXfinityRows = byKey["hubPredictionsXfinity"] || [];
    const hubPredTruckRows = byKey["hubPredictionsTruck"] || [];
    const btRows = byKey["battleRaces"] || [];
    const dsRows = byKey["dfsSalaries"] || [];
    const ddRows = byKey["dfsDisabled"] || [];
    const qpRows = byKey["dfsQualifying"] || [];
    // Per-series practice/qualifying (Oct 24, 2026): same inner shape as
    // the Cup dfsQualifying object (week, practice, qualifying, canceled
    // flags). Cup keeps the legacy key exactly; lower series never read
    // or write the Cup key, and week numbers collide across series, so
    // each series' record is only ever matched against its own hub week.
    const qpXfinityRows = byKey["dfsQualifyingXfinity"] || [];
    const qpTruckRows = byKey["dfsQualifyingTruck"] || [];
    // Blog posts: page load fetches ONLY the lightweight index (id/title/date/
    // excerpt, ~7KB). Full post bodies (which total ~26MB with images) are
    // lazy-loaded when a post is opened. Falls back to per-post rows, then to
    // the legacy single blogPosts blob, if the index is missing.
    const biRows = byKey["blogIndex"] || [];
    let bpRows;
    if (biRows?.[0]?.value) {
      bpRows = [{ value: biRows[0].value, indexOnly: true }];
    } else {
      const bpPostRows = (stateRows||[]).filter(r => r.key && r.key.startsWith("blogpost:"));
      const legacyTs = bpLegacyMeta?.[0]?.updated_at ? +new Date(bpLegacyMeta[0].updated_at) : 0;
      const perPostTs = (bpPostRows||[]).reduce((m,r)=>Math.max(m, r.updated_at ? +new Date(r.updated_at) : 0), 0);
      if (bpPostRows?.length && perPostTs >= legacyTs) {
        bpRows = [{ value: bpPostRows.map(r=>r.value) }];
      } else {
        // Rare fallback path: per-post rows missing or stale, fetch legacy blob.
        const { data:bpLegacyRows } = await sb.from("app_state").select("*").eq("key","blogPosts");
        const legacyArr = bpLegacyRows?.[0]?.value;
        bpRows = Array.isArray(legacyArr) ? [{ value: legacyArr }] : [];
      }
    }
    return { drvRows, logRows, statRows, histRows, prRows, rfRows, raRows, spRows, spxRows, spTruckRows, powerDriversXfinityRows, powerDriversTruckRows, prXfinityRows, prTruckRows, rfXfinityRows, rfTruckRows, rhXfinityRows, rhTruckRows, comboCupRows, comboXfinityRows, comboTruckRows, hubPredXfinityRows, hubPredTruckRows, btRows, dsRows, ddRows, qpRows, qpXfinityRows, qpTruckRows, bpRows };
  } catch(e) { console.error("SB load error:",e); return null; }
}

// Combo Power Score save: writes exactly ONE new key for the given
// series (powerComboCup / powerComboXfinity / powerComboTruck) and
// touches nothing else. Combo data never goes into the Cup drivers
// table or the legacy ratings keys, so production is unchanged.
export async function saveComboToSupabase(series, comboState) {
  if (!sb) return;
  const key = series === "cup" ? "powerComboCup" : series === "xfinity" ? "powerComboXfinity" : "powerComboTruck";
  try {
    await sb.from("app_state").upsert({ key, value: comboState }, { onConflict: "key" });
  } catch (e) { console.error("SB combo save error:", e); }
}

// Per-series Power Rankings save (lower series only; Cup keeps using
// saveToSupabase). Writes exactly the four keys for the given series and
// touches nothing else, so a lower-series apply can never corrupt Cup.
export async function savePowerToSupabase(series, { drivers, prevRanks, recentFinishes, ratingHistory }) {
  if (!sb) return;
  const suffix = series === "xfinity" ? "Xfinity" : "Truck";
  try {
    await sb.from("app_state").upsert({ key: `powerDrivers${suffix}`, value: drivers }, { onConflict: "key" });
    await sb.from("app_state").upsert({ key: `prevRanks${suffix}`, value: prevRanks }, { onConflict: "key" });
    await sb.from("app_state").upsert({ key: `recentFinishes${suffix}`, value: recentFinishes }, { onConflict: "key" });
    await sb.from("app_state").upsert({ key: `ratingHistory${suffix}`, value: ratingHistory }, { onConflict: "key" });
  } catch (e) { console.error("SB power save error:", e); }
}

export async function saveToSupabase(drivers, raceHistory, seasonStats, ratingHistory, prevRanks, recentFinishes, raceArchive) {
  if (!sb) return;
  try {
    await sb.from("drivers").upsert(drivers.map(d=>({num:d.num,name:d.name,team:d.team,mfg:d.mfg,overall:d.overall,superspeedway:d.superspeedway,intermediate:d.intermediate,short:d.short,road:d.road,rookie:d.rookie||false})),{onConflict:"num"});
    await sb.from("race_log").delete().neq("id",0);
    if (raceHistory.length>0) await sb.from("race_log").insert(raceHistory.map(r=>({race_name:r.race,track_type:r.trackType,race_date:r.race_date,top_finishers:r.topFinishers})));
    if (Object.keys(seasonStats).length>0) await sb.from("season_stats").upsert(Object.entries(seasonStats).map(([num,s])=>({num,races:s.races,total_fin:s.totalFin,total_st:s.totalSt,wins:s.wins,t5:s.t5,t10:s.t10,led:s.led,best:s.best,dnf:s.dnf})),{onConflict:"num"});
    await sb.from("rating_history").delete().neq("id",0);
    if (ratingHistory.length>0) await sb.from("rating_history").insert(ratingHistory.map(s=>({snapshot:s})));
    await sb.from("app_state").upsert({key:"prevRanks",value:prevRanks},{onConflict:"key"});
    await sb.from("app_state").upsert({key:"recentFinishes",value:recentFinishes},{onConflict:"key"});
    await sb.from("app_state").upsert({key:"raceArchive",value:raceArchive},{onConflict:"key"});
  } catch(e) { console.error("SB save error:",e); }
}
