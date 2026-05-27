'use client';

import { useEffect, useMemo, useState } from 'react';

const TEAM_OPTIONS = ['PSG', 'Arsenal'];

function fmtPct(n) {
  if (typeof n !== 'number') return '-';
  return `${n.toFixed(1)}%`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function Bar({ home, draw, away }) {
  const h = clamp(home ?? 0, 0, 100);
  const d = clamp(draw ?? 0, 0, 100);
  const a = clamp(away ?? 0, 0, 100);
  return (
    <div className="probBar" aria-label="Probability bar">
      <div className="seg home" style={{ width: `${h}%` }} />
      <div className="seg draw" style={{ width: `${d}%` }} />
      <div className="seg away" style={{ width: `${a}%` }} />
    </div>
  );
}

function StatRow({ label, aName, a, bName, b, max }) {
  const av = Number(a);
  const bv = Number(b);
  const denom = max ?? Math.max(av, bv, 1);
  const ap = (av / denom) * 100;
  const bp = (bv / denom) * 100;

  return (
    <div className="statRow">
      <div className="statHead">
        <div className="statLabel">{label}</div>
        <div className="statVals">
          <span className="tag">{aName}</span> {a} <span className="dot">-</span> <span className="tag">{bName}</span> {b}
        </div>
      </div>
      <div className="statBar" role="presentation">
        <div className="fill a" style={{ width: `${ap}%` }} />
        <div className="fill b" style={{ width: `${bp}%` }} />
      </div>
    </div>
  );
}

export default function Page() {
  const [homeTeam, setHomeTeam] = useState('PSG');
  const [awayTeam, setAwayTeam] = useState('Arsenal');
  const [neutralVenue, setNeutralVenue] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pred, setPred] = useState(null);
  const [error, setError] = useState(null);

  const canPredict = homeTeam !== awayTeam;

  const subtitle = useMemo(() => {
    if (!pred) return 'UEFA Champions League - Final - Budapest - May 30';
    const f = pred.fixture;
    return `${f.competition} - ${f.stage} - ${f.venueCity} - ${f.date}`;
  }, [pred]);

  async function run() {
    if (!canPredict) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam,
          awayTeam,
          neutralVenue,
          market: null,
          blend: { marketWeight: 0.0, modelWeight: 1.0 }
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Prediction failed');
      setPred(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const p = pred?.blended ?? pred?.model?.outcome ?? null;
  const stats = pred?.expectedStats ?? null;

  return (
    <div className="app">
      <header className="nav glass">
        <div className="navLeft">
          <div className="appIcon" aria-hidden="true">
            <div className="appIconInner">⚽</div>
          </div>
          <div className="navTitleWrap">
            <div className="navTitle">UCL Final Predictor</div>
            <div className="navSubtitle">{subtitle}</div>
          </div>
        </div>
        <div className="navRight">
          <button className="btnPrimary" disabled={!canPredict || loading} onClick={run}>
            {loading ? 'Predicting...' : 'Predict'}
          </button>
        </div>
      </header>

      <section className="glass controls">
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
              <div className="chev" aria-hidden="true">v</div>
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
              <div className="chev" aria-hidden="true">v</div>
            </div>
          </div>

          <div className="control toggleControl">
            <div className="controlLabel">Venue</div>
            <label className="toggle">
              <input checked={neutralVenue} onChange={(e) => setNeutralVenue(e.target.checked)} type="checkbox" />
              <span className="track" aria-hidden="true" />
              <span className="toggleText">Neutral</span>
            </label>
          </div>
        </div>

        {!canPredict ? <div className="error">Pick two different teams.</div> : null}
        {error ? <div className="error">{error}</div> : null}
      </section>

      <main className="grid">
        <section className="glass card">
          <div className="cardTitle">Win probabilities</div>
          <div className="triple">
            <div className="pill">
              <div className="pillLabel">{pred?.fixture?.homeTeam ?? 'Home'}</div>
              <div className="pillValue">{fmtPct(p?.homeWin)}</div>
            </div>
            <div className="pill">
              <div className="pillLabel">Draw</div>
              <div className="pillValue">{fmtPct(p?.draw)}</div>
            </div>
            <div className="pill">
              <div className="pillLabel">{pred?.fixture?.awayTeam ?? 'Away'}</div>
              <div className="pillValue">{fmtPct(p?.awayWin)}</div>
            </div>
          </div>
          <Bar home={p?.homeWin} draw={p?.draw} away={p?.awayWin} />
          <div className="muted small">
            {pred?.model?.lambda
              ? `Model lambda: ${pred.model.lambda.home.toFixed(2)} vs ${pred.model.lambda.away.toFixed(2)} (final-scaled Poisson).`
              : 'Model: -'}
          </div>
        </section>

        <section className="glass card">
          <div className="cardTitle">Expected match stats</div>
          {stats ? (
            <div className="statsGrid">
              <StatRow label="xG" aName={pred.fixture.homeTeam} a={stats.home.xG} bName={pred.fixture.awayTeam} b={stats.away.xG} max={3.5} />
              <StatRow label="Shots" aName={pred.fixture.homeTeam} a={stats.home.shots} bName={pred.fixture.awayTeam} b={stats.away.shots} max={28} />
              <StatRow label="Shots on target" aName={pred.fixture.homeTeam} a={stats.home.shotsOnTarget} bName={pred.fixture.awayTeam} b={stats.away.shotsOnTarget} max={12} />
              <StatRow label="Corners" aName={pred.fixture.homeTeam} a={stats.home.corners} bName={pred.fixture.awayTeam} b={stats.away.corners} max={14} />
              <StatRow label="Possession (%)" aName={pred.fixture.homeTeam} a={stats.home.possession} bName={pred.fixture.awayTeam} b={stats.away.possession} max={62} />
            </div>
          ) : (
            <div className="muted">Loading...</div>
          )}
          <div className="muted small">Expectation values based on team profiles + final context.</div>
        </section>

        <section className="glass card">
          <div className="cardTitle">Most likely scorelines</div>
          <ol className="list">
            {(pred?.topScorelines ?? []).map((x) => (
              <li key={x.score}>
                <div className="rowLine">
                  <div>{x.score}</div>
                  <div className="right">{x.probability.toFixed(1)}%</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="glass card">
          <div className="cardTitle">Anytime goalscorers</div>
          <ol className="list">
            {(pred?.topScorers ?? []).map((x) => (
              <li key={`${x.team}-${x.name}`}>
                <div className="rowLine">
                  <div>
                    {x.name} <span className="muted">({x.team})</span>
                  </div>
                  <div className="right">{x.probability.toFixed(1)}%</div>
                </div>
              </li>
            ))}
          </ol>
          <div className="muted small">Derived from team expected goals split by player xG share.</div>
        </section>
      </main>

      <footer className="footer muted">
        Root Next.js UI + Express API. For max accuracy, swap `src/sampleData.js` with real API aggregates and blend with market odds.
      </footer>
    </div>
  );
}

