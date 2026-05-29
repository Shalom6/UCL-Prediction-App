# UCL Final Predictor (Root App)

Everything runs from the repo root:

- **Next.js UI** in `app/` and `components/`
- **Express API** in `server.js`
- **Model & integrations** in `src/`

## Project structure

```
app/
  layout.jsx          # Root layout + global CSS
  page.jsx            # Tabs: Predictions | Stats | Market Analyst
  globals.css         # App styles (no Tailwind)
  api/
    predictions/      # POST — blended predictions engine
    polymarket/       # GET — live Polymarket odds
    analyst/          # POST — market analyst Q&A
    stats/            # GET — match stats (Module 2 API)
    predict/          # POST — proxy to Express predict

components/
  PredictionsPanel.jsx
  AnalystPanel.jsx

src/
  predictor.js        # Poisson model
  predictionsEngine.js
  polymarket.js
  analyst.js
  stats.js
  teamProfiles.js     # historical (2000-2026) + 2025-26 blend
  sampleData.js
  data/
    historical-index.json
    psg.json
    arsenal.json

scripts/
  sync-bundled-data.mjs        # sync curated rosters into team JSON
  import-balldontlie.mjs       # refresh from BallDontLie UCL API

server.js             # Express on port 4001
```

## Run locally

```bash
npm install
npm run dev
```

Open:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4001/api/health`

## Polymarket integration

Add your Polymarket Data API key to `.env.local` (repo root):

```env
POLYMARKET_DATA_API_KEY=pk_live_your_key_here
```

The app also falls back to the public Polymarket Gamma API when needed.

## Team data (historical + 2025-26)

Profiles blend **UCL era baselines (2000-2026)**, **2025-26 season stats**, and **last-10 form**, with **current rosters** for goalscorer models.

| Input | Weight | File |
|-------|--------|------|
| Historical UCL era | 20% | `src/data/*.json` → `historical` |
| 2025-26 UCL season | 65% | `season2025_26.ucl` |
| Last 10 matches | 15% | `season2025_26.formLast10` |

Team stats, form, and rosters live in **`src/data/`** (curated JSON). Refresh UCL standings from BallDontLie **without replacing** bundled stats:

```bash
# BALLDONTLIE_API_KEY in .env.local
npm run import:balldontlie
```

**Merge behaviour (free tier):**
- **From API:** UCL W/D/L, goals for/against, roster name/position cross-check
- **From bundled:** xG, shots, corners, league + mixed form, starter minutes & xG shares

Hand-edit squads in `src/data/rosters-2025-26.json`, then:

```bash
npm run sync:data
```

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/predictions` | POST | Win probs, scorelines, verdict (+ Polymarket blend) |
| `/api/polymarket` | GET | Live market odds |
| `/api/analyst` | POST | Market analyst (free Groq AI if `GROQ_API_KEY` set, else rules) |
| `/api/stats` | GET | Expected stats & goalscorers |
| `/api/predict` | POST | Full predict payload (Express proxy) |

## UI tabs

**Predictions** — run the engine and view probabilities.  
**Stats** — expected match stats, fouls, and goalscorer probabilities (`/api/stats`).  
**Market Analyst** — free [Groq](https://console.groq.com/) AI when `GROQ_API_KEY` is set; else rule-based fallback.

```env
GROQ_API_KEY=gsk_...
```

Styling uses `app/globals.css` only (custom glass UI).
