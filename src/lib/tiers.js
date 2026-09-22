// Rating tier styling (needs theme T). Extracted from NASCARHub.jsx (phase 2).
import { T } from "../theme.js";

export function getTier(r) {
  if (r >= 85) return { bg:"rgba(255,193,7,0.08)",  border:T.gold };
  if (r >= 75) return { bg:"rgba(30,144,255,0.08)", border:T.accent };
  if (r >= 68) return { bg:"rgba(106,155,191,0.06)",border:T.textMid };
  if (r >= 63) return { bg:"rgba(30,60,90,0.06)",   border:"#4a7a9b" };
  return         { bg:"rgba(20,40,60,0.04)",         border:"#3d6a85" };
}


// ─────────────────────────────────────────────────────────────
// MAIN TABS — no admin in nav
// ─────────────────────────────────────────────────────────────
