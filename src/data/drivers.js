// ───────────────────────────────────────────────────────────
// DRIVER DATA - extracted from NASCARHub.jsx (phase 1 module split)
// ───────────────────────────────────────────────────────────
export const TRACK_KEYS = ["overall","superspeedway","intermediate","short","road"];

// ─────────────────────────────────────────────────────────────
// INITIAL DRIVERS — 36 full-time 2026
// ─────────────────────────────────────────────────────────────
export const INITIAL_DRIVERS = [
  { num:"5",  name:"Kyle Larson",           team:"Hendrick Motorsports",      mfg:"Chevrolet", overall:95, superspeedway:88, intermediate:97, short:98, road:89 },
  { num:"24", name:"William Byron",         team:"Hendrick Motorsports",      mfg:"Chevrolet", overall:91, superspeedway:86, intermediate:94, short:90, road:85 },
  { num:"11", name:"Denny Hamlin",          team:"Joe Gibbs Racing",          mfg:"Toyota",    overall:90, superspeedway:84, intermediate:89, short:96, road:83 },
  { num:"20", name:"Christopher Bell",      team:"Joe Gibbs Racing",          mfg:"Toyota",    overall:89, superspeedway:82, intermediate:89, short:97, road:84 },
  { num:"45", name:"Tyler Reddick",         team:"23XI Racing",               mfg:"Toyota",    overall:89, superspeedway:84, intermediate:90, short:88, road:91 },
  { num:"9",  name:"Chase Elliott",         team:"Hendrick Motorsports",      mfg:"Chevrolet", overall:88, superspeedway:82, intermediate:87, short:86, road:93 },
  { num:"12", name:"Ryan Blaney",           team:"Team Penske",               mfg:"Ford",      overall:87, superspeedway:96, intermediate:86, short:82, road:85 },
  { num:"22", name:"Joey Logano",           team:"Team Penske",               mfg:"Ford",      overall:86, superspeedway:92, intermediate:87, short:81, road:81 },
  { num:"97", name:"Shane van Gisbergen",   team:"Trackhouse Racing",         mfg:"Chevrolet", overall:85, superspeedway:68, intermediate:79, short:76, road:99 },
  { num:"54", name:"Ty Gibbs",              team:"Joe Gibbs Racing",          mfg:"Toyota",    overall:80, superspeedway:76, intermediate:82, short:81, road:76 },
  { num:"1",  name:"Ross Chastain",         team:"Trackhouse Racing",         mfg:"Chevrolet", overall:78, superspeedway:72, intermediate:82, short:75, road:85 },
  { num:"48", name:"Alex Bowman",           team:"Hendrick Motorsports",      mfg:"Chevrolet", overall:77, superspeedway:74, intermediate:79, short:75, road:75 },
  { num:"16", name:"AJ Allmendinger",       team:"Kaulig Racing",             mfg:"Chevrolet", overall:76, superspeedway:68, intermediate:73, short:74, road:90 },
  { num:"6",  name:"Brad Keselowski",       team:"RFK Racing",                mfg:"Ford",      overall:75, superspeedway:80, intermediate:76, short:72, road:71 },
  { num:"17", name:"Chris Buescher",        team:"RFK Racing",                mfg:"Ford",      overall:74, superspeedway:76, intermediate:75, short:70, road:79 },
  { num:"88", name:"Connor Zilisch",        team:"Trackhouse Racing",         mfg:"Chevrolet", overall:73, superspeedway:65, intermediate:72, short:70, road:89, rookie:true },
  { num:"19", name:"Chase Briscoe",         team:"Joe Gibbs Racing",          mfg:"Toyota",    overall:72, superspeedway:78, intermediate:70, short:74, road:75 },
  { num:"23", name:"Bubba Wallace",         team:"23XI Racing",               mfg:"Toyota",    overall:71, superspeedway:75, intermediate:70, short:68, road:71 },
  { num:"2",  name:"Austin Cindric",        team:"Team Penske",               mfg:"Ford",      overall:70, superspeedway:85, intermediate:68, short:62, road:71 },
  { num:"43", name:"Erik Jones",            team:"Legacy Motor Club",         mfg:"Toyota",    overall:70, superspeedway:72, intermediate:71, short:68, road:68 },
  { num:"71", name:"Michael McDowell",      team:"Spire Motorsports",         mfg:"Chevrolet", overall:70, superspeedway:82, intermediate:68, short:65, road:69 },
  { num:"21", name:"Josh Berry",            team:"Wood Brothers Racing",      mfg:"Ford",      overall:69, superspeedway:70, intermediate:74, short:66, road:65 },
  { num:"47", name:"Ricky Stenhouse Jr",    team:"JTG Daugherty Racing",      mfg:"Chevrolet", overall:69, superspeedway:78, intermediate:68, short:66, road:67 },
  { num:"7",  name:"Daniel Suarez",         team:"Spire Motorsports",         mfg:"Chevrolet", overall:68, superspeedway:65, intermediate:70, short:67, road:69 },
  { num:"60", name:"Ryan Preece",           team:"RFK Racing",                mfg:"Ford",      overall:68, superspeedway:72, intermediate:68, short:66, road:67 },
  { num:"41", name:"Cole Custer",           team:"Haas Factory Team",         mfg:"Ford",      overall:67, superspeedway:64, intermediate:68, short:68, road:67 },
  { num:"42", name:"John Hunter Nemechek",  team:"Legacy Motor Club",         mfg:"Toyota",    overall:66, superspeedway:68, intermediate:66, short:64, road:64 },
  { num:"77", name:"Carson Hocevar",        team:"Spire Motorsports",         mfg:"Chevrolet", overall:66, superspeedway:68, intermediate:66, short:64, road:64 },
  { num:"4",  name:"Noah Gragson",          team:"Front Row Motorsports",     mfg:"Ford",      overall:65, superspeedway:68, intermediate:64, short:63, road:63 },
  { num:"38", name:"Zane Smith",            team:"Front Row Motorsports",     mfg:"Ford",      overall:64, superspeedway:67, intermediate:64, short:62, road:61 },
  { num:"35", name:"Riley Herbst",          team:"23XI Racing",               mfg:"Toyota",    overall:63, superspeedway:66, intermediate:62, short:61, road:62 },
  { num:"33", name:"Austin Hill",           team:"Richard Childress Racing",  mfg:"Chevrolet", overall:63, superspeedway:66, intermediate:63, short:62, road:60 },
  { num:"3",  name:"Austin Dillon",         team:"Richard Childress Racing",  mfg:"Chevrolet", overall:62, superspeedway:58, intermediate:64, short:63, road:57 },
  { num:"34", name:"Todd Gilliland",        team:"Front Row Motorsports",     mfg:"Ford",      overall:60, superspeedway:64, intermediate:60, short:58, road:56 },
  { num:"10", name:"Ty Dillon",             team:"Kaulig Racing",             mfg:"Chevrolet", overall:58, superspeedway:60, intermediate:58, short:57, road:56 },
  { num:"51", name:"Cody Ware",             team:"Rick Ware Racing",          mfg:"Chevrolet", overall:50, superspeedway:52, intermediate:50, short:48, road:48 },
];

