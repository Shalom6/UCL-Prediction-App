import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });
import cors from 'cors';

import { buildPrediction } from './src/predictor.js';
import { buildAnalystAnswer } from './src/analyst.js';
import { buildPredictionsResponse } from './src/predictionsEngine.js';
import { getFixtureContext, getTeamProfiles } from './src/sampleData.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function round(n, dp = 1) {
  const p = 10 ** dp;
  return Math.round(n * p) / p;
}

function estimateFouls({ home, away, fixture }) {
  const finalTempo = fixture?.finalTempo ?? 0.95;
  const homeControl = home?.control ?? 0.5;
  const awayControl = away?.control ?? 0.5;
  const shareHome = clamp(homeControl / (homeControl + awayControl || 1), 0.35, 0.65);

  // Finals tend to be tighter + slightly lower tempo.
  // Underdogs usually foul a bit more due to less control / more defending.
  const baseTotal = 24 * finalTempo;
  const homeShare = clamp(0.5 - (shareHome - 0.5) * 0.6, 0.42, 0.58);

  const homeFouls = clamp(baseTotal * homeShare, 8, 20);
  const awayFouls = clamp(baseTotal * (1 - homeShare), 8, 20);

  return { home: round(homeFouls, 1), away: round(awayFouls, 1) };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.post('/api/predict', (req, res) => {
  try {
    const fixture = getFixtureContext(req.body);
    const { home, away } = getTeamProfiles(fixture.homeTeam, fixture.awayTeam);

    const prediction = buildPrediction({
      fixture,
      home,
      away,
      market: req.body?.market,
      blend: req.body?.blend
    });

    res.json(prediction);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Prediction failed', detail: String(err?.message ?? err) });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const fixture = getFixtureContext({
      homeTeam: req.query?.homeTeam,
      awayTeam: req.query?.awayTeam,
      venueCity: req.query?.venueCity,
      date: req.query?.date,
      neutralVenue: req.query?.neutralVenue === undefined ? undefined : String(req.query.neutralVenue) !== '0'
    });

    const { home, away } = getTeamProfiles(fixture.homeTeam, fixture.awayTeam);
    const prediction = buildPrediction({ fixture, home, away, market: null, blend: { marketWeight: 0, modelWeight: 1 } });

    const fouls = estimateFouls({ home, away, fixture });

    res.json({
      fixture: prediction.fixture,
      predictedStats: {
        home: { ...prediction.expectedStats.home, fouls: fouls.home },
        away: { ...prediction.expectedStats.away, fouls: fouls.away }
      },
      goalscorers: prediction.topScorers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stats failed', detail: String(err?.message ?? err) });
  }
});

app.post('/api/predictions', async (req, res) => {
  try {
    const payload = await buildPredictionsResponse(req.body);
    res.json(payload);
  } catch (err) {
    console.error(err);
    const status = String(err?.message ?? '').includes('different') ? 400 : 500;
    res.status(status).json({ error: 'Predictions failed', detail: String(err?.message ?? err) });
  }
});

app.post('/api/analyst', (req, res) => {
  try {
    const question = req.body?.question;
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'question is required' });
    }
    const answer = buildAnalystAnswer({
      question: String(question).trim(),
      context: req.body?.context ?? null,
      polymarket: req.body?.polymarket ?? null
    });
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analyst failed', detail: String(err?.message ?? err) });
  }
});

const port = Number(process.env.PORT || 4001);
app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});

