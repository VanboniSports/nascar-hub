# NASCAR Hub — Deployment Guide

## Project Structure

```
nascar-hub/
├── index.html          ← Entry point (fonts loaded here)
├── package.json        ← Dependencies
├── vite.config.js      ← Vite build config
├── vercel.json         ← SPA routing for Vercel
├── .gitignore
└── src/
    ├── main.jsx        ← React mount point
    └── NASCARHub.jsx   ← The full app (converted from artifact)
```

## What Changed From the Artifact

1. **Supabase** — Now uses the `@supabase/supabase-js` npm package instead of `window.supabase` (CDN global). Same URL and anon key, same behavior.
2. **Storage** — `window.storage` (Claude artifact API) replaced with `localStorage`. Battle Tracker data and CSV cache persist in the browser.
3. **Google Fonts** — Moved from inline `@import` to `<link>` tags in `index.html` for faster loading.

## Deploy to Vercel (Recommended)

### Option A: Via GitHub (auto-deploys on push)

1. Create a GitHub repo and push this folder:
   ```bash
   cd nascar-hub
   git init
   git add .
   git commit -m "Initial deploy"
   git remote add origin https://github.com/YOUR_USERNAME/nascar-hub.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com), sign in with GitHub.

3. Click **"Add New Project"** → Import your `nascar-hub` repo.

4. Vercel auto-detects Vite. Settings should be:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

5. Click **Deploy**. Done — you'll get a `.vercel.app` URL.

### Option B: Via Vercel CLI (no GitHub needed)

```bash
cd nascar-hub
npm install
npm install -g vercel
vercel
```

Follow the prompts. It will build and deploy automatically.

## Deploy to Friend's Server

1. Build locally:
   ```bash
   cd nascar-hub
   npm install
   npm run build
   ```

2. Upload the entire `dist/` folder to the server's web root.

3. Configure the server to serve `index.html` for all routes (SPA fallback):
   - **Nginx:** `try_files $uri $uri/ /index.html;`
   - **Apache:** Add a `.htaccess` with `FallbackResource /index.html`

## Environment Variables (Optional)

The Supabase URL and anon key are hardcoded in the component. The anon key is a **public client-side key** — this is normal and safe for Supabase (it's the `anon` role, protected by Row Level Security).

If you prefer environment variables:

1. Create `.env` in the project root:
   ```
   VITE_SUPABASE_URL=https://xhywifoacvdwkrzunzpg.supabase.co
   VITE_SUPABASE_KEY=eyJhbGci...your_key_here
   ```

2. In `NASCARHub.jsx`, replace the hardcoded values:
   ```js
   const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
   const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
   ```

3. In Vercel dashboard → Settings → Environment Variables, add both.

## Local Development

```bash
cd nascar-hub
npm install
npm run dev
```

Opens at `http://localhost:5173`. Hot-reloads on save.

## Notes

- **CSV Data**: Stored in `localStorage` after upload. Persists across page reloads but is per-browser. Each visitor uploads their own CSV.
- **Battle Tracker**: Also in `localStorage`. Per-browser persistence.
- **Power Rankings**: Stored in Supabase. Shared across all browsers/devices.
- **Admin Password**: Hardcoded as `CassidyH7/15`. Consider moving to an env variable for production if you want to change it easily.
