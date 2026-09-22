// Rating trends tab. Extracted from NASCARHub.jsx (phase 2).
import React, { useState } from "react";
import { T, TL, CC } from "../theme.js";
import { TRACK_KEYS } from "../data/drivers.js";
import { TrackTypePill } from "./ui.jsx";

export function TrendsTab({ drivers, ratingHistory }) {
  const [selected, setSelected] = useState([]);
  const [trendKey, setTrendKey] = useState("overall");
  const [search, setSearch] = useState("");
  const filtered = search ? drivers.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.num.includes(search)) : drivers;
  const toggle = (num) => {
    setSelected(prev => prev.includes(num) ? prev.filter(n=>n!==num) : prev.length < 6 ? [...prev,num] : prev);
  };
  const trendSvg = () => {
    if (selected.length === 0 || ratingHistory.length < 2) return null;
    const W=420, H=200, P={t:22,r:70,b:26,l:36};
    const cw=W-P.l-P.r, ch=H-P.t-P.b, n=ratingHistory.length;
    let vals=[];
    selected.forEach(num => ratingHistory.forEach(s => { if(s[num]) vals.push(s[num][trendKey]||0); }));
    if (!vals.length) return null;
    const mn=Math.max(0,Math.min(...vals)-5), mx=Math.min(100,Math.max(...vals)+5), rng=mx-mn||1;
    const xp=i=>P.l+(i/(n-1))*cw, yp=v=>P.t+ch-((v-mn)/rng)*ch;
    const st=rng>20?10:5;
    const grids=[];
    for(let v=Math.ceil(mn/st)*st;v<=mx;v+=st) grids.push(v);
    let svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;display:block;">`;
    grids.forEach(v=>{svg+=`<line x1="${P.l}" x2="${W-P.r}" y1="${yp(v)}" y2="${yp(v)}" stroke="rgba(255,255,255,0.05)"/><text x="${P.l-6}" y="${yp(v)+3}" fill="#5a8aab" font-size="9" text-anchor="end">${v}</text>`;});
    ratingHistory.forEach((_,i)=>{svg+=`<text x="${xp(i)}" y="${H-6}" fill="#5a8aab" font-size="8" text-anchor="middle">R${i+1}</text>`;});
    selected.forEach((num,di)=>{
      const col=CC[di%CC.length];
      const pts=ratingHistory.map((s,i)=>s[num]?{x:xp(i),y:yp(s[num][trendKey]||0)}:null).filter(Boolean);
      if(pts.length<2) return;
      const pathD=pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
      const drv=drivers.find(x=>x.num===num);
      const last=pts[pts.length-1];
      svg+=`<path d="${pathD}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      pts.forEach(p=>{svg+=`<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="${col}"/>`;});
      svg+=`<text x="${last.x+5}" y="${last.y+3}" fill="${col}" font-size="8" font-weight="700">#${num} ${drv?.name.split(" ").pop()||""}</text>`;
    });
    svg+="</svg>";
    return svg;
  };
  const svg = trendSvg();
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <p style={{ fontSize:11, color:T.textDim, marginBottom:8, letterSpacing:1, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Select drivers to track (up to 6)</p>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search drivers..."
          style={{ width:"100%", background:T.surface2, border:`1px solid ${T.border}`, color:T.text, borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", marginBottom:10, fontFamily:"'Barlow',sans-serif" }} />
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, maxHeight:130, overflowY:"auto", padding:"2px 0" }}>
          {filtered.map(d => {
            const idx = selected.indexOf(d.num);
            const sel = idx >= 0;
            const col = sel ? CC[idx%CC.length] : "";
            return (
              <div key={d.num} onClick={()=>toggle(d.num)} style={{ padding:"4px 10px", borderRadius:6, fontSize:12, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer", border:`1px solid ${sel?col:T.border}`, background:sel?`${col}20`:T.surface2, color:sel?col:T.textMid, transition:"all 0.12s" }}>
                #{d.num} {d.name.split(" ").pop()}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p style={{ fontSize:11, color:T.textDim, marginBottom:8, letterSpacing:1, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Rating to track</p>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {TRACK_KEYS.map(k => <TrackTypePill key={k} type={k} active={trendKey===k} onClick={()=>setTrendKey(k)} />)}
        </div>
      </div>
      {selected.length === 0 ? (
        <div style={{ padding:"40px", textAlign:"center", color:T.textDim, fontSize:13, background:T.surface, border:`1px solid ${T.border}`, borderRadius:12 }}>Select drivers above to see rating trends.</div>
      ) : ratingHistory.length < 2 ? (
        <div style={{ padding:"40px", textAlign:"center", color:T.textDim, fontSize:13, background:T.surface, border:`1px solid ${T.border}`, borderRadius:12 }}>Need at least 2 races recorded to show trends.</div>
      ) : !svg ? (
        <div style={{ padding:"40px", textAlign:"center", color:T.textDim, fontSize:13, background:T.surface, border:`1px solid ${T.border}`, borderRadius:12 }}>No data for selected drivers.</div>
      ) : (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"20px 16px" }}>
          <p style={{ fontSize:10, color:T.textDim, marginBottom:12, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>{TL[trendKey]} Rating Over Time</p>
          <div dangerouslySetInnerHTML={{ __html: svg }} />
          <div style={{ display:"flex", flexWrap:"wrap", gap:12, justifyContent:"center", marginTop:12 }}>
            {selected.map((num,i) => {
              const d=drivers.find(x=>x.num===num);
              return <span key={num} style={{ fontSize:11, fontWeight:700, color:CC[i%CC.length], fontFamily:"'Barlow Condensed',sans-serif", display:"flex", alignItems:"center", gap:5 }}><span style={{ width:14, height:3, borderRadius:2, background:CC[i%CC.length], display:"inline-block" }} />#{num} {d?.name||""}</span>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SEASON STATS TAB
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// SEASON STATS TAB — CSV-based with 4 sub-tabs
// ─────────────────────────────────────────────────────────────
