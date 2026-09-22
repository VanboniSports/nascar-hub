// ───────────────────────────────────────────────────────────
// PASTE PARSER - extracted from NASCARHub.jsx (phase 1)
// ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// PASTE PARSER — ported from original
// ─────────────────────────────────────────────────────────────
export function normalize(name) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

export function findDriver(drivers, name) {
  const norm = normalize(name);
  let m = drivers.find(d => normalize(d.name) === norm);
  if (m) return m;
  const lastName = norm.split(" ").pop();
  m = drivers.find(d => normalize(d.name).split(" ").pop() === lastName);
  if (m) return m;
  m = drivers.find(d => normalize(d.name).includes(norm) || norm.includes(normalize(d.name)));
  if (m) return m;
  m = drivers.find(d => {
    const dLast = normalize(d.name).split(" ").pop();
    return dLast.includes(lastName) || lastName.includes(dLast);
  });
  return m || null;
}

export function classifyLine(line) {
  const t = line.trim();
  if (!t) return "empty";
  if (/^(finish|starting pos|final status|laps completed|laps led|best lap|points|stage points|stage 1|stage 2|car|#|pos|position|time behind|best time|best speed|laps)$/i.test(t)) return "header";
  if (/logo$/i.test(t)) return "logo";
  if (/^(Running|Out|Accident|DNF|Engine|Mechanical|Electrical|Suspension|Transmission|Overheating|Vibration|Brakes|Retired|Rear Gear|Oil Pressure|Handling|Rear End|Power Steering|Fuel Pump|Ignition)$/i.test(t)) return "status";
  if (/^\d+\.\d+$/.test(t)) return "decimal";
  if (/^-\d+\.\d+$/.test(t)) return "decimal";
  if (/^\d+$/.test(t)) return "number";
  if (/[a-zA-Z]/.test(t)) return "name";
  return "other";
}

// ─────────────────────────────────────────────────────────────
// TABLE-ROW EXPANSION — NASCAR.com result tables paste as one
// tab-separated row per line, which the legacy one-value-per-line
// parser cannot read (it found 0 drivers). Each table row is
// expanded into the legacy sequence the parser already handles:
//   finish, name, start, status, laps, lapsLed        (race mode)
//   name, stagePts                                    (stage mode)
// Column order after the driver name varies, so extraction is
// defensive: finish is the first integer 1..45 (POS is leftmost),
// and laps-led is anchored on totalLaps when it is known.
// ─────────────────────────────────────────────────────────────
export function findNameCell(cells, drivers) {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!/[a-zA-Z]/.test(c)) continue;
    if (drivers.some(d => normalize(d.name) === normalize(c))) return i;
  }
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!/[a-zA-Z]/.test(c)) continue;
    if (findDriver(drivers, c)) return i;
  }
  return -1;
}

export function expandTableRows(text, drivers, totalLaps, mode) {
  const lines = [];
  let tableRows = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (!line.includes("\t")) { lines.push(line); continue; }
    const cells = line.split("\t").map(c => c.trim()).filter(c => c !== "");
    const nameIdx = findNameCell(cells, drivers);
    if (nameIdx < 0) { lines.push(line); continue; }
    const isInt = c => /^\d+$/.test(c);
    const ints = [];
    cells.forEach((c, i) => { if (isInt(c)) ints.push({ v: parseInt(c, 10), i }); });
    if (mode === "stage") {
      const after = ints.filter(o => o.i > nameIdx).map(o => o.v);
      const pts = after.find(v => v >= 1 && v <= 10);
      const any = pts != null ? pts : (ints.map(o => o.v).find(v => v >= 1 && v <= 10));
      if (any == null) { lines.push(line); continue; }
      tableRows++;
      lines.push(cells[nameIdx], String(any));
      continue;
    }
    // race mode
    const finObj = ints.find(o => o.v >= 1 && o.v <= 45);
    if (!finObj) { lines.push(line); continue; }
    const after = ints.filter(o => o.i > nameIdx).map(o => o.v);
    let st = finObj.v, laps = 0, led = 0;
    const tl = parseInt(totalLaps, 10);
    if (after.length) {
      let li = -1;
      if (tl > 0) li = after.findIndex(v => Math.abs(v - tl) <= 5);
      if (li >= 0) {
        // laps column anchored on totalLaps: led is the next number,
        // start is the last plausible (1..40) number before it
        laps = after[li];
        led = li + 1 < after.length ? after[li + 1] : 0;
        const before = after.slice(0, li).filter(v => v >= 1 && v <= 40);
        st = before.length ? before[before.length - 1] : finObj.v;
      } else {
        // fallback: legacy positional assumption (start, laps, led),
        // skipping a leading car number (>40 can't be a start position)
        const nums = after.slice();
        if (nums.length && nums[0] > 40) nums.shift();
        st = nums.length ? nums[0] : finObj.v;
        laps = nums.length >= 3 ? nums[1] : 0;
        led = nums.length >= 3 ? nums[2] : nums.length === 2 ? nums[1] : 0;
      }
    }
    tableRows++;
    lines.push(String(finObj.v), cells[nameIdx], String(st), "Running", String(laps), String(led));
  }
  return { text: lines.join("\n"), tableRows };
}

