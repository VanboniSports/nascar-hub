// Driver comparison tab. Extracted from NASCARHub.jsx (phase 2).
import React, { useState } from "react";
import { T, TC, TL, CC } from "../theme.js";
import { TRACK_KEYS } from "../data/drivers.js";

export function CompareTab({ drivers }) {
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const filtered = search ? drivers.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.num.includes(search)) : drivers;
  const toggle = (num) => {
    setSelected(prev => prev.includes(num) ? prev.filter(n=>n!==num) : prev.length < 5 ? [...prev,num] : prev);
  };
  const selDrivers = selected.map(n => drivers.find(d => d.num===n)).filter(Boolean);
  const radar = () => {
    if (selDrivers.length < 2) return null;
    const size=280, cx=140, cy=140, R=90;
    const cats = [{k:"superspeedway",l:"SUPER"},{k:"intermediate",l:"INTER"},{k:"short",l:"SHORT"},{k:"road",l:"ROAD"}];
    const step = (2*Math.PI)/cats.length, sa = -Math.PI/2;
    const pt = (a,r) => ({ x:cx+Math.cos(a)*r, y:cy+Math.sin(a)*r });
    let svg = `<svg viewBox="0 0 ${size} ${size}" style="width:100%;max-width:${size}px;display:block;margin:0 auto;">`;
    [25,50,75,100].forEach(v => {
      const rr=(v/100)*R, pts=cats.map((_,i)=>pt(sa+i*step,rr));
      svg+=`<polygon points="${pts.map(p=>`${p.x},${p.y}`).join(" ")}" fill="none" stroke="rgba(255,255,255,0.07)"/>`;
    });
    cats.forEach((c,i) => {
      const a=sa+i*step, ep=pt(a,R+24), lp=pt(a,R);
      svg+=`<line x1="${cx}" y1="${cy}" x2="${lp.x}" y2="${lp.y}" stroke="rgba(255,255,255,0.05)"/>`;
      svg+=`<text x="${ep.x}" y="${ep.y+3}" fill="${TC[c.k]}" font-size="9" font-family="sans-serif" font-weight="700" text-anchor="middle">${c.l}</text>`;
    });
    selDrivers.forEach((d,di) => {
      const col=CC[di%CC.length];
      const pts=cats.map((c,i)=>pt(sa+i*step,((d[c.k]||0)/100)*R));
      svg+=`<polygon points="${pts.map(p=>`${p.x},${p.y}`).join(" ")}" fill="${col}18" stroke="${col}" stroke-width="2"/>`;
      pts.forEach(p=>{svg+=`<circle cx="${p.x}" cy="${p.y}" r="3" fill="${col}"/>`;});
    });
    svg+="</svg>";
    return svg;
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <p style={{ fontSize:11, color:T.textDim, marginBottom:8, letterSpacing:1, textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Select up to 5 drivers to compare</p>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search drivers..."
          style={{ width:"100%", background:T.surface2, border:`1px solid ${T.border}`, color:T.text, borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", marginBottom:10, fontFamily:"'Barlow',sans-serif" }} />
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, maxHeight:160, overflowY:"auto", padding:"2px 0" }}>
          {filtered.map(d => {
            const idx = selected.indexOf(d.num);
            const sel = idx >= 0;
            const col = sel ? CC[idx%CC.length] : "";
            return (
              <div key={d.num} onClick={()=>toggle(d.num)} style={{ padding:"4px 10px", borderRadius:6, fontSize:12, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer", border:`1px solid ${sel?col:T.border}`, background:sel?`${col}20`:T.surface2, color:sel?col:T.textMid, letterSpacing:0.5, transition:"all 0.12s" }}>
                #{d.num} {d.name.split(" ").pop()}
              </div>
            );
          })}
        </div>
      </div>
      {selDrivers.length < 2 ? (
        <div style={{ padding:"40px", textAlign:"center", color:T.textDim, fontSize:13, background:T.surface, border:`1px solid ${T.border}`, borderRadius:12 }}>Select at least 2 drivers to compare.</div>
      ) : (
        <>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"20px 16px" }}>
            <div dangerouslySetInnerHTML={{ __html: radar() }} />
            <div style={{ display:"flex", flexWrap:"wrap", gap:12, justifyContent:"center", marginTop:12 }}>
              {selDrivers.map((d,i) => (
                <span key={d.num} style={{ fontSize:11, fontWeight:700, color:CC[i%CC.length], fontFamily:"'Barlow Condensed',sans-serif", display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ width:10, height:10, borderRadius:"50%", background:CC[i%CC.length], display:"inline-block" }} />
                  #{d.num} {d.name}
                </span>
              ))}
            </div>
          </div>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                  <th style={{ textAlign:"left", padding:"10px 14px", fontSize:10, color:T.textDim, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.5, textTransform:"uppercase" }}>Category</th>
                  {selDrivers.map((d,i) => <th key={d.num} style={{ padding:"10px 12px", fontSize:11, fontWeight:700, color:CC[i%CC.length], fontFamily:"'Barlow Condensed',sans-serif" }}>#{d.num}</th>)}
                </tr>
              </thead>
              <tbody>
                {TRACK_KEYS.map(k => {
                  const vals = selDrivers.map(d => d[k]);
                  const best = Math.max(...vals);
                  return (
                    <tr key={k} style={{ borderBottom:`1px solid ${T.border}` }}>
                      <td style={{ padding:"9px 14px", fontSize:12, color:TC[k], fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif" }}>{TL[k]}</td>
                      {selDrivers.map((d,i) => (
                        <td key={d.num} style={{ padding:"9px 12px", textAlign:"center", fontSize:15, fontWeight:900, fontFamily:"'Barlow Condensed',sans-serif", color:d[k]===best?TC[k]:T.textDim, background:d[k]===best?`${TC[k]}10`:"transparent" }}>
                          {d[k]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TRENDS TAB
// ─────────────────────────────────────────────────────────────
