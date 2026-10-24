// Sessions Tab — Practice, Qualifying, Live, and Race Results in one place.
// Streamlined view for checking session times without the full race page.
// Series switcher (Oct 2026): Cup / O'Reilly / Trucks. Default is Cup, so
// Cup behaviour is unchanged. Per-series practice/qualifying (Oct 24,
// 2026): each series reads ONLY its own record (Cup dfsQualifying,
// O'Reilly dfsQualifyingXfinity, Trucks dfsQualifyingTruck), matched
// against THAT series' hub week, because week numbers collide across
// series (Cup week 33 vs O'Reilly week 33 are different races). Battle/
// archive lookups still return null for non-Cup hubs, so lower hubs
// show honest empty states until their data is imported.
import React, { useState } from "react";
import { T } from "../theme.js";
import { currentHub, hubStatus, LiveRunningOrder, findArchiveForHub, findBattleForHub } from "./RaceHub.jsx";
import { seriesLabel } from "../data/series.js";
import { SeriesSwitcher } from "./SeriesSwitcher.jsx";
import { HubStatusBadge, sectionTitle } from "./ui.jsx";

export default function SessionsTab({ qualPractice, qualPracticeBySeries, raceArchive, battleRaces, drivers }) {
  const [series, setSeries] = useState("cup");
  const hub = currentHub(series);

  const status = hubStatus(hub);
  const isCup = !hub || hub.series === "cup";
  // findBattleForHub / findArchiveForHub already return null for non-Cup
  // hubs; the explicit isCup gate here makes the guard visible at the
  // call site so a future edit cannot accidentally borrow Cup results.
  const battleRace = isCup && battleRaces ? findBattleForHub(battleRaces, hub) : null;
  const actuals = (battleRace && battleRace.actualResults && battleRace.actualResults.length) ? battleRace.actualResults : null;
  const archiveEntry = isCup && raceArchive ? findArchiveForHub(raceArchive, hub) : null;
  const fullResults = archiveEntry && archiveEntry.results ? archiveEntry.results
    : (actuals ? actuals.map((name, i) => ({ pos: i + 1, name })) : null);

  // Per-series record: the active series' own record only, never the
  // Cup record under a lower-series name (and never a lower record
  // under Cup). Falls back to the legacy single prop for Cup callers
  // that do not pass the per-series map. Week must match THIS series'
  // hub week: week numbers collide across series.
  const qp = qualPracticeBySeries ? (qualPracticeBySeries[series] || null)
    : (series === "cup" ? qualPractice : null);
  const qpMatch = qp && hub && qp.week === hub.week;
  const pracCount = qpMatch && qp.practice ? Object.keys(qp.practice).length : 0;
  const qualCount = qpMatch && qp.qualifying ? Object.keys(qp.qualifying).length : 0;
  const pracCanceled = qpMatch && !!qp.practiceCanceled;
  const qualCanceled = qpMatch && !!qp.qualifyingCanceled;
  // Practice values may be timing objects (speedRank) rather than plain
  // positions; rank by speedRank in that case so the list stays ordered.
  const practiceList = (qpMatch && qp.practice)
    ? Object.entries(qp.practice)
        .map(([name, pos]) => ({ name, pos: (pos && typeof pos === "object") ? (pos.speedRank || 99) : pos }))
        .sort((a, b) => a.pos - b.pos)
    : [];
  const qualList = (qpMatch && qp.qualifying)
    ? Object.entries(qp.qualifying).map(([name, pos]) => ({ name, pos })).sort((a, b) => a.pos - b.pos)
    : [];

  const resultTabs = [
    { id: "practice", label: "Practice" },
    { id: "qualifying", label: "Qualifying" },
    // Live is offered only when status is "live", i.e. on race day, for
    // every series. For lower hubs this is the RaceHubPage rule: Live is
    // NOT kept open after race day (no results exist yet to replace it).
    ...(status === "live" ? [{ id: "live", label: "Live" }] : []),
    // Race Results appears only when battle actuals exist, which the
    // isCup gate above guarantees can never happen for a lower hub.
    ...(actuals ? [{ id: "race", label: "Race Results" }] : []),
  ];
  const [resultsTab, setResultsTab] = useState(
    status === "live" ? "live" : actuals ? "race" : qualCount > 0 ? "qualifying" : "practice"
  );
  // Switching series can strand the selected tab (e.g. "race" or "live"
  // do not exist for a lower hub). Fall back to the default tab for the
  // current hub instead of rendering an empty tab body.
  const activeTab = resultTabs.some(t => t.id === resultsTab) ? resultsTab
    : (status === "live" ? "live" : actuals ? "race" : qualCount > 0 ? "qualifying" : "practice");

  if (!hub) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: T.textDim }}>
        No race scheduled.
      </div>
    );
  }

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <SeriesSwitcher series={series} onSeriesChange={setSeries} />
      {/* Header */}
      <div style={{ ...card, borderLeft: `3px solid ${T.accent}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 2, textTransform: "uppercase" }}>Sessions</span>
          <HubStatusBadge status={status} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase" }}>
          {hub.officialName || hub.name}
        </div>
        <div style={{ fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", marginTop: 4 }}>
          {hub.series !== "cup" ? `${seriesLabel(hub.series)} Series · ` : ""}{hub.track} · {hub.dateLabel}
        </div>
        {/* Session times from the schedule (same conventions as RaceHub):
            no session data -> "Session times not recorded"; practice
            null -> "No practice scheduled" (e.g. Talladega 2026, all
            three series, has no practice at all). */}
        <div style={{ fontSize: 12, color: T.textMid, fontFamily: "'IBM Plex Mono',monospace", marginTop: 4 }}>
          {!hub.hasSessionData ? "Session times not recorded"
            : `Practice: ${hub.practice ? hub.practice : "No practice scheduled"} · Qualifying: ${hub.qualifying || "Not confirmed"} · Race: ${hub.dateLabel}, ${hub.raceTime || "time not confirmed"}`}
        </div>
        {!isCup && !(qpMatch && (qualCount > 0 || pracCount > 0)) && (
          <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 6 }}>
            Practice and qualifying results for this series are not logged yet; session times above come from the schedule.
          </div>
        )}
      </div>

      {/* Tab buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {resultTabs.map(t => (
          <button key={t.id} onClick={() => setResultsTab(t.id)} style={{
            padding: "8px 18px", borderRadius: 8, cursor: "pointer",
            fontSize: 12, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif",
            letterSpacing: 1.5, textTransform: "uppercase",
            background: activeTab === t.id ? T.accentSoft : T.surface3,
            border: `1px solid ${activeTab === t.id ? T.accent : T.border}`,
            color: activeTab === t.id ? T.accentText : T.textDim,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Practice */}
      {activeTab === "practice" && (
        practiceList.length > 0 ? (
          <div style={card}>
            {practiceList.map((p, i) => (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < practiceList.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <span style={{ width: 28, fontSize: 12, fontWeight: 800, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>P{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{p.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...card, textAlign: "center", color: T.textDim, padding: "30px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: pracCanceled ? T.red : T.textMid, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
              {pracCanceled ? "Practice canceled" : "No practice data yet"}
            </div>
            <div style={{ fontSize: 12, marginTop: 6, fontFamily: "'IBM Plex Mono',monospace" }}>
              {pracCanceled ? "This session was canceled." : "Practice results will appear here once logged."}
            </div>
          </div>
        )
      )}

      {/* Qualifying */}
      {activeTab === "qualifying" && (
        qualList.length > 0 ? (
          <div style={card}>
            {qualList.map((q, i) => (
              <div key={q.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < qualList.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <span style={{ width: 28, fontSize: 12, fontWeight: 800, color: i === 0 ? T.gold : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>P{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: i === 0 ? 800 : 500, color: T.text }}>{q.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...card, textAlign: "center", color: T.textDim, padding: "30px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: qualCanceled ? T.red : T.textMid, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
              {qualCanceled ? "Qualifying canceled" : "No qualifying data yet"}
            </div>
            <div style={{ fontSize: 12, marginTop: 6, fontFamily: "'IBM Plex Mono',monospace" }}>
              {qualCanceled ? "The starting grid will appear here once it is set." : "Qualifying results will appear here once logged."}
            </div>
          </div>
        )
      )}

      {/* Live */}
      {activeTab === "live" && (
        <div>
          <LiveRunningOrder hub={hub} />
          <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 8, textAlign: "center" }}>
            Live timing appears automatically once NASCAR's feed starts flowing.
          </div>
        </div>
      )}

      {/* Race Results */}
      {activeTab === "race" && actuals && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 2, textTransform: "uppercase" }}>Winner</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.gold, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>{actuals[0]}</div>
            </div>
          </div>
          {fullResults && fullResults.length > 0 && fullResults[0].pos ? (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                  {[["Pos", 44], ["Driver", null], ["Start", 52], ["Led", 48], ["Stage", 56], ["Pts", 52]].map(([h, w]) => (
                    <th key={h} style={{ textAlign: h === "Driver" ? "left" : "center", fontSize: 10, fontWeight: 800, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1.5, textTransform: "uppercase", padding: "6px 4px", width: w || undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fullResults.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: r.pos === 1 ? T.gold : T.textDim, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.pos}</td>
                    <td style={{ fontSize: 13, color: T.text, padding: "6px 4px" }}>{r.name}</td>
                    <td style={{ textAlign: "center", fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.start || "-"}</td>
                    <td style={{ textAlign: "center", fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.led || "-"}</td>
                    <td style={{ textAlign: "center", fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.stagePts || "-"}</td>
                    <td style={{ textAlign: "center", fontSize: 12, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", padding: "6px 4px" }}>{r.points || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ marginTop: 8 }}>
              {actuals.map((name, i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < actuals.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <span style={{ width: 28, fontSize: 12, fontWeight: 800, color: i === 0 ? T.gold : T.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>P{i + 1}</span>
                  <span style={{ fontSize: 14, fontWeight: i === 0 ? 800 : 500, color: T.text }}>{name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
