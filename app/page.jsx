'use client';

import { useState } from 'react';
import AnalystPanel from '../AnalystPanel';
import PredictionsPanel from '../components/PredictionsPanel';

/** Maps /api/predictions payload to the shape AnalystPanel expects (unchanged component). */
function toAnalystPredictionContext(data) {
  if (!data) return null;
  return {
    fixture: data.fixture,
    blended: data.probabilities,
    model: { outcome: data.modelProbabilities },
    market: data.marketProbabilities,
    topScorelines: data.scorelines ?? [],
    topScorers: data.topScorers ?? [],
    expectedStats: data.expectedStats ?? null
  };
}

export default function Page() {
  const [tab, setTab] = useState('predictions');
  const [prediction, setPrediction] = useState(null);

  const analystContext = toAnalystPredictionContext(prediction);

  return (
    <div className="app">
      <nav className="tabBar glass" aria-label="Main sections">
        <button
          type="button"
          className={`tab${tab === 'predictions' ? ' active' : ''}`}
          aria-selected={tab === 'predictions'}
          onClick={() => setTab('predictions')}
        >
          Predictions
        </button>
        <button
          type="button"
          className={`tab${tab === 'analyst' ? ' active' : ''}`}
          aria-selected={tab === 'analyst'}
          onClick={() => setTab('analyst')}
        >
          Market Analyst
        </button>
      </nav>

      {tab === 'predictions' ? (
        <PredictionsPanel onPredictionUpdate={setPrediction} />
      ) : (
        <AnalystPanel predictionContext={analystContext} polymarketSnapshot={prediction?.polymarket ?? null} />
      )}
    </div>
  );
}
