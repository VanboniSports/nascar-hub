import React, { useState, useEffect } from "react";
import { T } from "../theme.js";
import { Ic } from "./icons.jsx";

// ─────────────────────────────────────────────────────────────
// Mobile-only UI primitives. Every component renders null (or its
// children unwrapped) on desktop via useIsMobile, so desktop DOM
// and rendering are completely unchanged.
// ─────────────────────────────────────────────────────────────

export function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  useEffect(() => {
    const q = window.matchMedia("(max-width: 768px)");
    const fn = (e) => setMobile(e.matches);
    q.addEventListener("change", fn);
    setMobile(q.matches);
    return () => q.removeEventListener("change", fn);
  }, []);
  return mobile;
}

// 5 primary tabs + a "More" sheet for the rest. Tab ids match TABS in NASCARHub.jsx.
const PRIMARY_TABS = [
  { id: "race",      label: "Race Hub",  icon: "Car"    },
  { id: "races",     label: "Races",     icon: "Flag"   },
  { id: "predictor", label: "Predictor", icon: "Trend"  },
  { id: "dfs",       label: "DFS",       icon: "Trophy" },
  { id: "blog",      label: "Blog",      icon: "Edit"   },
];
const MORE_TABS = [
  { id: "power",     label: "Power Rankings", icon: "Trophy" },
  { id: "tracker",   label: "Battle Tracker", icon: "Chart"  },
  { id: "scorecard", label: "Scorecard",      icon: "Trophy" },
  { id: "tracks",    label: "Track Stats",    icon: "Flag"   },
  { id: "analytics", label: "Driver Analytics", icon: "Trend"},
  { id: "season",    label: "Season Stats",   icon: "Chart"  },
];

function BarButton({ tab, active, onTab }) {
  const Icon = Ic[tab.icon];
  return (
    <button
      onClick={() => onTab(tab.id)}
      style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 3, minHeight: 58, background: "none", border: "none", cursor: "pointer",
        color: active ? T.accent : T.textDim,
        fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, fontWeight: active ? 800 : 600,
        letterSpacing: 0.8, textTransform: "uppercase",
      }}
    >
      <span style={{ display: "flex", opacity: active ? 1 : 0.6 }}>{Icon && Icon()}</span>
      {tab.label}
    </button>
  );
}

export function MobileBottomBar({ activeTab, onTab }) {
  const mobile = useIsMobile();
  const [moreOpen, setMoreOpen] = useState(false);
  if (!mobile) return null;
  const moreActive = MORE_TABS.some(t => t.id === activeTab);
  const go = (id) => { setMoreOpen(false); onTab(id); };
  return (
    <>
      <nav
        className="vbs-bottombar"
        style={{
          display: "none",
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 200,
          background: T.headerBg, borderTop: `1px solid ${T.border}`,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {PRIMARY_TABS.map(t => <BarButton key={t.id} tab={t} active={activeTab === t.id} onTab={go} />)}
        <button
          onClick={() => setMoreOpen(o => !o)}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 3, minHeight: 58, background: moreOpen ? T.accentSoft : "none", border: "none", cursor: "pointer",
            color: moreActive ? T.accent : T.textDim,
            fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, fontWeight: moreOpen || moreActive ? 800 : 600,
            letterSpacing: 0.8, textTransform: "uppercase",
          }}
        >
          <span style={{ display: "flex", opacity: moreOpen || moreActive ? 1 : 0.6 }}><Ic.List /></span>
          More
        </button>
      </nav>
      {moreOpen && (
        <div
          onClick={() => setMoreOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 201, background: "rgba(0,0,0,0.6)" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", left: 0, right: 0, bottom: 0,
              background: T.surface, borderTop: `1px solid ${T.border}`,
              borderTopLeftRadius: 16, borderTopRightRadius: 16,
              padding: "8px 8px calc(20px + env(safe-area-inset-bottom))",
              animation: "fadeIn 0.18s ease",
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border2, margin: "6px auto 10px" }} />
            {MORE_TABS.map(t => {
              const Icon = Ic[t.icon];
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => go(t.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    minHeight: 52, padding: "0 16px", background: active ? T.accentSoft : "none",
                    border: "none", borderRadius: 10, cursor: "pointer",
                    color: active ? T.accent : T.text,
                    fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: active ? 800 : 600,
                    letterSpacing: 1, textTransform: "uppercase", textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", opacity: active ? 1 : 0.6 }}>{Icon && Icon()}</span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// Collapsible section wrapper for race pages. Desktop: children unwrapped, zero DOM change.
export function MobileSection({ id, title, children, defaultOpen = true }) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(defaultOpen);
  if (!mobile) return <>{children}</>;
  return (
    <div className="vbs-msec" id={`vbs-msec-${id}`}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          minHeight: 48, padding: "6px 2px", background: "none", border: "none",
          borderBottom: `1px solid ${T.border}`, cursor: "pointer", marginBottom: open ? 12 : 16,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>
          {title}
        </span>
        <span style={{ color: T.textDim, display: "flex" }}><Ic.Chevron open={open} /></span>
      </button>
      {open && children}
    </div>
  );
}

// Sticky section-jump control for race pages. Desktop: null.
export function MobileJumpNav({ sections }) {
  const mobile = useIsMobile();
  if (!mobile || !sections || sections.length === 0) return null;
  const jump = (id) => {
    const el = document.getElementById(`vbs-msec-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div
      className="vbs-jumpnav"
      style={{
        display: "none", position: "sticky", top: 58, zIndex: 90,
        gap: 8, overflowX: "auto", padding: "8px 2px", marginBottom: 4,
        background: T.bg,
      }}
    >
      {sections.map(s => (
        <button
          key={s.id}
          onClick={() => jump(s.id)}
          style={{
            flexShrink: 0, minHeight: 44, padding: "0 16px", borderRadius: 20,
            background: T.surface, border: `1px solid ${T.border}`, color: T.textMid,
            fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700,
            letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// Floating back-to-top button. Desktop: null.
export function BackToTop() {
  const mobile = useIsMobile();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!mobile) return;
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [mobile]);
  if (!mobile || !show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      style={{
        position: "fixed", right: 16, bottom: 92, zIndex: 190,
        width: 48, height: 48, borderRadius: "50%",
        background: T.accent, color: "#fff", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
    </button>
  );
}
