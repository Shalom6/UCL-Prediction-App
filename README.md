# UCL Final Predictor (Root App)

Everything runs from the repo root:

- Next.js (React) frontend in `app/`
- Express API in `server.js`
- Prediction model files in `src/`

- Win/draw/win probabilities (Poisson-goals model)
- Most likely scorelines
- Expected shots / shots on target / corners / possession / xG
- Anytime goalscorer probabilities (xG share allocation)

## Run locally

```bash
npm install
npm run dev
```

Open:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4001/api/health`

## Polymarket integration

Add your Polymarket Data API key to `.env.local` (repo root or parent `UCL_predictions/.env.local`):

```env
UCL_prediction_api=pk_live_your_key_here
```

Supported routes:

- `GET /api/polymarket?home=PSG&away=Arsenal` — live market odds
- `POST /api/analyst` — Market Analyst (model + Polymarket context)
- `POST /api/predict` — prediction engine (proxied to Express on port 4001)

The UI has **Setup** and **Results & Market Analyst** tabs. Press **Predict** to load Polymarket odds, run the model, and open the analyst view.

## Make it “most accurate”

Right now, team profiles are placeholders in `src/sampleData.js`.

To upgrade accuracy, replace them with real aggregates from a stats API:

- UCL season-to-date (shots, corners, xG, goals for/against)
- Recent form (last 5–10 matches)
- Injuries/lineups (day-of)
- Blend your model with bookmaker implied odds (send `market` to `/api/predict`)

