import { useEffect, useMemo, useState } from 'react';

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function fmt(n, dp = 1) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '-';
  return x.toFixed(dp);
}

function pct(n, dp = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '-';
  return `${x.toFixed(dp)}%`;
}

function StatBarRow({ label, homeName, homeValue, awayName, awayValue, max, unit, homeColorClass, awayColorClass }) {
  const hv = Number(homeValue);
  const av = Number(awayValue);
  const denom = max ?? Math.max(hv, av, 1);
  const hPct = clamp((hv / denom) * 100, 0, 100);
  const aPct = clamp((av / denom) * 100, 0, 100);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-white/90">{label}</div>
        <div className="text-xs text-white/70">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{homeName}</span>{' '}
          <span className="tabular-nums text-white/85">
            {fmt(hv, label === 'Possession' ? 0 : 1)}
            {unit ?? ''}
          </span>{' '}
          <span className="px-1 text-white/40">-</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{awayName}</span>{' '}
          <span className="tabular-nums text-white/85">
            {fmt(av, label === 'Possession' ? 0 : 1)}
            {unit ?? ''}
          </span>
        </div>
      </div>

      <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
        <div
          className={`h-full ${homeColorClass} transition-[width] duration-700 ease-out`}
          style={{ width: `${hPct}%` }}
          aria-hidden="true"
        />
        <div
          className={`h-full ${awayColorClass} transition-[width] duration-700 ease-out`}
          style={{ width: `${aPct}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function PlayerBar({ name, team, probability, colorClass }) {
  const p = clamp(Number(probability) || 0, 0, 100);
  return (
    <li className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white/90">{name}</div>
          <div className="text-xs text-white/60">{team}</div>
        </div>
        <div className="shrink-0 tabular-nums text-xs font-semibold text-white/80">{pct(p, 1)}</div>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
        <div className={`h-full ${colorClass} transition-[width] duration-700 ease-out`} style={{ width: `${p}%` }} aria-hidden="true" />
      </div>
    </li>
  );
}

/**
 * Module 2 — Match Stats
 * - Fetches from `/api/stats` (Next proxy -> Express `/api/stats`)
 * - Renders predicted match stats + anytime goalscorer probabilities
 */
export default function StatsPanel({ homeTeam = 'PSG', awayTeam = 'Arsenal', neutralVenue = true }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('homeTeam', homeTeam);
    sp.set('awayTeam', awayTeam);
    sp.set('neutralVenue', neutralVenue ? '1' : '0');
    return sp.toString();
  }, [homeTeam, awayTeam, neutralVenue]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stats?${qs}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Stats failed');
        if (mounted) setData(json);
      } catch (e) {
        if (mounted) setError(e?.message ?? String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [qs]);

  const fixture = data?.fixture;
  const stats = data?.predictedStats;
  const scorers = data?.goalscorers ?? [];

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-4 shadow-[0_26px_80px_rgba(0,0,0,.42)] backdrop-blur">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-base font-extrabold tracking-tight text-white/95">Match stats</div>
          <div className="text-xs text-white/65">
            Head-to-head predicted stats for {fixture?.homeTeam ?? homeTeam} vs {fixture?.awayTeam ?? awayTeam}
          </div>
        </div>
        <div className="text-[11px] text-white/55">Source: `/api/stats`</div>
      </div>

      {error ? <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-white/90">{error}</div> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="text-sm font-bold text-white/85">Predicted team stats</div>

          {loading || !stats ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">Loading stats…</div>
          ) : (
            <div className="space-y-2">
              <StatBarRow
                label="Possession"
                unit="%"
                homeName={fixture.homeTeam}
                homeValue={stats.home.possession}
                awayName={fixture.awayTeam}
                awayValue={stats.away.possession}
                max={62}
                homeColorClass="bg-violet-500/90"
                awayColorClass="bg-emerald-400/90"
              />
              <StatBarRow
                label="Shots"
                homeName={fixture.homeTeam}
                homeValue={stats.home.shots}
                awayName={fixture.awayTeam}
                awayValue={stats.away.shots}
                max={28}
                homeColorClass="bg-violet-500/90"
                awayColorClass="bg-emerald-400/90"
              />
              <StatBarRow
                label="Shots on target"
                homeName={fixture.homeTeam}
                homeValue={stats.home.shotsOnTarget}
                awayName={fixture.awayTeam}
                awayValue={stats.away.shotsOnTarget}
                max={12}
                homeColorClass="bg-violet-500/90"
                awayColorClass="bg-emerald-400/90"
              />
              <StatBarRow
                label="Corners"
                homeName={fixture.homeTeam}
                homeValue={stats.home.corners}
                awayName={fixture.awayTeam}
                awayValue={stats.away.corners}
                max={14}
                homeColorClass="bg-violet-500/90"
                awayColorClass="bg-emerald-400/90"
              />
              <StatBarRow
                label="xG"
                homeName={fixture.homeTeam}
                homeValue={stats.home.xG}
                awayName={fixture.awayTeam}
                awayValue={stats.away.xG}
                max={3.5}
                homeColorClass="bg-violet-500/90"
                awayColorClass="bg-emerald-400/90"
              />
              <StatBarRow
                label="Fouls"
                homeName={fixture.homeTeam}
                homeValue={stats.home.fouls}
                awayName={fixture.awayTeam}
                awayValue={stats.away.fouls}
                max={22}
                homeColorClass="bg-violet-500/90"
                awayColorClass="bg-emerald-400/90"
              />
            </div>
          )}

          <div className="text-xs text-white/55">Bars are scaled by typical UCL final ranges (not absolute maxima).</div>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-bold text-white/85">Anytime goalscorers</div>
            <div className="text-[11px] text-white/55">Animated probability bars</div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">Loading scorers…</div>
          ) : scorers.length ? (
            <ol className="space-y-2">
              {scorers.map((p) => (
                <PlayerBar
                  key={`${p.team}-${p.name}`}
                  name={p.name}
                  team={p.team}
                  probability={p.probability}
                  colorClass={p.team === fixture?.homeTeam ? 'bg-violet-500/90' : 'bg-emerald-400/90'}
                />
              ))}
            </ol>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">No goalscorer data.</div>
          )}

          <div className="text-xs text-white/55">
            Probabilities are derived from expected goals split by player xG share (starter + bench impact).
          </div>
        </div>
      </div>
    </section>
  );
}

