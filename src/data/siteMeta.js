// Static site metadata / color maps / config lists. Extracted from NASCARHub.jsx (phase 2).
export const PREDICTORS = ["Pure Stats", "Enhanced Pure Stats", "Power Rankings", "My Gut"];


export const PREDICTOR_DESCRIPTIONS = {
  "Pure Stats": "Track-type weighted statistics, no ML",
  "Enhanced Pure Stats": "Pure Stats + manufacturer affinity, momentum & playoff adjustments",
  "Power Rankings": "Live power rankings from the NASCAR Hub",
  "My Gut": "Personal picks based on intuition & race knowledge",
};

// ─────────────────────────────────────────────────────────────
// TOOL USAGE TRACKING — keys for per-tool counters
// ─────────────────────────────────────────────────────────────


export const PREDICTOR_COLORS = {
  "Pure Stats": "#f59e0b",
  "Enhanced Pure Stats": "#e879f9",
  "Power Rankings": "#10b981",
  "My Gut": "#f43f5e",
};


export const BATTLE_TRACK_COLORS = {
  "Intermediate": "#f59e0b",
  "Road Course": "#10b981",
  "Short Track": "#ef4444",
  "Superspeedway": "#3b82f6",
  "Dirt": "#b45309",
};

// ─────────────────────────────────────────────────────────────
// BLOG CATEGORIES & COLORS
// ─────────────────────────────────────────────────────────────


export const MFG_COLORS = { Chevrolet:"#f59e0b", Ford:"#3b82f6", Toyota:"#ef4444" };

// ─────────────────────────────────────────────────────────────
// PREDICTOR BATTLE CONSTANTS
// ─────────────────────────────────────────────────────────────


export const H2H_COLORS = ["#1e90ff","#ef4444","#22c55e","#a855f7"];

// 2026 Team Roster


export const BLOG_CATEGORIES = ["Race Recaps", "DFS Picks & Strategy", "Weekly Predictions", "1/75", "General"];


export const BLOG_CAT_COLORS = {
  "Race Recaps": "#3b82f6",
  "DFS Picks & Strategy": "#22c55e",
  "Weekly Predictions": "#f97316",
  "1/75": "#d4a017",
  "General": "#6b7280",
};

// ─────────────────────────────────────────────────────────────
// SUPABASE
// ─────────────────────────────────────────────────────────────


export const TOOL_USAGE_KEYS = [
  { key:"race_predictor",    label:"Race Predictor",       type:"action" },
  { key:"this_week_predict", label:"This Week Quick Predict", type:"action" },
  { key:"track_lookup",      label:"Track Stats Lookup",   type:"action" },
  { key:"track_leaderboard", label:"Track Leaderboard",    type:"view"   },
  { key:"driver_h2h",        label:"Driver Head-to-Head",  type:"action" },
  { key:"team_h2h",          label:"Team Head-to-Head",    type:"action" },
  { key:"sleeper_detector",  label:"Sleeper Detector",     type:"action" },
  { key:"good_bad_day",      label:"Good Day / Bad Day",   type:"action" },
  { key:"power_rankings",    label:"Power Rankings",       type:"view"   },
  { key:"season_stats",      label:"Season Stats",         type:"view"   },
  { key:"battle_tracker",    label:"Battle Tracker",       type:"view"   },
  { key:"scorecard",         label:"Model Scorecard",        type:"view"   },
  { key:"pr_trends",         label:"PR Trends",            type:"view"   },
  { key:"pr_compare",        label:"PR Compare",           type:"view"   },
  { key:"driver_analytics",  label:"Driver Analytics",     type:"view"   },
  { key:"mfg_trends",        label:"Manufacturer Trends",  type:"view"   },
  { key:"dfs_optimizer",     label:"DFS Optimizer",        type:"action" },
  { key:"blog",              label:"Blog",                 type:"view"   },
  { key:"blog_post",         label:"Blog Post View",       type:"view",  hidden:true },
];


export const CSV_TRACK_TYPES = {"Bristol Motor Speedway":"Short Track","Martinsville Speedway":"Short Track","Richmond Raceway":"Short Track","New Hampshire Motor Speedway":"Short Track","Iowa Speedway":"Short Track","North Wilkesboro Speedway":"Short Track","Circuit Of The Americas":"Road Course","Sonoma Raceway":"Road Course","Road America":"Road Course","Watkins Glen International Raceway":"Road Course","Chicago Street Course":"Road Course","Autodromo Hermanos Rodriguez":"Road Course","Naval Base Coronado Street Course":"Road Course","Charlotte Motor Speedway":"Intermediate","Kansas Speedway":"Intermediate","Las Vegas Motor Speedway":"Intermediate","Michigan International Speedway":"Intermediate","Texas Motor Speedway":"Intermediate","Homestead-Miami Speedway":"Intermediate","Nashville Superspeedway":"Intermediate","Dover International Speedway":"Intermediate","Phoenix Raceway":"Intermediate","Pocono Raceway":"Intermediate","World Wide Technology Raceway":"Intermediate","Darlington Raceway":"Intermediate","Autoclub Speedway":"Intermediate","Echopark Speedway":"Superspeedway","Chicagoland Speedway":"Intermediate","Indianapolis Motor Speedway":"Road Course","Daytona International Speedway":"Superspeedway","Talladega Superspeedway":"Superspeedway","Watkins Glen International":"Road Course","Charlotte Motor Speedway (ROVAL)":"Road Course","Bristol Motor Speedway (DIRT)":"Dirt"};


export const CSV_TYPE_COLORS = {"Road Course":"#a855f7","Short Track":"#ef4444","Intermediate":"#3b82f6","Superspeedway":"#22c55e","Dirt":"#b45309","Unknown":"#555"};


export const LB_RANK_COLORS = { elite:"#ffc107", good:"#4caf50", mid:"#6a9bbf", poor:"#f59e0b", bad:"#f44336" };


export const LB_SORT_CONFIGS = {
  avgFinish:{lowerBetter:true},avgStart:{lowerBetter:true},wins:{lowerBetter:false},
  top5:{lowerBetter:false},top10:{lowerBetter:false},lapsLed:{lowerBetter:false},
  bestFinish:{lowerBetter:true},races:{lowerBetter:false},driver:{lowerBetter:true},
};

// Full-time 2026 driver names for filtering the leaderboard


// ─────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────

export const DFS_PLATFORMS = {
  dk: {
    id: "dk", name: "DraftKings", abbr: "DK",
    color: "#FF6600", colorSoft: "rgba(255,102,0,0.10)",
    colorGlow: "rgba(255,102,0,0.22)",
    rosterSize: 6, salaryCap: 50000, salaryLabel: "$50,000",
  },
  fd: {
    id: "fd", name: "FanDuel", abbr: "FD",
    color: "#1493FF", colorSoft: "rgba(20,147,255,0.10)",
    colorGlow: "rgba(20,147,255,0.22)",
    rosterSize: 5, salaryCap: 50000, salaryLabel: "$50,000",
  },
};
