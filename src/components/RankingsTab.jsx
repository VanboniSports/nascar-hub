// Power-rankings table tab. Extracted from NASCARHub.jsx (phase 2).
import React, { useState } from "react";
import { T, TC, TL } from "../theme.js";
import { getTier } from "../lib/tiers.js";
import { TRACK_KEYS } from "../data/drivers.js";
import { TrackTypePill, RatingMiniBar } from "./ui.jsx";

export function RankingsTab({ drivers, prevRanks }) {
  const [trackFilter, setTrackFilter] = useState("overall");
  const sorted = [...drivers].sort((a,b) => b[trackFilter]-a[trackFilter]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {TRACK_KEYS.map(k => (
          <TrackTypePill key={k} type={k} active={trackFilter===k} onClick={()=>setTrackFilter(k)} />
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {sorted.map((d, i) => {
          const tier = getTier(d.overall);
          const rank = i+1;
          const prev = prevRanks[d.num]?.[trackFilter];
          const change = prev ? prev - rank : 0;
          return (
            <div key={d.num} style={{ background:tier.bg, border:`1px solid ${tier.border}`, borderLeft:`3px solid ${tier.border}`, borderRadius:10, padding:"14px 18px", transition:"all 0.15s" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:38, height:38, borderRadius:"50%", background:`${tier.border}22`, border:`1px solid ${tier.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:14, color:tier.border, fontFamily:"'Barlow Condensed',sans-serif", flexShrink:0 }}>{rank}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:15, fontWeight:700, color:T.text }}>#{d.num} {d.name}</span>
                    {d.rookie && <span style={{ fontSize:9, fontWeight:700, color:"#4ade80", background:"rgba(34,197,94,0.12)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:4, padding:"1px 6px", letterSpacing:1 }}>ROOKIE</span>}
                    {change > 0 && <span style={{ fontSize:11, fontWeight:700, color:T.green }}>▲{change}</span>}
                    {change < 0 && <span style={{ fontSize:11, fontWeight:700, color:T.red }}>▼{Math.abs(change)}</span>}
                    {change === 0 && prev && <span style={{ fontSize:10, color:T.textDim }}>—</span>}
                  </div>
                  <div style={{ fontSize:12, color:T.textDim, marginTop:2 }}>{d.team} · {d.mfg}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 16px", marginTop:8 }}>
                    {TRACK_KEYS.map(k => (
                      <div key={k}>
                        <div style={{ fontSize:9, color:T.textDim, letterSpacing:1, textTransform:"uppercase", marginBottom:2 }}>{TL[k]}</div>
                        <RatingMiniBar value={d[k]} type={k} />
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize:32, fontWeight:900, color:TC[trackFilter], fontFamily:"'Barlow Condensed',sans-serif", flexShrink:0, letterSpacing:-1 }}>{d[trackFilter]}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
