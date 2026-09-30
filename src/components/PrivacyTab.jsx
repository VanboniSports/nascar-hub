// Privacy Policy page. Rendered at /privacy (not part of the tab nav).
import React from "react";
import { T } from "../theme.js";

const wrap = {
  maxWidth: 880, margin: "0 auto", padding: "36px 22px 72px",
  color: T.text, lineHeight: 1.65,
};
const h1 = {
  fontFamily: "'Barlow Condensed',sans-serif", fontSize: 34, fontWeight: 700,
  letterSpacing: "0.02em", margin: "0 0 4px", color: T.text,
};
const h2 = {
  fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 600,
  margin: "30px 0 8px", color: T.text,
};
const p = { fontSize: 15, color: T.textMid, margin: "0 0 12px" };
const li = { fontSize: 15, color: T.textMid, margin: "0 0 6px" };
const link = { color: T.accentText };
const strong = { color: T.text };

function Section({ title, children }) {
  return (<React.Fragment><h2 style={h2}>{title}</h2>{children}</React.Fragment>);
}

export function PrivacyTab() {
  return (
    <div style={wrap}>
      <h1 style={h1}>Privacy Policy</h1>
      <p style={{ ...p, color: T.textDim }}>Effective date: September 29, 2026</p>
      <p style={p}>Vanboni Sports ("we", "our") operates vanbonisports.com and the Vanboni Sports mobile app. This policy explains what information we collect and how we use it.</p>

      <Section title="Information we collect">
        <p style={p}><strong style={strong}>Analytics information.</strong> We use Google Analytics to understand how visitors use the site and app. This includes the pages you visit, the features you use (such as running a prediction or using the DFS optimizer), your device and browser type, and approximate location derived from your IP address. Google Analytics uses cookies and similar identifiers for this purpose.</p>
        <p style={p}><strong style={strong}>Information you choose to share.</strong> If you submit the feedback form, we receive whatever you type into it. The form is hosted by Google Forms, so Google's privacy policy also applies to that submission.</p>
        <p style={p}><strong style={strong}>No accounts required.</strong> You can use every public feature of the site and app without signing up or providing a name or email address.</p>
      </Section>

      <Section title="How we use information">
        <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
          <li style={li}>To operate, maintain, and improve the site and app.</li>
          <li style={li}>To understand which features and content readers use most.</li>
          <li style={li}>To detect and fix technical problems.</li>
        </ul>
      </Section>

      <Section title="Cookies">
        <p style={p}>We use cookies for analytics as described above. You can block or delete cookies in your browser settings and the site will still work. You can also opt out of Google Analytics entirely with <a style={link} href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google's opt-out browser add-on</a>.</p>
      </Section>

      <Section title="Third-party services">
        <p style={p}>We share data only as needed to run the site, with the following service providers:</p>
        <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
          <li style={li}>Google Analytics (usage analytics)</li>
          <li style={li}>Supabase (database hosting for site content such as standings and rankings)</li>
          <li style={li}>Vercel (website hosting)</li>
          <li style={li}>Google Forms (feedback submissions)</li>
        </ul>
        <p style={p}>We do not sell your personal information.</p>
      </Section>

      <Section title="Data security and retention">
        <p style={p}>Traffic to the site and app is encrypted in transit (HTTPS). Analytics data is retained according to Google Analytics' retention settings.</p>
      </Section>

      <Section title="Children's privacy">
        <p style={p}>Vanboni Sports is intended for a general sports audience and is not directed at children under 13. We do not knowingly collect personal information from children under 13.</p>
      </Section>

      <Section title="Your choices">
        <p style={p}>You can opt out of analytics with the Google Analytics opt-out add-on linked above, or by blocking cookies in your browser. To ask about your data, contact us below.</p>
      </Section>

      <Section title="Changes to this policy">
        <p style={p}>If we change this policy, we will post the updated version here and revise the effective date above.</p>
      </Section>

      <Section title="Contact">
        <p style={p}>Questions about this policy: <a style={link} href="mailto:vanbonisports@gmail.com">vanbonisports@gmail.com</a>. You can also reach us through the feedback form linked in the site footer.</p>
      </Section>
    </div>
  );
}

export default PrivacyTab;
