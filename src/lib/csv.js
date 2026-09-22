// ───────────────────────────────────────────────────────────
// CSV PARSING - extracted from NASCARHub.jsx (phase 1)
// ───────────────────────────────────────────────────────────
import { normalizeCsvDriverName, INITIAL_DRIVERS } from "../data/drivers.js";

export function parseCSVData(csvText) {
  // Proper CSV parser that handles quoted fields (e.g., "Ricky Stenhouse,")
  function parseCSVLine(line) {
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = false; }
        } else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { fields.push(current.trim()); current = ""; }
        else { current += ch; }
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  if (lines.length < 2) return [];
  const header = parseCSVLine(lines[0]);
  const colIdx = {};
  header.forEach((h, i) => { colIdx[h] = i; });
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseCSVLine(lines[i]);
    if (vals.length < header.length) continue;
    const driverName = normalizeCsvDriverName(vals[colIdx["driver_name"]] || "");
    const raceName = vals[colIdx["race_name"]] || "";
    let trackName = vals[colIdx["track_name"]] || "";
    // Differentiate Charlotte Roval (October) from Charlotte Oval (May)
    if (trackName === "Charlotte Motor Speedway" && /october/i.test(raceName)) trackName = "Charlotte Motor Speedway (ROVAL)";
    // Differentiate Bristol Dirt (April 2022) from regular Bristol
    if (trackName === "Bristol Motor Speedway" && /dirt/i.test(raceName)) trackName = "Bristol Motor Speedway (DIRT)";
    const year = parseInt(vals[colIdx["year"]]) || 0;
    const finish = parseInt(vals[colIdx["finish_position"]]) || 0;
    const start = parseInt(vals[colIdx["starting_position"]]) || 0;
    const lapsLed = parseInt(vals[colIdx["laps_led"]]) || 0;
    const manufacturer = (() => {
      const raw = (vals[colIdx["manufacturer"]] || "").trim();
      if (raw === "Chevy") return "Chevrolet";
      if (["Chevrolet","Ford","Toyota"].includes(raw)) return raw;
      const lookup = INITIAL_DRIVERS.find(d => d.name === driverName);
      if (lookup?.mfg) return lookup.mfg;
      return "";
    })();
    const lapsCompleted = parseInt(vals[colIdx["laps_completed"]]) || 0;
    const raceDate = vals[colIdx["race_date"]] || "";
    const status = vals[colIdx["status"]] || "Running";
    // Loop-data (DriverAverages) columns, appended 2026-09-21. All are
    // post-race stats: only use them as lagged features (completed races).
    const num = (name, isFloat) => {
      const raw = colIdx[name] == null ? "" : (vals[colIdx[name]] || "");
      const v = isFloat ? parseFloat(raw) : parseInt(raw);
      return Number.isFinite(v) ? v : 0;
    };
    const fastestLaps      = num("fastest_laps");
    const raceTotalLaps    = num("total_laps");
    const passDifferential = num("pass_differential");
    const qualityPasses    = num("quality_passes");
    const driverRating     = num("driver_rating", true);
    const avgRunningPos    = num("avg_running_position", true);
    const midRunningPos    = num("mid_running_position", true);
    const closerRunningPos = num("closer_running_position", true);
    const bestRunningPos   = num("best_running_position");
    const worstRunningPos  = num("worst_running_position");
    const greenFlagPasses  = num("green_flag_passes");
    const greenFlagPassed  = num("green_flag_times_passed");
    const lapsInTop15      = num("laps_in_top_15");
    const lapsInTop15Pct   = num("laps_in_top_15_pct", true);
    const lapsLedPct       = num("laps_led_pct", true);
    rows.push([driverName, trackName, year, finish, start, lapsLed, 1, manufacturer, lapsCompleted, raceDate, status,
      fastestLaps, raceTotalLaps, passDifferential, qualityPasses, driverRating, avgRunningPos,
      midRunningPos, closerRunningPos, bestRunningPos, worstRunningPos,
      greenFlagPasses, greenFlagPassed, lapsInTop15, lapsInTop15Pct, lapsLedPct]);
  }
  return rows;
}