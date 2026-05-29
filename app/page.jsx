'use client';

import { useState } from 'react';
import AnalystPanel from '../components/AnalystPanel';
import PredictionsPanel from '../components/PredictionsPanel';
import StatsPanel from '../components/StatsPanel';

export default function Page() {
  const [tab, setTab] = useState('predictions');
  const [prediction, setPrediction] = useState(null);

  return (
    <div className="app">
      <header className="uclHero">
        <p className="uclHeroEyebrow">UEFA Champions League</p>
        <h1 className="uclHeroTag">Final Predictor</h1>
        <p className="uclMeta">PSG vs Arsenal · Budapest · May 30, 2026</p>
      </header>

      <nav className="tabBar" aria-label="Main sections">
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
          className={`tab${tab === 'stats' ? ' active' : ''}`}
          aria-selected={tab === 'stats'}
          onClick={() => setTab('stats')}
        >
          Stats
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
      ) : tab === 'stats' ? (
        <StatsPanel fixture={prediction?.fixture ?? null} />
      ) : (
        <AnalystPanel prediction={prediction} />
      )}
    </div>
  );
}