export const FULL_TIMER_NAMES = INITIAL_DRIVERS.map(d => d.name);

// CSV name aliases — maps quirky CSV names to canonical INITIAL_DRIVERS names.
// Canonical form: juniors end with "Jr" (no period). Run name through
// normalizeCsvDriverName before any lookup against INITIAL_DRIVERS.
export const CSV_NAME_ALIASES = {
  "Ricky Stenhouse,":    "Ricky Stenhouse Jr",
  "Ricky Stenhouse":     "Ricky Stenhouse Jr",
  "Ricky Stenhouse Jr.": "Ricky Stenhouse Jr",
  "Martin Truex,":       "Martin Truex Jr",
  "Martin Truex":        "Martin Truex Jr",
  "Martin Truex Jr.":    "Martin Truex Jr",
  "Dale Earnhardt Jr.":  "Dale Earnhardt Jr",
  "John H.":             "John Hunter Nemechek",
  "John H. Nemechek":    "John Hunter Nemechek",
  "Shane Van":           "Shane van Gisbergen",
  "Shane Van Gisbergen": "Shane van Gisbergen",
  "Shane van Gisbergen": "Shane van Gisbergen",
  "B.J. McLeod":         "BJ McLeod",
  "BJ McLeod":           "BJ McLeod",
  "Daniel Suárez":       "Daniel Suarez",
  "Daniel Suarez Jr":    "Daniel Suarez",
};

// Tracks names we've already warned about so the console doesn't flood
const _unknownDriverWarned = new Set();

// Normalize a CSV driver name:
//  1. Trim + strip "(I)" tags and stray trailing punctuation (excluding period)
//  2. Repair doubled-name scraping artifacts ("Kyle LarsonKyle Larson")
//  3. Strip trailing period after Jr / Sr  ("Jr." -> "Jr")
//  4. Apply explicit aliases for known CSV quirks
//  5. Warn once per unknown full-timer-looking name so new issues surface early
export function normalizeCsvDriverName(raw) {
  let name = (raw || "").trim();
  if (!name) return name;

  // Strip Unicode accents (e.g. "Suárez" → "Suarez", "Müller" → "Muller")
  name = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Strip " (I)" / "(I)" indicator tags
  name = name.replace(/\s*\(I\)\s*/g, "").trim();

  // Strip stray trailing punctuation EXCEPT a period (period may belong to Jr./Sr.)
  name = name.replace(/[,;:(\s]+$/g, "").trim();

  // Repair fully doubled names like "Kyle LarsonKyle Larson"
  const len = name.length;
  if (len >= 4) {
    for (let i = Math.floor(len / 3); i <= Math.ceil(len * 2 / 3); i++) {
      const left = name.substring(0, i);
      const right = name.substring(i);
      if (left === right) { name = left; break; }
    }
    // Partial doubles like "Tyler ReddickTyler"
    if (name.length === len) {
      const parts = name.split(" ");
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const m = last.match(/^([A-Z][a-z]+)([A-Z].*)$/);
        if (m) {
          const firstName = parts[0];
          if (m[2] === firstName || last.endsWith(firstName)) {
            parts[parts.length - 1] = m[1];
            name = parts.join(" ");
          }
        }
      }
    }
  }

  // Normalize Jr./Sr. -> Jr/Sr (canonical form has no trailing period)
  name = name.replace(/\b(Jr|Sr)\.\s*$/i, (_, suf) => suf.charAt(0).toUpperCase() + suf.slice(1).toLowerCase());

  // Apply explicit alias map
  if (CSV_NAME_ALIASES[name]) return CSV_NAME_ALIASES[name];

  // Warn once if a name looks like a full-timer but doesn't match INITIAL_DRIVERS.
  // Only flag normal "First Last" / "First Last Jr" patterns to avoid one-off spam.
  if (typeof FULL_TIMER_NAMES !== "undefined"
      && !FULL_TIMER_NAMES.includes(name)
      && !_unknownDriverWarned.has(name)
      && /^[A-Z][a-zA-Z'\-]+ [A-Z][a-zA-Z'\-]+( (Jr|Sr|II|III|IV))?$/.test(name)) {
    _unknownDriverWarned.add(name);
    console.warn("[normalizeCsvDriverName] Unknown driver name (no INITIAL_DRIVERS match, no alias):", name);
  }

  return name;
}
