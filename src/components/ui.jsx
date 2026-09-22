// Shared presentational atoms used across tabs. Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useEffect, useRef, useMemo } from "react";
import { T, TC, TL } from "../theme.js";
import { Ic } from "./icons.jsx";
import { CSV_TRACK_TYPES, CSV_TYPE_COLORS } from "../data/siteMeta.js";
import { VBS_LOGO } from "../data/logo.js";

export function TrackTypePill({ type, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:"6px 14px", fontSize:11, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif",
      letterSpacing:1.5, textTransform:"uppercase", cursor:"pointer", borderRadius:6,
      background: active ? TC[type] : T.surface2,
      color: active ? "#fff" : T.textMid,
      border: `1px solid ${active ? TC[type] : T.border}`,
      transition:"all 0.15s",
    }}>{TL[type]}</button>
  );
}


export function RatingMiniBar({ value, type }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ flex:1, height:4, background:T.surface3, borderRadius:2, overflow:"hidden" }}>
        <div style={{ width:`${value}%`, height:"100%", background:TC[type], borderRadius:2 }} />
      </div>
      <span style={{ fontSize:11, fontWeight:700, color:TC[type], fontFamily:"monospace", minWidth:22 }}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// INFO LEGEND — Collapsible info box for tab explanations
// ─────────────────────────────────────────────────────────────


