// 2026 Cup Series schedule + "this week" helper. Extracted from NASCARHub.jsx (phase 2).
export const SCHEDULE_YEAR = 2026;
export const SCHEDULE = [
  { week:1,  date:"Feb 15", name:"Daytona 500",            track:"Daytona International Speedway",      type:"superspeedway", length:2.5,   laps:200 },
  { week:2,  date:"Feb 22", name:"Atlanta",                 track:"Atlanta Motor Speedway",              type:"superspeedway", length:1.54,  laps:260 },
  { week:3,  date:"Mar 1",  name:"COTA",                    track:"Circuit Of The Americas",             type:"road",          length:3.426, laps:68  },
  { week:4,  date:"Mar 8",  name:"Phoenix",                 track:"Phoenix Raceway",                     type:"intermediate",  length:1.0,   laps:312 },
  { week:5,  date:"Mar 15", name:"Las Vegas",               track:"Las Vegas Motor Speedway",            type:"intermediate",  length:1.5,   laps:267 },
  { week:6,  date:"Mar 22", name:"Darlington",              track:"Darlington Raceway",                  type:"intermediate",  length:1.366, laps:293 },
  { week:7,  date:"Mar 29", name:"Martinsville",            track:"Martinsville Speedway",               type:"short",         length:0.526, laps:500 },
  { week:8,  date:"Apr 12", name:"Bristol",                  track:"Bristol Motor Speedway",              type:"short",         length:0.533, laps:500 },
  { week:9,  date:"Apr 19", name:"Kansas",                   track:"Kansas Speedway",                     type:"intermediate",  length:1.5,   laps:267 },
  { week:10, date:"Apr 26", name:"Talladega",                track:"Talladega Superspeedway",             type:"superspeedway", length:2.66,  laps:188 },
  { week:11, date:"May 3",  name:"Texas",                    track:"Texas Motor Speedway",                type:"intermediate",  length:1.5,   laps:334 },
  { week:12, date:"May 10", name:"Watkins Glen",             track:"Watkins Glen International Raceway",  type:"road",          length:2.45,  laps:90  },
  { week:0,  date:"May 17", name:"All-Star Race (Dover)",    track:"Dover International Speedway",        type:"intermediate",  length:1.0,   laps:200, allStar:true },
  { week:13, date:"May 24", name:"Coca-Cola 600",            track:"Charlotte Motor Speedway",            type:"intermediate",  length:1.5,   laps:400 },
  { week:14, date:"May 31", name:"Nashville",                track:"Nashville Superspeedway",             type:"intermediate",  length:1.33,  laps:300 },
  { week:15, date:"Jun 7",  name:"Michigan",                 track:"Michigan International Speedway",     type:"intermediate",  length:2.0,   laps:200 },
  { week:16, date:"Jun 14", name:"Pocono",                   track:"Pocono Raceway",                      type:"intermediate",  length:2.5,   laps:160 },
  { week:17, date:"Jun 21", name:"San Diego",                track:"Naval Base Coronado Street Course",   type:"road",          length:2.0,   laps:75  },
  { week:18, date:"Jun 28", name:"Sonoma",                   track:"Sonoma Raceway",                      type:"road",          length:1.99,  laps:110 },
  { week:19, date:"Jul 5",  name:"Chicagoland",              track:"Chicagoland Speedway",                type:"intermediate",  length:1.5,   laps:267 },
  { week:20, date:"Jul 12", name:"Atlanta II",               track:"Atlanta Motor Speedway",              type:"superspeedway", length:1.54,  laps:260 },
  { week:21, date:"Jul 19", name:"North Wilkesboro",         track:"North Wilkesboro Speedway",           type:"short",         length:0.625, laps:400 },
  { week:22, date:"Jul 26", name:"Brickyard 400",            track:"Indianapolis Motor Speedway",         type:"intermediate",  length:2.5,   laps:160 },
  { week:23, date:"Aug 9",  name:"Iowa",                     track:"Iowa Speedway",                       type:"short",         length:0.875, laps:350 },
  { week:24, date:"Aug 15", name:"Richmond",                 track:"Richmond Raceway",                    type:"short",         length:0.75,  laps:400 },
  { week:25, date:"Aug 23", name:"New Hampshire",            track:"New Hampshire Motor Speedway",        type:"short",         length:1.058, laps:301 },
  { week:26, date:"Aug 29", name:"Daytona II",               track:"Daytona International Speedway",      type:"superspeedway", length:2.5,   laps:160 },
  { week:27, date:"Sep 6",  name:"Southern 500",             track:"Darlington Raceway",                  type:"intermediate",  length:1.366, laps:367 },
  { week:28, date:"Sep 13", name:"Gateway",                  track:"World Wide Technology Raceway",       type:"intermediate",  length:1.25,  laps:240 },
  { week:29, date:"Sep 19", name:"Bristol Night Race",       track:"Bristol Motor Speedway",              type:"short",         length:0.533, laps:500 },
  { week:30, date:"Sep 27", name:"Kansas II",                track:"Kansas Speedway",                     type:"intermediate",  length:1.5,   laps:267 },
  { week:31, date:"Oct 4",  name:"Las Vegas II",             track:"Las Vegas Motor Speedway",            type:"intermediate",  length:1.5,   laps:267 },
  { week:32, date:"Oct 11", name:"Charlotte Oval",           track:"Charlotte Motor Speedway",            type:"intermediate",  length:1.5,   laps:334 },
  { week:33, date:"Oct 18", name:"Phoenix II",               track:"Phoenix Raceway",                     type:"intermediate",  length:1.0,   laps:312 },
  { week:34, date:"Oct 25", name:"Talladega II",             track:"Talladega Superspeedway",             type:"superspeedway", length:2.66,  laps:188 },
  { week:35, date:"Nov 1",  name:"Martinsville II",          track:"Martinsville Speedway",               type:"short",         length:0.526, laps:500 },
  { week:36, date:"Nov 8",  name:"Championship",             track:"Homestead-Miami Speedway",            type:"intermediate",  length:1.5,   laps:267 },
];

// ─────────────────────────────────────────────────────────────
// THIS WEEK'S RACE — determine next upcoming race
// ─────────────────────────────────────────────────────────────


export function getThisWeeksRace() {
  const now = new Date();
  const yr = 2026;
  for (const r of SCHEDULE) {
    // Parse "Feb 15" → Date(2026, month, day) — race day at 11:59 PM to include race day
    const parts = r.date.split(" ");
    const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    const m = months[parts[0]];
    const d = parseInt(parts[1]);
    if (m == null || isNaN(d)) continue;
    const raceDate = new Date(yr, m, d, 23, 59, 59);
    if (raceDate >= now) return { ...r, raceDate };
  }
  // If season is over, return last race
  return { ...SCHEDULE[SCHEDULE.length - 1], raceDate: new Date(yr, 10, 8, 23, 59, 59) };
}

// ─────────────────────────────────────────────────────────────
// CSV DATA LAYER — shared across Track Stats tools
// ─────────────────────────────────────────────────────────────
