// 2026 NASCAR Craftsman Truck Series schedule + "this week" helper.
// Same shape as src/data/schedule.js (Cup). Track names match the
// nascar_scraped_data_trucks.csv spellings exactly. Track types use the
// Cup vocabulary: superspeedway / intermediate / short / road.
// Past vs upcoming is derived from the date, same as the Cup helper.
// Laps are scheduled distances (not overtime-inflated actuals).
// Dates for completed races are actual run dates from the dataset
// (Charlotte ran May 24 and Richmond Aug 15 after postponements).
export const SCHEDULE_YEAR_TRUCK = 2026;
export const SCHEDULE_TRUCK = [
  { week:1,  date:"Feb 13", name:"Daytona",          track:"Daytona International Speedway",      type:"superspeedway", length:2.5,   laps:100 },
  { week:2,  date:"Feb 21", name:"Atlanta",          track:"Echopark Speedway",                   type:"superspeedway", length:1.54,  laps:135 },
  { week:3,  date:"Feb 28", name:"St. Petersburg",   track:"St. Petersburg Street Course",        type:"road",          length:1.8,   laps:80  },
  { week:4,  date:"Mar 20", name:"Darlington",       track:"Darlington Raceway",                  type:"intermediate",  length:1.366, laps:150 },
  { week:5,  date:"Apr 3",  name:"Rockingham",       track:"Rockingham Speedway",                 type:"intermediate",  length:0.94,  laps:200 },
  { week:6,  date:"Apr 10", name:"Bristol",          track:"Bristol Motor Speedway",              type:"short",         length:0.533, laps:250 },
  { week:7,  date:"May 1",  name:"Texas",            track:"Texas Motor Speedway",                type:"intermediate",  length:1.5,   laps:167 },
  { week:8,  date:"May 8",  name:"Watkins Glen",     track:"Watkins Glen International Raceway",  type:"road",          length:2.45,  laps:72  },
  { week:9,  date:"May 15", name:"Dover",            track:"Dover International Speedway",        type:"intermediate",  length:1.0,   laps:200 },
  { week:10, date:"May 24", name:"Charlotte",        track:"Charlotte Motor Speedway",            type:"intermediate",  length:1.5,   laps:134 },
  { week:11, date:"May 29", name:"Nashville",        track:"Nashville Superspeedway",             type:"intermediate",  length:1.33,  laps:150 },
  { week:12, date:"Jun 6",  name:"Michigan",         track:"Michigan International Speedway",     type:"intermediate",  length:2.0,   laps:125 },
  { week:13, date:"Jun 19", name:"San Diego",        track:"Naval Base Coronado Street Course",   type:"road",          length:3.4,   laps:50  },
  { week:14, date:"Jul 11", name:"Lime Rock",        track:"Lime Rock Park",                      type:"road",          length:1.53,  laps:100 },
  { week:15, date:"Jul 18", name:"North Wilkesboro", track:"North Wilkesboro Speedway",           type:"short",         length:0.625, laps:250 },
  { week:16, date:"Jul 24", name:"IRP",              track:"Lucas Oil Indianapolis Raceway Park", type:"short",         length:0.686, laps:200 },
  { week:17, date:"Aug 15", name:"Richmond",         track:"Richmond Raceway",                    type:"short",         length:0.75,  laps:250 },
  { week:18, date:"Aug 22", name:"New Hampshire",    track:"New Hampshire Motor Speedway",        type:"short",         length:1.058, laps:175 },
  { week:19, date:"Sep 17", name:"Bristol II",       track:"Bristol Motor Speedway",              type:"short",         length:0.533, laps:250 },
  { week:20, date:"Sep 26", name:"Kansas",           track:"Kansas Speedway",                     type:"intermediate",  length:1.5,   laps:134 },
  { week:21, date:"Oct 9",  name:"Charlotte Roval",  track:"Charlotte Motor Speedway (ROVAL)",    type:"road",          length:2.32,  laps:134 },
  { week:22, date:"Oct 16", name:"Phoenix",          track:"Phoenix Raceway",                     type:"intermediate",  length:1.0,   laps:150 },
  { week:23, date:"Oct 23", name:"Talladega",        track:"Talladega Superspeedway",             type:"superspeedway", length:2.66,  laps:94,  practice:null, qualifying:"Fri Oct 23, 12:30 PM ET", raceTime:"4:00 PM ET" },
  { week:24, date:"Oct 30", name:"Martinsville",     track:"Martinsville Speedway",               type:"short",         length:0.526, laps:200, practice:"Fri Oct 30, 12:30 PM ET", qualifying:"Fri Oct 30, 1:35 PM ET", raceTime:"6:00 PM ET" },
  { week:25, date:"Nov 6",  name:"Championship",     track:"Homestead-Miami Speedway",            type:"intermediate",  length:1.5,   laps:134, practice:"Thu Nov 5, 6:30 PM ET", qualifying:"Fri Nov 6, 2:30 PM ET", raceTime:"7:30 PM ET" },
];

// ─────────────────────────────────────────────────────────────
// THIS WEEK'S RACE — determine next upcoming race
// ─────────────────────────────────────────────────────────────

export function getThisWeeksRaceTruck() {
  const now = new Date();
  const yr = 2026;
  for (const r of SCHEDULE_TRUCK) {
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
  return { ...SCHEDULE_TRUCK[SCHEDULE_TRUCK.length - 1], raceDate: new Date(yr, 10, 6, 23, 59, 59) };
}