export function InfoLegend({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: open ? 16 : 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display:"flex", alignItems:"center", gap:7, padding:"6px 12px",
        background: open ? `${T.accent}10` : "transparent",
        border:`1px solid ${open ? `${T.accent}40` : T.border}`,
        borderRadius:8, cursor:"pointer", transition:"all 0.18s",
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={open ? T.accent : T.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span style={{ fontSize:11, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.2, textTransform:"uppercase", color: open ? T.accent : T.textDim }}>
          {title || "Legend"}
        </span>
        <Ic.Chevron open={open} />
      </button>
      {open && (
        <div style={{
          marginTop:8, padding:"14px 16px", background:T.surface, border:`1px solid ${T.border}`,
          borderRadius:10, fontSize:12, color:T.textMid, lineHeight:1.65,
          fontFamily:"'IBM Plex Mono',monospace", animation:"fadeIn 0.2s ease",
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// POWER RANKINGS TAB — Rankings sub-tab
// ─────────────────────────────────────────────────────────────


export function BattleBadge({ label, value, color }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: T.surface2, border: `1px solid ${T.border}`,
      borderRadius: 7, padding: "5px 10px", minWidth: 52,
    }}>
      <span style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 700, color: color || T.text, fontFamily: "'IBM Plex Mono',monospace" }}>{value}</span>
    </div>
  );
}


export function BattleScoreBar({ score, maxScore }) {
  const pct = maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0;
  const color = pct > 66 ? T.green : pct > 33 ? T.gold : T.red;
  return (
    <div style={{ flex: 1, height: 4, background: T.surface3, borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.5s ease" }} />
    </div>
  );
}


export function BattleDriverInput({ rank, value, onChange, placeholder }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{
        width: 22, height: 22, borderRadius: 4, flexShrink: 0,
        background: rank <= 3 ? `${T.gold}18` : T.surface2,
        border: `1px solid ${rank <= 3 ? `${T.gold}44` : T.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace",
        color: rank <= 3 ? T.gold : T.textDim,
      }}>{rank}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          flex: 1, background: T.surface2,
          border: `1px solid ${T.border}`, borderRadius: 6,
          padding: "5px 9px", color: T.text, fontSize: 13,
          fontFamily: "'IBM Plex Mono',monospace", outline: "none",
        }} />
    </div>
  );
}

// Battle chart with recharts


export const BattleChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: "'IBM Plex Mono',monospace" }}>
      <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
          <span style={{ fontSize: 12, color: T.textMid }}>{p.dataKey}:</span>
          <span style={{ fontSize: 12, color: p.color, fontWeight: 700 }}>{p.value} pts</span>
        </div>
      ))}
    </div>
  );
};


export function SearchDropdown({ label, options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() =>
    options.filter(o => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  return (
    <div style={{ flex:1, minWidth:200 }} ref={ref}>
      <div style={{ fontSize:10, letterSpacing:2, color:T.accent, fontWeight:700, marginBottom:6, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase" }}>{label} <span style={{ color:T.textDim }}>(optional)</span></div>
      <div style={{ position:"relative" }}>
        <div onClick={() => setOpen(o => !o)}
          style={{ background:T.surface2, border:`1px solid ${value ? T.accent : T.border}`, borderRadius:8, padding:"10px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13, fontWeight:value?600:400, color:value?T.text:T.textDim, transition:"border-color 0.15s" }}>
          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value || placeholder}</span>
          <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
            {value && <span onClick={e=>{e.stopPropagation();onChange("");setSearch("");}} style={{ color:T.textDim, fontSize:16, lineHeight:1, cursor:"pointer" }}>×</span>}
            <span style={{ color:T.accent, fontSize:12 }}>{open ? "▲" : "▼"}</span>
          </div>
        </div>
        {open && (
          <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, zIndex:200, maxHeight:260, overflow:"auto", boxShadow:"0 8px 32px rgba(0,0,0,0.6)" }}>
            <div style={{ padding:8, position:"sticky", top:0, background:T.surface, borderBottom:`1px solid ${T.border}` }}>
              <input autoFocus placeholder={`Search ${label.toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)}
                style={{ width:"100%", background:T.surface3, border:`1px solid ${T.border}`, borderRadius:6, padding:"7px 10px", color:T.text, fontSize:12, outline:"none", boxSizing:"border-box", fontFamily:"'Barlow',sans-serif" }} />
            </div>
            {filtered.length === 0 && <div style={{ padding:"12px 14px", color:T.textDim, fontSize:12 }}>No results</div>}
            {filtered.map(o => (
              <div key={o} onClick={() => {onChange(o);setSearch("");setOpen(false);}}
                style={{ padding:"9px 14px", cursor:"pointer", background:value===o?T.accentSoft:"transparent", color:value===o?T.accent:T.textMid, fontSize:13, fontWeight:value===o?600:400, borderLeft:value===o?`3px solid ${T.accent}`:"3px solid transparent", transition:"background 0.1s" }}
                onMouseEnter={e=>{ if(value!==o) e.currentTarget.style.background=T.surface2; }}
                onMouseLeave={e=>{ if(value!==o) e.currentTarget.style.background="transparent"; }}>
                {o}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


export function FinishBadge({ pos }) {
  if (pos === 1)     return <span style={{ background:"#b8860b", color:"#fff8dc", padding:"2px 8px", borderRadius:4, fontWeight:800, fontSize:11, fontFamily:"monospace" }}>P1 🏆</span>;
  if (pos <= 3)  return <span style={{ background:"#708090", color:"#f0f0f0", padding:"2px 7px", borderRadius:4, fontWeight:700, fontSize:11, fontFamily:"monospace" }}>P{pos}</span>;
  if (pos <= 5)  return <span style={{ background:"#8B4513", color:"#ffe4c4", padding:"2px 7px", borderRadius:4, fontWeight:700, fontSize:11, fontFamily:"monospace" }}>P{pos}</span>;
  if (pos <= 10) return <span style={{ background:"rgba(34,197,94,0.18)", color:"#4ade80", border:"1px solid rgba(34,197,94,0.35)", padding:"2px 7px", borderRadius:4, fontWeight:700, fontSize:11, fontFamily:"monospace" }}>P{pos}</span>;
  return <span style={{ background:T.surface2, color:T.textMid, border:`1px solid ${T.border}`, padding:"2px 7px", borderRadius:4, fontWeight:600, fontSize:11, fontFamily:"monospace" }}>P{pos}</span>;
}


export function TrackBadge({ trackName }) {
  const type = CSV_TRACK_TYPES[trackName] || "Unknown";
  const color = CSV_TYPE_COLORS[type] || T.textDim;
  return <span style={{ background:`${color}22`, border:`1px solid ${color}55`, color, borderRadius:5, padding:"2px 9px", fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>{type}</span>;
}


export function StatCard({ label, value, highlight }) {
  return (
    <div style={{ background:T.surface2, border:`1px solid ${highlight?T.accent:T.border}`, borderRadius:10, padding:"12px 16px", textAlign:"center", minWidth:80 }}>
      <div style={{ fontSize:22, fontWeight:900, color:highlight?T.accent:T.text, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{value ?? "—"}</div>
      <div style={{ fontSize:9, color:T.textDim, letterSpacing:2, textTransform:"uppercase", marginTop:4, fontFamily:"'Barlow Condensed',sans-serif" }}>{label}</div>
    </div>
  );
}


export function ComingSoon({ title, items=[] }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 20px", gap:16, textAlign:"center" }}>
      <div style={{ fontSize:32 }}>🏗️</div>
      <div style={{ fontSize:22, fontWeight:900, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:2, textTransform:"uppercase", color:T.text }}>{title}</div>
      <div style={{ fontSize:12, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:1 }}>COMING SOON</div>
      {items.length > 0 && (
        <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:8, maxWidth:320 }}>
          {items.map((item,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:T.textMid, background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 14px" }}>
              <span style={{ color:T.accent, fontSize:10 }}>◆</span>{item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// POWER RANKINGS WRAPPER — sub-tabs (no admin)
// ─────────────────────────────────────────────────────────────


export function WelcomeModal({ onDismiss }) {
  const [dontShow, setDontShow] = useState(false);
  const handleDismiss = () => {
    if (dontShow) {
      try { localStorage.setItem("nascar_hub_welcome_dismissed", "1"); } catch {}
    }
    onDismiss();
  };
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:20, animation:"fadeIn 0.3s ease",
    }} onClick={handleDismiss}>
      <div onClick={e => e.stopPropagation()} style={{
        background:`linear-gradient(180deg, ${T.surface2} 0%, ${T.surface} 100%)`,
        border:`1px solid ${T.border2}`, borderRadius:16,
        maxWidth:460, width:"100%", padding:"32px 28px 24px",
        boxShadow:`0 24px 80px rgba(0,0,0,0.6), 0 0 40px ${T.accentGlow}`,
        position:"relative", overflow:"hidden",
      }}>
        {/* Accent glow line at top */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:`linear-gradient(90deg, transparent, ${T.accent}, transparent)` }} />

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <img src={VBS_LOGO} alt="Vanboni Sports" style={{ height:36, opacity:0.85 }} />
        </div>

        {/* Headline */}
        <h2 style={{
          fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900,
          fontSize:26, letterSpacing:3, textTransform:"uppercase",
          textAlign:"center", margin:"0 0 6px", lineHeight:1.2,
          color:T.text,
        }}>
          WELCOME TO NASCAR <span style={{ color:T.accent }}>HUB</span>
        </h2>
        <p style={{
          fontFamily:"'IBM Plex Mono',monospace", fontSize:10,
          letterSpacing:2.5, textTransform:"uppercase", textAlign:"center",
          color:T.textDim, margin:"0 0 18px",
        }}>
          2026 CUP SERIES ANALYTICS PLATFORM
        </p>

        {/* Divider */}
        <div style={{ height:1, background:T.border, margin:"0 0 16px" }} />

        {/* Description */}
        <p style={{
          fontSize:13, lineHeight:1.7, color:T.textMid,
          margin:"0 0 16px", textAlign:"center",
          fontFamily:"'Barlow',sans-serif",
        }}>
          Your all-in-one destination for NASCAR Cup Series analytics — explore driver performance, predict race outcomes, and track the season.
        </p>

        {/* Tool list */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 16px", margin:"0 0 22px" }}>
          {[
            { icon:"🏆", label:"Power Rankings" },
            { icon:"🏁", label:"Race Predictor" },
            { icon:"📊", label:"Battle Tracker" },
            { icon:"🛤️", label:"Track Stats" },
            { icon:"👤", label:"Driver Analytics" },
            { icon:"📈", label:"Season Stats" },
          ].map(t => (
            <div key={t.label} style={{
              display:"flex", alignItems:"center", gap:8,
              padding:"6px 10px", borderRadius:8,
              background:T.accentSoft, border:`1px solid ${T.accent}15`,
            }}>
              <span style={{ fontSize:14 }}>{t.icon}</span>
              <span style={{
                fontSize:12, fontWeight:600, color:T.accentText,
                fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5,
              }}>{t.label}</span>
            </div>
          ))}
        </div>

        {/* Don't show again checkbox */}
        <label style={{
          display:"flex", alignItems:"center", justifyContent:"center",
          gap:8, cursor:"pointer", margin:"0 0 18px",
        }}>
          <input
            type="checkbox" checked={dontShow}
            onChange={e => setDontShow(e.target.checked)}
            style={{ accentColor:T.accent, width:14, height:14, cursor:"pointer" }}
          />
          <span style={{
            fontSize:11, color:T.textDim,
            fontFamily:"'IBM Plex Mono',monospace", letterSpacing:0.5,
          }}>Don't show this again</span>
        </label>

        {/* CTA Button */}
        <button onClick={handleDismiss} style={{
          display:"block", width:"100%", padding:"12px 0",
          background:`linear-gradient(135deg, ${T.accent}, #0066cc)`,
          color:"#fff", border:"none", borderRadius:10,
          fontSize:15, fontWeight:800, letterSpacing:2, textTransform:"uppercase",
          fontFamily:"'Barlow Condensed',sans-serif",
          cursor:"pointer", transition:"opacity 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.opacity="0.88"}
          onMouseLeave={e => e.currentTarget.style.opacity="1"}
        >
          LET'S GO
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DFS LINEUP OPTIMIZER
// ═══════════════════════════════════════════════════════════════════════

// §1 PLATFORM CONFIGS


export function HubStatusBadge({ status }) {
  const map = {
    upcoming:  { label: "UPCOMING", color: T.accent,  bg: T.accentSoft },
    live:      { label: "RACE DAY", color: T.red,     bg: T.redBg },
    completed: { label: "FINAL",    color: T.green,   bg: T.greenBg },
  };
  const s = map[status] || map.upcoming;
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 4,
      background: s.bg, border: `1px solid ${s.color}45`,
      fontSize: 10, fontWeight: 800, color: s.color,
      fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5,
    }}>{s.label}</span>
  );
}


export function sectionTitle(text, sub) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>{text}</div>
      {sub && <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono',monospace", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// RACES TAB — archive index of race hubs, newest first.
