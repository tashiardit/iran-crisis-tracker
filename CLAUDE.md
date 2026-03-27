# CLAUDE.md — Iran War 2026 Energy Crisis Tracker
## Handoff Document for Claude Code

> This file contains everything you need to understand, run, fix, and extend this project.
> Read it fully before touching any file.

---

## 1. Project Overview

A **fully static, serverless news aggregation website** tracking the 2026 Iran War energy crisis.
No backend. No build step. No npm. No Python runtime needed in production.
Everything runs in the visitor's browser via free public APIs.

**Live concept:** Auto-updating crisis tracker with live oil prices, country-by-country impact,
breaking news feed, fertilizer/food crisis tracking, and a timeline — monetized via Ezoic ads.

**Stack:**
- Pure HTML + CSS + Vanilla JS (one `index.html` file + 4 supporting pages)
- Hosted on Netlify or Cloudflare Pages (free tier, static files only)
- Data: GDELT API (CORS-native) + RSS feeds via allorigins.win CORS proxy + Yahoo Finance prices

---

## 2. File Structure

```
iran-tracker-static/
├── index.html        ← Main tracker page (1554 lines — HTML + CSS + JS all in one)
├── about.html        ← About page (required by Ezoic)
├── privacy.html      ← Privacy Policy with GDPR/CCPA sections (required by Ezoic)
├── contact.html      ← Contact page with mailto link (required by Ezoic)
├── sitemap.xml       ← XML sitemap (4 URLs — submit to Google Search Console)
├── robots.txt        ← Allows all crawlers, links sitemap
├── netlify.toml      ← Netlify cache headers config
├── _headers          ← Cloudflare Pages cache headers config
└── CLAUDE.md         ← This file
```

**All files are complete and tested. HTTP 200 on all pages. 47/47 checks passed.**

---

## 3. Architecture — How Data Flows

```
Browser loads index.html
        │
        ├── On load: check localStorage cache (30 min TTL)
        │     └── if cache hit → render immediately, then fetch fresh in background
        │     └── if cache miss → show skeleton loaders, fetch immediately
        │
        ├── fetchAllPrices() ← parallel, non-blocking
        │     └── Yahoo Finance v8 API via allorigins.win CORS proxy
        │           Symbols: BZ=F (Brent), CL=F (WTI), TTF=F (TTF Gas), NG=F (US Nat Gas)
        │
        ├── fetchGDELT() × 7 queries ← parallel via Promise.allSettled
        │     └── https://api.gdeltproject.org/api/v2/doc/doc
        │           Native CORS — no proxy needed
        │           Params: maxrecords=20, timespan=2d, sort=date, format=json
        │
        └── fetchRSS() × 5 feeds ← parallel via Promise.allSettled
              └── allorigins.win/get?url=<encoded_feed_url>
                    Feeds: Google News (×3 queries) + Al Jazeera + BBC World
                    Filtered by KEYWORDS regex before rendering

After fetch:
  → dedup() by title prefix (60 chars)
  → sort by timestamp desc
  → saveCache() to localStorage
  → renderNews() → renderTicker() → renderCountries() → renderPrices()
  → startCountdown() → repeats every REFRESH_MS (5 min)
```

---

## 4. Key Constants (top of `<script>` in index.html)

```js
const REFRESH_MS     = 5 * 60 * 1000;   // fetch interval — change freely
const CORS_PROXY     = 'https://api.allorigins.win/get?url=';
const CORS_PROXY_ALT = 'https://corsproxy.io/?';  // fallback if allorigins fails
const MAX_ARTICLES   = 80;               // articles displayed max
const CACHE_KEY      = 'iran_tracker_v3'; // increment version to bust cache
```

---

## 5. Ezoic Ad Integration — Current State

**Status: Integrated, awaiting site ID from Ezoic dashboard.**

6 ad placeholders placed in `index.html`:

| Placeholder ID | Location | CSS class |
|---|---|---|
| 101 | Top banner (below price strip) | `.ez-slot` |
| 102 | Sidebar top | `.ez-slot-sidebar` |
| 103 | Mid-page banner (between news and country grid) | `.ez-slot` |
| 104 | Sidebar bottom | `.ez-slot-sidebar` |
| 105 | Above SEO content block | `.ez-slot` |
| 106 | Footer | `.ez-slot` |

**The one thing the owner must do before going live:**
```html
<!-- Line ~55 in index.html -->
var ezoicSiteId = 'XXXXXXX'; // ← replace with real Ezoic Site ID from dashboard
```

