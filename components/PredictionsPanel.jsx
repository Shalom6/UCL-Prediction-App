'use client';

import { useEffect, useMemo, useState } from 'react';

const TEAM_OPTIONS = ['PSG', 'Arsenal'];

function pct(n) {
  return typeof n === 'number' ? `${n.toFixed(1)}%` : '—';
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function ProbBar({ home, draw, away }) {
  return (
    <div className="probBar" aria-label="Win probability bar">
      <div className="seg home" style={{ width: `${clamp(home ?? 0, 0, 100)}%` }} />
      <div className="seg draw" style={{ width: `${clamp(draw ?? 0, 0, 100)}%` }} />
      <div className="seg away" style={{ width: `${clamp(away ?? 0, 0, 100)}%` }} />
    </div>
  );
}

function TrophyBar({ home, away, homeName, awayName }) {
  const h = clamp(home ?? 0, 0, 100);
  const a = clamp(away ?? 0, 0, 100);
  const denom = h + a || 1;
  return (
    <div className="probBar trophyBar" aria-label="To lift trophy probability bar">
      <div className="seg home" style={{ width: `${(h / denom) * 100}%` }} title={homeName} />
      <div className="seg away" style={{ width: `${(a / denom) * 100}%` }} title={awayName} />
    </div>
  );
}

function ProbRow({ label, p, homeName, awayName }) {
  if (!p) return null;
  return (
    <div className="sourceBlock">
      <div className="sourceLabel">{label}</div>
      <div className="triple compact">
        <div className="pill">
          <div className="pillLabel">{homeName}</div>
          <div className="pillValue smallVal">{pct(p.homeWin)}</div>
        </div>
        <div className="pill">
          <div className="pillLabel">Draw</div>
          <div className="pillValue smallVal">{pct(p.draw)}</div>
        </div>
        <div className="pill">
          <div className="pillLabel">{awayName}</div>
          <div className="pillValue smallVal">{pct(p.awayWin)}</div>
        </div>
      </div>
    </div>
  );
}

export default function PredictionsPanel({ onPredictionUpdate }) {
  const [homeTeam, setHomeTeam] = useState('PSG');
  const [awayTeam, setAwayTeam] = useState('Arsenal');
  const [neutralVenue, setNeutralVenue] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const validTeams = homeTeam !== awayTeam;

  const subtitle = useMemo(() => {
    if (!data?.fixture) return 'UEFA Champions League · Final · Budapest · May 30';
    const f = data.fixture;
    return `${f.competition} · ${f.stage} · ${f.venueCity} · ${f.date}`;
  }, [data]);

  async function load() {
    if (!validTeams) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeTeam, awayTeam, neutralVenue })
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('Server returned invalid JSON. Run npm run dev and refresh.');
      }

      if (!res.ok) throw new Error(json?.error || json?.detail || 'Failed to load predictions');
      setData(json);
      onPredictionUpdate?.(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const p = data?.probabilities;
  const ko = data?.knockout;
  const homeName = data?.fixture?.homeTeam ?? 'PSG';
  const awayName = data?.fixture?.awayTeam ?? 'Arsenal';
  const pm = data?.polymarket;
  const hasMarket = Boolean(data?.marketProbabilities);

  return (
    <section className="predictionsEngine">
      <header className="nav glass">
        <div className="navLeft">
          <div className="navTitleWrap">
            <div className="navTitle">Final Predictor</div>
            <div className="navSubtitle">{subtitle}</div>
          </div>
        </div>
        <div className="navRight">
          <button type="button" className="btnPrimary" disabled={!validTeams || loading} onClick={load}>
            {loading ? 'Updating…' : 'Predict'}
          </button>
        </div>
      </header>

      <div className="glass controls">
        <div className="controlsRow">
          <div className="control">
            <div className="controlLabel">Home</div>
            <div className="selectWrap">
              <select className="select" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)}>
                {TEAM_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="chev" aria-hidden="true">
                ⌄
              </div>
            </div>
          </div>
          <div className="control">
            <div className="controlLabel">Away</div>
            <div className="selectWrap">
              <select className="select" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)}>
                {TEAM_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="chev" aria-hidden="true">
                ⌄
              </div>
            </div>
          </div>
          <div className="control toggleControl">
            <div className="controlLabel">Venue</div>
            <label className="toggle">
              <input type="checkbox" checked={neutralVenue} onChange={(e) => setNeutralVenue(e.target.checked)} />
              <span className="track" aria-hidden="true" />
              <span className="toggleText">Neutral</span>
            </label>
          </div>
        </div>
        {!validTeams ? <div className="error">Pick two different teams.</div> : null}
        {error ? <div className="error">{error}</div> : null}
      </div>

      {pm && !pm.found && pm.message ? (
        <div className="glass card infoCard">
          <p className="muted small">{pm.message}</p>
        </div>
      ) : null}

      {pm?.found && pm.marketQuestion ? (
        <div className="glass card infoCard">
          <p className="muted small">
            <span className="badge">Polymarket</span> {pm.marketQuestion}
            {pm.source ? <span className="dot"> · </span> : null}
            {pm.source ? <span>{pm.source}</span> : null}
          </p>
          {pm.note ? <p className="muted small">{pm.note}</p> : null}
          {pm.dataApiNote ? <p className="muted small">{pm.dataApiNote}</p> : null}
        </div>
      ) : null}

      <div className="grid">
        <section className="glass card">
          <div className="cardTitle">Win probabilities {hasMarket ? '(blended)' : '(model)'} · 90 minutes</div>
          <div className="triple">
            <div className="pill">
              <div className="pillLabel">{homeName}</div>
              <div className="pillValue">{pct(p?.homeWin)}</div>
            </div>
            <div className="pill">
              <div className="pillLabel">Draw</div>
              <div className="pillValue">{pct(p?.draw)}</div>
            </div>
            <div className="pill">
              <div className="pillLabel">{awayName}</div>
              <div className="pillValue">{pct(p?.awayWin)}</div>
            </div>
          </div>
          <ProbBar home={p?.homeWin} draw={p?.draw} away={p?.awayWin} />

          {ko ? (
            <div className="sourceBlock knockoutBlock">
              <div className="sourceLabel">If level after 90 minutes</div>
              <div className="knockoutPills">
                <div className="pill">
                  <div className="pillLabel">Extra time</div>
                  <div className="pillValue smallVal">{pct(ko.extraTimePct)}</div>
                </div>
                <div className="pill">
                  <div className="pillLabel">Penalties</div>
                  <div className="pillValue smallVal">{pct(ko.penaltiesPct)}</div>
                </div>
              </div>
            </div>
          ) : null}

          {ko ? (
            <div className="sourceBlock">
              <div className="sourceLabel">To lift the trophy (incl. ET &amp; pens)</div>
              <div className="triple compact">
                <div className="pill">
                  <div className="pillLabel">{homeName}</div>
                  <div className="pillValue smallVal">{pct(ko.toLiftTrophy?.homeWin)}</div>
                </div>
                <div className="pill">
                  <div className="pillLabel">{awayName}</div>
                  <div className="pillValue smallVal">{pct(ko.toLiftTrophy?.awayWin)}</div>
                </div>
              </div>
              <TrophyBar
                home={ko.toLiftTrophy?.homeWin}
                away={ko.toLiftTrophy?.awayWin}
                homeName={homeName}
                awayName={awayName}
              />
            </div>
          ) : null}

          <ProbRow label="Season stats model" p={data?.modelProbabilities} homeName={homeName} awayName={awayName} />
          {hasMarket ? (
            <ProbRow label="Polymarket live odds" p={data?.marketProbabilities} homeName={homeName} awayName={awayName} />
          ) : null}

          <p className="muted small">
            {data?.model?.lambda
              ? `λ ${data.model.lambda.home} vs ${data.model.lambda.away} · ${data.model.note}`
              : 'Loading model…'}
          </p>
          {data?.dataSources?.teams?.home ? (
            <p className="muted small">
              Data: {data.dataSources.teams.home.season} season + {data.dataSources.teams.home.era} era (
              {Math.round((data.dataSources.catalog?.blendWeights?.historical ?? 0.2) * 100)}/
              {Math.round((data.dataSources.catalog?.blendWeights?.season2025_26 ?? 0.65) * 100)}/
              {Math.round((data.dataSources.catalog?.blendWeights?.formLast10 ?? 0.15) * 100)} blend)
            </p>
          ) : null}
        </section>

        <section className="glass card">
          <div className="cardTitle">Most likely scorelines</div>
          {loading && !data ? (
            <p className="muted">Loading scorelines…</p>
          ) : (
            <ol className="list">
              {(data?.scorelines ?? []).map((row) => (
                <li key={row.score}>
                  <div className="rowLine">
                    <span>{row.score}</span>
                    <span className="right">{row.probability.toFixed(1)}%</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="glass card verdictCard">
        <div className="cardTitle">Overall match verdict</div>
        <p className="verdictSummary">{data?.verdict?.summary ?? '—'}</p>
        {data?.verdict ? (
          <p className="muted small">
            {data.verdict.isDeadHeat ? (
              <>
                Level: <strong>{data.verdict.favorite}</strong> · Edge: none
              </>
            ) : (
              <>
                Favorite: <strong>{data.verdict.favorite}</strong> · Edge:{' '}
                {data.verdict.confidenceGap.toFixed(1)} pts
              </>
            )}
          </p>
        ) : null}
      </section>
    </section>
  );
}
