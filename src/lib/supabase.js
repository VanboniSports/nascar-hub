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
    const [
      { data:drvRows },
      { data:logRows },
      { data:statRows },
      { data:histRows },
      { data:prRows },
      { data:rfRows },
      { data:raRows },
      { data:spRows },
      { data:btRows },
      { data:dsRows },
      { data:ddRows },
      { data:qpRows },
      { data:bpPostRows },
      { data:bpLegacyMeta },
    ] = await Promise.all([
      sb.from("drivers").select("*"),
      sb.from("race_log").select("*").order("created_at",{ascending:false}),
      sb.from("season_stats").select("*"),
      sb.from("rating_history").select("*").order("created_at",{ascending:true}),
      sb.from("app_state").select("*").eq("key","prevRanks"),
      sb.from("app_state").select("*").eq("key","recentFinishes"),
      sb.from("app_state").select("*").eq("key","raceArchive"),
      sb.from("app_state").select("*").eq("key","seasonPoints"),
      sb.from("app_state").select("*").eq("key","battleRaces"),
      sb.from("app_state").select("*").eq("key","dfsSalaries"),
      sb.from("app_state").select("*").eq("key","dfsDisabled"),
      sb.from("app_state").select("*").eq("key","dfsQualifying"),
      // Blog posts: one small row per post (blogpost:<id>). Falls back to the
      // legacy single blogPosts array row when per-post rows are absent or older.
      sb.from("app_state").select("*").like("key","blogpost:*"),
      // Legacy row: fetch ONLY its timestamp for the freshness check. The old
      // ~9MB single-blob value is downloaded only if the fallback is needed.
      sb.from("app_state").select("key,updated_at").eq("key","blogPosts"),
    ]);
    const legacyTs = bpLegacyMeta?.[0]?.updated_at ? +new Date(bpLegacyMeta[0].updated_at) : 0;
    const perPostTs = (bpPostRows||[]).reduce((m,r)=>Math.max(m, r.updated_at ? +new Date(r.updated_at) : 0), 0);
    let bpRows;
    if (bpPostRows?.length && perPostTs >= legacyTs) {
      bpRows = [{ value: bpPostRows.map(r=>r.value) }];
    } else {
      // Rare fallback path: per-post rows missing or stale, fetch legacy blob.
      const { data:bpLegacyRows } = await sb.from("app_state").select("*").eq("key","blogPosts");
      const legacyArr = bpLegacyRows?.[0]?.value;
      bpRows = Array.isArray(legacyArr) ? [{ value: legacyArr }] : [];
    }
    return { drvRows, logRows, statRows, histRows, prRows, rfRows, raRows, spRows, btRows, dsRows, ddRows, qpRows, bpRows };
  } catch(e) { console.error("SB load error:",e); return null; }
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