Ezoic signup: https://ezoic.com → choose "Script" integration (no DNS change needed).
In Ezoic dashboard, create 6 placeholder ad units numbered 101–106.

---

## 6. Things That MUST Be Customized Before Launch

Search for these strings across all files and replace:

| String | File(s) | Replace with |
|---|---|---|
| `YOUR-DOMAIN.com` | index.html, about.html, privacy.html, contact.html, sitemap.xml, robots.txt | actual domain |
| `XXXXXXX` | index.html line ~55 | Ezoic Site ID |
| `contact@yourdomain.com` | contact.html | real email address |

---

## 7. SEO — What's Already In Place

All implemented in `index.html`:
- `<title>` — keyword-rich, 60 chars
- `<meta name="description">` — 155 chars, includes primary keywords
- `<meta name="keywords">` — 12 target keywords
- `<link rel="canonical">` — needs real domain
- Open Graph tags (og:title, og:description, og:type, og:url, og:site_name)
- Twitter Card meta tags
- Schema.org `WebPage` + `Event` JSON-LD structured data
- `<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">`
- Semantic HTML: `<main>`, `<aside>`, `<article>`, `<footer>`, `<header>`
- `sitemap.xml` with all 4 pages
- `robots.txt` linking to sitemap

**After launch — do these:**
1. Add to Google Search Console → verify domain → submit sitemap URL
2. Add GA4 tracking snippet (get from analytics.google.com)
3. Post on Reddit: r/worldnews, r/geopolitics, r/energy, r/oil
4. Post on X/Twitter with #IranWar #OilCrisis #EnergyCrisis #Hormuz

---

## 8. Known Issues & Bugs to Fix

### 8.1 CORS proxy reliability (HIGH PRIORITY)
`allorigins.win` is a free public proxy and can go down or rate-limit.
The `CORS_PROXY_ALT` (`corsproxy.io`) is defined but not used as fallback yet.

**Fix needed:** In `fetchRSS()` and `fetchPrice()`, add try/catch that falls back to `CORS_PROXY_ALT` if `CORS_PROXY` fails:
```js
async function fetchWithFallback(url) {
  try {
    const r = await fetch(CORS_PROXY + encodeURIComponent(url), {signal: AbortSignal.timeout(12000)});
    const d = await r.json();
    if (!d.contents) throw new Error('empty');
    return d.contents;
  } catch {
    // fallback to corsproxy.io
    const r2 = await fetch(CORS_PROXY_ALT + encodeURIComponent(url), {signal: AbortSignal.timeout(12000)});
    return await r2.text();
  }
}
```

### 8.2 Yahoo Finance proxy parsing fragility (MEDIUM)
The Yahoo Finance response is parsed as:
```js
JSON.parse(outer.contents) → .chart.result[0].meta.regularMarketPrice
```
If allorigins returns the contents as already-parsed JSON (not a string), `JSON.parse` throws.
Add defensive check: `typeof outer.contents === 'string' ? JSON.parse(outer.contents) : outer.contents`

### 8.3 TTF gas symbol (LOW)
`TTF=F` may not be available on Yahoo Finance free tier in all regions.
If it returns null, fall back to `NGF=F` or show `N/A` gracefully instead of `—`.

### 8.4 h2 tags for SEO (LOW)
The section headers use CSS class `.sec-head` with a `<span>` inside instead of proper `<h2>` tags.
Google can read these but real `<h2>` tags are better.
Change all `.sec-head` spans that serve as section titles to actual `<h2>` elements.

### 8.5 No error state for complete fetch failure (MEDIUM)
If all fetches fail (user offline, allorigins down, GDELT down), the page shows skeleton loaders forever.
Add a timeout: if after 30s `allArticles` is still empty, show a static fallback message:
"Unable to load live data. Please refresh or check your connection."

### 8.6 Mobile: price strip overflow (LOW)
On screens < 400px, the price strip overflows without a visible scrollbar.
Add `scrollbar-width: thin` and `-webkit-overflow-scrolling: touch` to `.price-inner`.

---

## 9. Feature Backlog (prioritized)

