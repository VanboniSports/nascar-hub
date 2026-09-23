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
    const { data:drvRows } = await sb.from("drivers").select("*");
    const { data:logRows } = await sb.from("race_log").select("*").order("created_at",{ascending:false});
    const { data:statRows } = await sb.from("season_stats").select("*");
    const { data:histRows } = await sb.from("rating_history").select("*").order("created_at",{ascending:true});
    const { data:prRows }   = await sb.from("app_state").select("*").eq("key","prevRanks");
    const { data:rfRows }   = await sb.from("app_state").select("*").eq("key","recentFinishes");
    const { data:raRows }   = await sb.from("app_state").select("*").eq("key","raceArchive");
    const { data:spRows }   = await sb.from("app_state").select("*").eq("key","seasonPoints");
    const { data:btRows }   = await sb.from("app_state").select("*").eq("key","battleRaces");
    const { data:dsRows }   = await sb.from("app_state").select("*").eq("key","dfsSalaries");
    const { data:ddRows }   = await sb.from("app_state").select("*").eq("key","dfsDisabled");
    const { data:qpRows }   = await sb.from("app_state").select("*").eq("key","dfsQualifying");
    const { data:bpRows }   = await sb.from("app_state").select("*").eq("key","blogPosts");
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
