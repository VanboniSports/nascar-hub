// Sessions Tab — Practice, Qualifying, Live, and Race Results in one place.
// Streamlined view for checking session times without the full race page.
import React, { useState } from "react";
import { T } from "../theme.js";
import { currentHub, hubStatus, LiveRunningOrder, findArchiveForHub, findBattleForHub } from "./RaceHub.jsx";
import { HubStatusBadge, sectionTitle } from "./ui.jsx";

export function SessionsTab({ qualPractice, raceArchive, battleRaces, drivers }) {
  const hub = currentHub();
  if (!hub) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: T.textDim }}>
        No race scheduled.
      </div>
    );
  }

  const status = hubStatus(hub);
  const battleRace = battleRaces ? findBattleForHub(battleRaces, hub) : null;
  const actuals = (battleRace && battleRace.actualResults && battleRace.actualResults.length) ? battleRace.actualResults : null;
  const archiveEntry = raceArchive ? findArchiveForHub(raceArchive, hub) : null;
  const fullResults = archiveEntry && archiveEntry.results ? archiveEntry.results
    : (actuals ? actuals.map((name, i) => ({ pos: i + 1, name })) : null);

  const qpMatch = qualPractice && qualPractice.week === hub.week;
  const pracCount = qpMatch && qualPractice.practice ? Object.keys(qualPractice.practice).length : 0;
  const qualCount = qpMatch && qualPractice.qualifying ? Object.keys(qualPractice.qualifying).length : 0;
  const pracCanceled = qpMatch && !!qualPractice.practiceCanceled;
  const qualCanceled = qpMatch && !!qualPractice.qualifyingCanceled;
  const practiceList = (qpMatch && qualPractice.practice)
    ? Object.entries(qualPractice.practice)
        .map(([name, pos]) => ({ name, pos }))
        .sort((a, b) => a.pos - b.pos)
    : [];
  const qualList = (qpMatch && qualPractice.qualifying)
    ? Object.entries(qualPractice.qualifying).map(([name, pos]) => ({ name, pos })).sort((a, b) => a.pos - b.pos)
    : [];

  const resultTabs = [
    { id: "practice", label: "Practice" },
    { id: "qualifying", label: "Qualifying" },
    ...(status === "live" ? [{ id: "live", label: "Live" }] : []),
    ...(actuals ? [{ id: "race", label: "Race Results" }] : []),
  ];
  const [resultsTab, setResultsTab] = useState(
    status === "live" ? "live" : actuals ? "race" : qualCount > 0 ? "qualifying" : "practice"
  );

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
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
          {hub.track} · {hub.dateLabel}
        </div>
      </div>

      {/* Tab buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {resultTabs.map(t => (
          <button key={t.id} onClick={() => setResultsTab(t.id)} style={{
            padding: "8px 18px", borderRadius: 8, cursor: "pointer",
            fontSize: 12, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif",
            letterSpacing: 1.5, textTransform: "uppercase",
            background: resultsTab === t.id ? T.accentSoft : T.surface3,
            border: `1px solid ${resultsTab === t.id ? T.accent : T.border}`,
            color: resultsTab === t.id ? T.accentText : T.textDim,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Practice */}
      {resultsTab === "practice" && (
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
      {resultsTab === "qualifying" && (
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
      {resultsTab === "live" && (
        <div>
          <LiveRunningOrder hub={hub} />
          <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 8, textAlign: "center" }}>
            Live timing appears automatically once NASCAR's feed starts flowing.
          </div>
        </div>
      )}

      {/* Race Results */}
      {resultsTab === "race" && actuals && (
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