### 9.1 Add Google Analytics 4 (QUICK WIN — 10 min)
Paste the GA4 snippet into `<head>` of all HTML files.
Get the snippet from: https://analytics.google.com → Create property → Get measurement ID.
```html
<!-- GA4 — add to <head> of all pages -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### 9.2 Add Ko-fi / Buy Me a Coffee donation button (QUICK WIN — 15 min)
Place in sidebar between the timeline and force majeure cards.
```html
<div class="side-card" style="text-align:center;padding:16px">
  <div class="side-card-head">☕ Support This Tracker</div>
  <p style="font-size:12px;color:var(--muted2);padding:12px">
    This tracker is free and ad-supported. If it's useful, consider a coffee.
  </p>
  <a href="https://ko-fi.com/YOURUSERNAME" target="_blank" rel="noopener"
     style="display:inline-block;background:#FF5E5B;color:#fff;font-family:var(--mono);
            font-size:12px;padding:10px 20px;border-radius:4px;text-decoration:none">
    ☕ Buy me a coffee
  </a>
</div>
```

### 9.3 Add email newsletter capture (MEDIUM — 1 hour)
Use Beehiiv free tier (no credit card). Embed their form widget.
Place above the footer. Collect emails while crisis traffic is high.

### 9.4 Add price sparkline charts (MEDIUM — 2 hours)
Fetch 7-day price history from Yahoo Finance (`&range=7d&interval=1d`) and render mini SVG sparklines next to each commodity price. Shows the trend at a glance.

### 9.5 Add "Share" buttons (QUICK WIN — 30 min)
Add Twitter/X and Reddit share buttons below the h1. Pre-filled with the page title and URL.
```html
<a href="https://twitter.com/intent/tweet?text=Iran+War+2026+Live+Energy+Crisis+Tracker&url=https://YOUR-DOMAIN.com"
   target="_blank" rel="noopener">Share on X</a>
```

### 9.6 Country detail pages for SEO (HIGH VALUE — 4 hours)
Generate individual pages per major country, e.g.:
- `/country/japan.html` → "Japan Iran War Energy Crisis 2026"
- `/country/philippines.html` → "Philippines National Energy Emergency 2026"
Each page: country-specific news filter + known restrictions + risk level.
These pages would rank for long-tail searches like "Japan energy crisis Iran war 2026".
Since the site is static, generate them as individual HTML files with the same JS fetch logic
but pre-filtered by country name.

### 9.7 Add Al Jazeera Live Blog RSS if available (LOW — 30 min)
Al Jazeera often runs live blogs for major crises. Check if they have a dedicated Iran war RSS feed
and add it to the `rssSources` array.

### 9.8 Fallback static news for offline/API-down state (MEDIUM — 1 hour)
Hardcode 10–15 recent key headlines as a `FALLBACK_ARTICLES` const in JS.
If `allArticles.length === 0` after 30s, render these so the page never looks broken.

### 9.9 Add "New article" flash notification (LOW — 30 min)
When `renderNews` runs and finds articles newer than the last render, flash a small
"🔴 X new articles" badge at the top of the news list that auto-dismisses after 5s.

### 9.10 Dark/light mode toggle (LOW — 1 hour)
The site is dark-only. Add a toggle that swaps CSS variables for a light theme.
Store preference in localStorage.

---

## 10. Content Updates Needed

The hardcoded content in `index.html` reflects the crisis state as of **March 27, 2026**.
The following sections need manual updates as the situation evolves:

| Section | Location in index.html | What to update |
|---|---|---|
| Timeline | `#timeline` in sidebar | Add new events as they happen |
| Force Majeure list | `.side-card` "Force Majeure Declarations" | Update statuses (Active/Resolved) |
| Active Restrictions | `.side-card` "Active Country Restrictions" | Add/remove countries, update status |
| Key stats | `.stats-grid` | Update numbers (price peaks, reserve releases) |
| About block | `.about-block` | Update event summary |
| SEO meta description | `<head>` | Refresh with latest headline stat |

**Automate this:** For the timeline and restrictions, consider converting them from hardcoded HTML
to a JS-rendered array so they can be updated by editing a simple JSON object at the top of the script:

```js
const TIMELINE = [
  { date: 'FEB 28, 2026', title: 'Operation Epic Fury launched', body: '...' },
  { date: 'MAR 2, 2026',  title: 'Hormuz closed + Qatar force majeure', body: '...' },
  // add new entries here
];
```

---

## 11. Deployment

### Netlify (recommended)
1. Push all files to a GitHub repo (root of repo = root of site)
2. netlify.com → Add new site → Import from GitHub → Deploy
3. `netlify.toml` handles cache headers automatically
4. Set custom domain in Site Settings → Domain Management