export function parsePaste(drivers, raceText, stage1Text, stage2Text, totalLaps) {
  const r = expandTableRows(raceText || "", drivers, totalLaps, "race");
  const st1 = expandTableRows(stage1Text || "", drivers, totalLaps, "stage");
  const st2 = expandTableRows(stage2Text || "", drivers, totalLaps, "stage");
  const raceLines = r.text.split("\n");
  const classified = raceLines
    .map(l => ({ raw:l.trim(), type:classifyLine(l) }))
    .filter(c => c.type !== "empty" && c.type !== "header" && c.type !== "logo");

  const raceData = {};
  for (let i = 0; i < classified.length; i++) {
    if (classified[i].type !== "name") continue;
    const driverName = classified[i].raw;
    let finishPos = null;
    for (let b = i-1; b >= 0; b--) {
      if (classified[b].type === "number") {
        const n = parseInt(classified[b].raw);
        if (n >= 1 && n <= 45) { finishPos = n; break; }
      }
      if (classified[b].type === "name") break;
    }
    const forwardNums = [], forwardTypes = [];
    for (let f = i+1; f < classified.length; f++) {
      if (classified[f].type === "name") break;
      if (classified[f].type === "header") continue;
      forwardNums.push(classified[f].raw);
      forwardTypes.push(classified[f].type);
    }
    // name-first ordering: no position number before the name, so take the
    // first 1..45 number after it as the finish and consume it
    if (finishPos === null) {
      const fi = forwardTypes.findIndex(t => t === "number");
      if (fi >= 0) {
        const n = parseInt(forwardNums[fi]);
        if (n >= 1 && n <= 45) {
          finishPos = n;
          forwardNums.splice(fi, 1); forwardTypes.splice(fi, 1);
        }
      }
    }
    let startPos = finishPos, lapsLed = 0;
    let idx = 0;
    if (idx < forwardNums.length && forwardTypes[idx] === "number") { startPos = parseInt(forwardNums[idx]); idx++; }
    if (idx < forwardNums.length && forwardTypes[idx] === "status") idx++;
    if (idx < forwardNums.length && forwardTypes[idx] === "number") idx++;
    if (idx < forwardNums.length && forwardTypes[idx] === "number") { lapsLed = parseInt(forwardNums[idx]); idx++; }
    if (finishPos !== null) raceData[driverName] = { fin:finishPos, st:startPos||finishPos, led:lapsLed };
  }

  function parseStage(text) {
    if (!text) return {};
    const cls = text.split("\n")
      .map(l => ({ raw:l.trim(), type:classifyLine(l) }))
      .filter(c => c.type !== "empty" && c.type !== "header" && c.type !== "logo");
    const out = {};
    for (let i = 0; i < cls.length; i++) {
      if (cls[i].type !== "name") continue;
      for (let f = i+1; f < cls.length; f++) {
        if (cls[f].type === "name") break;
        if (cls[f].type === "number") {
          const pts = parseInt(cls[f].raw);
          if (pts >= 1 && pts <= 10) out[cls[i].raw] = pts;
          break;
        }
      }
    }
    return out;
  }

  const s1 = parseStage(st1.text), s2 = parseStage(st2.text);
  const stagePoints = {};
  for (const [n,p] of Object.entries(s1)) stagePoints[n] = (stagePoints[n]||0)+p;
  for (const [n,p] of Object.entries(s2)) stagePoints[n] = (stagePoints[n]||0)+p;

  const results = [], unmatched = [];
  for (const [parsedName, data] of Object.entries(raceData)) {
    const driver = findDriver(drivers, parsedName);
    if (driver) {
      let sp = 0;
      for (const [sName, pts] of Object.entries(stagePoints)) {
        if (findDriver(drivers, sName) === driver) { sp = Math.min(20, pts); break; }
      }
      results.push({ num:driver.num, fin:data.fin, st:data.st, led:data.led, sp });
    } else {
      unmatched.push(parsedName);
    }
  }
  results.sort((a,b) => a.fin-b.fin);
  return { results, unmatched };
}
