import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });
import cors from 'cors';

import { getAnalystAnswer } from './src/analyst.js';
import { buildPrediction } from './src/predictor.js';
import { buildPredictionsResponse } from './src/predictionsEngine.js';
import { buildStatsResponse } from './src/stats.js';
import { getFixtureContext, getTeamProfiles } from './src/sampleData.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
    res.json(buildStatsResponse(req.query));
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

app.post('/api/analyst', async (req, res) => {
  try {
    const question = req.body?.question;
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'question is required' });
    }
    const result = await getAnalystAnswer({
      question: String(question).trim(),
      prediction: req.body?.prediction ?? null,
      polymarket: req.body?.polymarket ?? req.body?.prediction?.polymarket ?? null,
      history: req.body?.history ?? [],
      context: req.body?.context ?? null
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analyst failed', detail: String(err?.message ?? err) });
  }
});

const port = Number(process.env.PORT || 4001);
app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});