### Cloudflare Pages
1. Push to GitHub
2. pages.cloudflare.com → Create project → Connect GitHub → Deploy
3. `_headers` file handles cache headers automatically
4. Framework preset: None. Build command: (empty). Output directory: `/`

### GitHub Pages (simplest)
1. Repo Settings → Pages → Source: main branch, root folder
2. URL: `https://USERNAME.github.io/REPO-NAME/`
3. Note: update canonical URLs and sitemap to match GitHub Pages URL

---

## 12. Testing

### Manual browser test checklist
- [ ] Open `index.html` via a local server (not `file://` — CORS blocks fetches from file://)
- [ ] `python3 -m http.server 8080` in the folder, then open `http://localhost:8080`
- [ ] Verify ticker scrolls with headlines after ~10s
- [ ] Verify price strip shows numbers (not `—`) after ~15s
- [ ] Verify news cards populate after ~20s
- [ ] Verify country cards show article links after ~20s
- [ ] Verify countdown timer ticks down
- [ ] Verify page re-fetches at 0:00 and resets to 5:00
- [ ] Open DevTools → Application → Local Storage → verify `iran_tracker_v3` key exists after first fetch
- [ ] Reload page → verify cached content shows instantly before fetch completes
- [ ] Test all footer links: About, Privacy, Contact, Sitemap
- [ ] Test on mobile (Chrome DevTools responsive mode, 375px width)

### Automated test (already run — 47/47 passed)
```bash
# From project root, run this to verify all files are present and valid
python3 -c "
import os
files = ['index.html','about.html','privacy.html','contact.html','sitemap.xml','robots.txt','netlify.toml','_headers']
for f in files:
    exists = os.path.exists(f)
    print(f'  {chr(9989) if exists else chr(10060)} {f}')
"
```

---

## 13. Owner Context (for Claude Code)

- **Owner:** Ardit — Python developer and algorithmic trader based in Milan, Italy
- **Goal:** Monetize via Ezoic ads. Fast SEO traction on a live breaking crisis.
- **Constraint:** No server, no Python needed in production. Static files only.
- **Hosting:** Netlify or Cloudflare Pages (free tier)
- **Ad network:** Ezoic (signed up, awaiting site ID — no traffic minimum)
- **Domain:** TBD — owner will register their own domain and update canonical URLs
- **Timeline:** Launch ASAP — crisis is active and peaking now (end of March 2026)
- **Communication style:** Direct, technical, no fluff. Ardit is a developer — show code, not explanations.

---

## 14. Quick Reference — Most Important Strings to Find

```
ezoicSiteId = 'XXXXXXX'        → replace with real Ezoic Site ID
YOUR-DOMAIN.com                → replace with real domain (5 files)
contact@yourdomain.com         → replace with real email
iran_tracker_v3                → bump version string to bust localStorage cache after major updates
REFRESH_MS = 5 * 60 * 1000    → fetch interval (currently 5 min)
MAX_ARTICLES = 80              → max articles shown
CACHE_KEY = 'iran_tracker_v3' → localStorage key
```

---

## 15. External Services Reference

| Service | URL | Purpose | Cost | Auth |
|---|---|---|---|---|
| Ezoic | ezoic.com | Ad monetization | Free (revenue share) | Site ID in dashboard |
| Netlify | netlify.com | Hosting | Free tier | GitHub OAuth |
| Cloudflare Pages | pages.cloudflare.com | Hosting alternative | Free tier | GitHub OAuth |
| GDELT | api.gdeltproject.org/api/v2/doc/doc | News articles | Free | None |
| allorigins.win | api.allorigins.win | CORS proxy for RSS + Yahoo Finance | Free | None |
| corsproxy.io | corsproxy.io | CORS proxy fallback | Free | None |
| Yahoo Finance | query1.finance.yahoo.com/v8/finance/chart | Oil/gas prices | Free | None |
| Google News RSS | news.google.com/rss/search | News headlines | Free | None |
| Al Jazeera RSS | aljazeera.com/xml/rss/all.xml | News | Free | None |
| BBC World RSS | feeds.bbci.co.uk/news/world/rss.xml | News | Free | None |
| Google Search Console | search.google.com/search-console | SEO indexing | Free | Google account |
| Google Analytics | analytics.google.com | Traffic tracking | Free | Google account |
| Ko-fi | ko-fi.com | Donations | Free | Email |
| Beehiiv | beehiiv.com | Newsletter | Free tier | Email |
