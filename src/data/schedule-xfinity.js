// 2026 O'Reilly Auto Parts Series schedule + "this week" helper.
// Same shape as src/data/schedule.js (Cup). Track names match the
// nascar_scraped_data_xfinity.csv spellings exactly. Track types use the
// Cup vocabulary: superspeedway / intermediate / short / road.
// Past vs upcoming is derived from the date, same as the Cup helper.
// Laps are scheduled distances (not overtime-inflated actuals).
// Dates for completed races are actual run dates from the dataset.
export const SCHEDULE_YEAR_XFINITY = 2026;
export const SCHEDULE_XFINITY = [
  { week:1,  date:"Feb 14", name:"Daytona",          track:"Daytona International Speedway",      type:"superspeedway", length:2.5,   laps:120 },
  { week:2,  date:"Feb 21", name:"Atlanta",          track:"Echopark Speedway",                   type:"superspeedway", length:1.54,  laps:163 },
  { week:3,  date:"Feb 28", name:"COTA",             track:"Circuit Of The Americas",             type:"road",          length:3.426, laps:65  },
  { week:4,  date:"Mar 7",  name:"Phoenix",          track:"Phoenix Raceway",                     type:"intermediate",  length:1.0,   laps:200 },
  { week:5,  date:"Mar 14", name:"Las Vegas",        track:"Las Vegas Motor Speedway",            type:"intermediate",  length:1.5,   laps:200 },
  { week:6,  date:"Mar 21", name:"Darlington",       track:"Darlington Raceway",                  type:"intermediate",  length:1.366, laps:147 },
  { week:7,  date:"Mar 28", name:"Martinsville",     track:"Martinsville Speedway",               type:"short",         length:0.526, laps:250 },
  { week:8,  date:"Apr 4",  name:"Rockingham",       track:"Rockingham Speedway",                 type:"intermediate",  length:0.94,  laps:250 },
  { week:9,  date:"Apr 11", name:"Bristol",          track:"Bristol Motor Speedway",              type:"short",         length:0.533, laps:300 },
  { week:10, date:"Apr 18", name:"Kansas",           track:"Kansas Speedway",                   type:"intermediate",  length:1.5,   laps:200 },
  { week:11, date:"Apr 25", name:"Talladega",        track:"Talladega Superspeedway",             type:"superspeedway", length:2.66,  laps:113 },
  { week:12, date:"May 2",  name:"Texas",            track:"Texas Motor Speedway",              type:"intermediate",  length:1.5,   laps:200 },
  { week:13, date:"May 9",  name:"Watkins Glen",     track:"Watkins Glen International Raceway",  type:"road",          length:2.45,  laps:82  },
  { week:14, date:"May 16", name:"Dover",            track:"Dover International Speedway",        type:"intermediate",  length:1.0,   laps:200 },
  { week:15, date:"May 23", name:"Charlotte",        track:"Charlotte Motor Speedway",            type:"intermediate",  length:1.5,   laps:200 },
  { week:16, date:"May 30", name:"Nashville",        track:"Nashville Superspeedway",             type:"intermediate",  length:1.33,  laps:188 },
  { week:17, date:"Jun 13", name:"Pocono",           track:"Pocono Raceway",                      type:"intermediate",  length:2.5,   laps:100 },
  { week:18, date:"Jun 20", name:"San Diego",        track:"Naval Base Coronado Street Course",   type:"road",          length:3.4,   laps:60  },
  { week:19, date:"Jun 27", name:"Sonoma",           track:"Sonoma Raceway",                      type:"road",          length:1.99,  laps:79  },
  { week:20, date:"Jul 4",  name:"Chicagoland",      track:"Chicagoland Speedway",                type:"intermediate",  length:1.5,   laps:200 },
  { week:21, date:"Jul 11", name:"Atlanta II",       track:"Echopark Speedway",                   type:"superspeedway", length:1.54,  laps:163 },
  { week:22, date:"Jul 25", name:"Indianapolis",     track:"Indianapolis Motor Speedway",         type:"intermediate",  length:2.5,   laps:100 },
  { week:23, date:"Aug 8",  name:"Iowa",             track:"Iowa Speedway",                       type:"short",         length:0.875, laps:250 },
  { week:24, date:"Aug 28", name:"Daytona II",       track:"Daytona International Speedway",      type:"superspeedway", length:2.5,   laps:100 },
  { week:25, date:"Sep 5",  name:"Darlington II",    track:"Darlington Raceway",                  type:"intermediate",  length:1.366, laps:147 },
  { week:26, date:"Sep 12", name:"Gateway",          track:"World Wide Technology Raceway",       type:"intermediate",  length:1.25,  laps:160 },
  { week:27, date:"Sep 18", name:"Bristol II",       track:"Bristol Motor Speedway",              type:"short",         length:0.533, laps:300 },
  { week:28, date:"Oct 3",  name:"Las Vegas II",     track:"Las Vegas Motor Speedway",            type:"intermediate",  length:1.5,   laps:200 },
  { week:29, date:"Oct 10", name:"Charlotte Roval",  track:"Charlotte Motor Speedway (ROVAL)",    type:"road",          length:2.32,  laps:67  },
  { week:30, date:"Oct 17", name:"Phoenix II",       track:"Phoenix Raceway",                     type:"intermediate",  length:1.0,   laps:200 },
  { week:31, date:"Oct 24", name:"Talladega II",     track:"Talladega Superspeedway",             type:"superspeedway", length:2.66,  laps:113 },
  { week:32, date:"Oct 31", name:"Martinsville II",  track:"Martinsville Speedway",               type:"short",         length:0.526, laps:250 },
  { week:33, date:"Nov 7",  name:"Championship",     track:"Homestead-Miami Speedway",            type:"intermediate",  length:1.5,   laps:200 },
];

// ─────────────────────────────────────────────────────────────
// THIS WEEK'S RACE — determine next upcoming race
// ─────────────────────────────────────────────────────────────

export function getThisWeeksRaceXfinity() {
  const now = new Date();
  const yr = 2026;
  for (const r of SCHEDULE_XFINITY) {
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
  return { ...SCHEDULE_XFINITY[SCHEDULE_XFINITY.length - 1], raceDate: new Date(yr, 10, 7, 23, 59, 59) };
}
