// Blog tab. Extracted from NASCARHub.jsx (phase 2).
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { T } from "../theme.js";
import { BLOG_CATEGORIES, BLOG_CAT_COLORS } from "../data/siteMeta.js";
import { Ic } from "./icons.jsx";

export function BlogTab({ blogPosts, incrementTool }) {
  const [catFilter, setCatFilter] = useState("All");
  const [viewingPost, setViewingPost] = useState(null);

  // Track blog tab open
  useEffect(() => { incrementTool?.("blog"); }, []);

  const published = useMemo(() =>
    (blogPosts || [])
      .filter(p => p.status === "published")
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [blogPosts]
  );

  const filtered = useMemo(() =>
    catFilter === "All" ? published : published.filter(p => p.category === catFilter),
    [published, catFilter]
  );

  const formatDate = (d) => {
    try { return new Date(d).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" }); }
    catch { return d; }
  };

  const getSnippet = (html) => {
    if (!html) return "";
    const text = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    return text.length > 150 ? text.slice(0, 150) + "…" : text;
  };

  // Handle clicking into a post — track the individual post view
  const openPost = useCallback((post) => {
    setViewingPost(post);
    incrementTool?.("blog_post", { post_title: post.title, post_id: post.id });
  }, [incrementTool]);

  // Load third-party embed scripts when the viewed post contains rich embeds.
  // Re-run per post so client-side navigation re-triggers each provider's scan.
  useEffect(() => {
    if (!viewingPost?.body) return;
    const body = viewingPost.body;
    const ensureScript = (id, src) => new Promise((resolve) => {
      let s = document.getElementById(id);
      if (!s) {
        s = document.createElement("script");
        s.id = id; s.src = src; s.async = true;
        s.onload = resolve; s.onerror = resolve;
        document.body.appendChild(s);
      } else resolve();
    });
    if (body.includes("tiktok-embed")) {
      const old = document.getElementById("tiktok-embed-js");
      if (old) old.remove();
      const s = document.createElement("script");
      s.id = "tiktok-embed-js"; s.src = "https://www.tiktok.com/embed.js"; s.async = true;
      document.body.appendChild(s);
    }
    if (body.includes("twitter-tweet")) {
      ensureScript("twitter-widgets-js", "https://platform.twitter.com/widgets.js")
        .then(() => { window.twttr?.widgets?.load?.(document.querySelector(".blog-article-body")); });
    }
    if (body.includes("instagram-media")) {
      ensureScript("instagram-embed-js", "https://www.instagram.com/embed.js")
        .then(() => { window.instgrm?.Embeds?.process?.(); });
    }
  }, [viewingPost?.id]);

  // Full article view
  if (viewingPost) {
    return (
      <div style={{ maxWidth:780, margin:"0 auto", animation:"fadeIn 0.2s ease" }}>
        <button onClick={() => setViewingPost(null)} style={{
          display:"flex", alignItems:"center", gap:6, padding:"8px 0", marginBottom:16,
          background:"none", border:"none", color:T.accent, cursor:"pointer",
          fontSize:13, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase",
        }}><Ic.ArrowLeft /> Back to Blog</button>

        {viewingPost.featured_image && (
          <div style={{ borderRadius:12, overflow:"hidden", marginBottom:24, border:`1px solid ${T.border}` }}>
            <img src={viewingPost.featured_image} alt="" style={{ width:"100%", maxHeight:400, objectFit:"cover", display:"block" }} />
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <span style={{
            padding:"3px 10px", borderRadius:4, fontSize:10, fontWeight:700,
            fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.5, textTransform:"uppercase",
            background:`${BLOG_CAT_COLORS[viewingPost.category] || T.textDim}20`,
            color: BLOG_CAT_COLORS[viewingPost.category] || T.textDim,
            border:`1px solid ${BLOG_CAT_COLORS[viewingPost.category] || T.textDim}40`,
          }}>{viewingPost.category}</span>
          <span style={{ fontSize:12, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>{formatDate(viewingPost.created_at)}</span>
        </div>

        <h1 style={{
          fontSize:32, fontWeight:900, fontFamily:"'Barlow Condensed',sans-serif",
          letterSpacing:1, lineHeight:1.2, color:T.text, margin:"0 0 24px",
        }}>{viewingPost.title}</h1>

        <div
          className="blog-article-body"
          dangerouslySetInnerHTML={{ __html: viewingPost.body || "" }}
          style={{
            fontSize:16, lineHeight:1.8, color:T.textMid,
            fontFamily:"'Barlow',sans-serif",
          }}
        />

        <style>{`
          .blog-article-body h1,.blog-article-body h2,.blog-article-body h3{color:${T.text};font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;margin:28px 0 12px;font-weight:800;}
          .blog-article-body h1{font-size:26px} .blog-article-body h2{font-size:22px} .blog-article-body h3{font-size:18px}
          .blog-article-body p{margin:0 0 16px}
          .blog-article-body a{color:${T.accent};text-decoration:underline}
          .blog-article-body img{max-width:100%;border-radius:8px;margin:16px 0;border:1px solid ${T.border}}
          .blog-article-body ul,.blog-article-body ol{margin:0 0 16px 24px;color:${T.textMid}}
          .blog-article-body li{margin-bottom:6px}
          .blog-article-body blockquote{border-left:3px solid ${T.accent};padding:8px 16px;margin:16px 0;color:${T.textMid};background:${T.accentSoft};border-radius:0 8px 8px 0}
          .blog-article-body strong,.blog-article-body b{color:${T.text};font-weight:700}
          .blog-article-body blockquote.tiktok-embed,.blog-article-body blockquote.twitter-tweet,.blog-article-body blockquote.instagram-media{border-left:none;background:none;padding:0;border-radius:0}
          .blog-article-body .blog-embed-video{position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:16px 0}
          .blog-article-body .blog-embed-video iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:8px}
          .blog-article-body .tiktok-embed{margin:16px auto !important}
          .blog-article-body .twitter-tweet{margin-left:auto !important;margin-right:auto !important}
          .blog-article-body .instagram-media{margin:16px auto !important}
        `}</style>
      </div>
    );
  }

  // Feed view
  return (
    <div style={{ maxWidth:780, margin:"0 auto" }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:24, fontWeight:900, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:3, textTransform:"uppercase", color:T.text, margin:"0 0 6px" }}>
          VBS <span style={{ color:T.accent }}>Blog</span>
        </h2>
        <p style={{ fontSize:12, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace", margin:0 }}>Race analysis, DFS strategy, predictions & more</p>
      </div>

      {/* Category filter */}
      <div style={{ display:"flex", gap:6, marginBottom:24, flexWrap:"wrap" }}>
        {["All", ...BLOG_CATEGORIES].map(cat => {
          const active = catFilter === cat;
          const col = cat === "All" ? T.accent : (BLOG_CAT_COLORS[cat] || T.textDim);
          return (
            <button key={cat} onClick={() => setCatFilter(cat)} style={{
              padding:"6px 14px", fontSize:11, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif",
              letterSpacing:1.5, textTransform:"uppercase", cursor:"pointer", borderRadius:6,
              background: active ? col : T.surface2,
              color: active ? "#fff" : T.textMid,
              border:`1px solid ${active ? col : T.border}`,
              transition:"all 0.15s",
            }}>{cat}</button>
          );
        })}
      </div>

      {/* Posts feed */}
      {filtered.length === 0 ? (
        <div style={{ padding:40, textAlign:"center", color:T.textDim, fontSize:13, background:T.surface, border:`1px solid ${T.border}`, borderRadius:12 }}>
          {published.length === 0 ? "No posts yet — check back soon!" : "No posts in this category."}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {filtered.map(post => (
            <button key={post.id} onClick={() => openPost(post)} style={{
              display:"flex", gap:16, padding:0, background:T.surface, border:`1px solid ${T.border}`,
              borderRadius:12, cursor:"pointer", textAlign:"left", overflow:"hidden",
              transition:"border-color 0.15s, box-shadow 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.boxShadow = `0 4px 20px ${T.accentGlow}`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
            >
              {post.featured_image && (
                <div style={{ flex:"0 0 160px", minHeight:120 }}>
                  <img src={post.featured_image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                </div>
              )}
              <div style={{ flex:1, padding:"16px 20px", display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{
                    padding:"2px 8px", borderRadius:4, fontSize:9, fontWeight:700,
                    fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1.5, textTransform:"uppercase",
                    background:`${BLOG_CAT_COLORS[post.category] || T.textDim}20`,
                    color: BLOG_CAT_COLORS[post.category] || T.textDim,
                  }}>{post.category}</span>
                  <span style={{ fontSize:11, color:T.textDim, fontFamily:"'IBM Plex Mono',monospace" }}>{formatDate(post.created_at)}</span>
                </div>
                <h3 style={{ fontSize:18, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5, color:T.text, margin:0, lineHeight:1.3 }}>
                  {post.title}
                </h3>
                <p style={{ fontSize:13, color:T.textDim, lineHeight:1.5, margin:0 }}>{getSnippet(post.body)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BLOG ADMIN — Rich text editor + post management
// ─────────────────────────────────────────────────────────────
