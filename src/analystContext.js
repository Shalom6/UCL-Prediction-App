import { buildStatsResponse } from './stats.js';

/**
 * Full context bundle for the AI analyst (any question type).
 */
const DEFAULT_FIXTURE = {
  homeTeam: 'PSG',
  awayTeam: 'Arsenal',
  competition: 'UEFA Champions League',
  stage: 'Final',
  venueCity: 'Budapest',
  date: 'May 30, 2026',
  neutralVenue: true
};

export function buildAnalystBundle({ prediction = null, polymarket = null, stats = null }) {
  if (!prediction && !polymarket) return null;

  const pm = polymarket ?? prediction?.polymarket ?? null;
  const fixture = prediction?.fixture ?? {
    ...DEFAULT_FIXTURE,
    homeTeam: pm?.homeTeam ?? DEFAULT_FIXTURE.homeTeam,
    awayTeam: pm?.awayTeam ?? DEFAULT_FIXTURE.awayTeam
  };

  return {
    fixture,
    probabilities: prediction?.probabilities ?? null,
    modelProbabilities: prediction?.modelProbabilities ?? null,
    marketProbabilities: prediction?.marketProbabilities ?? pm?.implied ?? null,
    scorelines: prediction?.scorelines ?? [],
    verdict: prediction?.verdict ?? null,
    model: prediction?.model ?? null,
    blend: prediction?.blend ?? null,
    polymarket: pm,
    stats: stats
      ? {
          predictedStats: stats.predictedStats,
          goalscorers: stats.goalscorers,
          assisters: stats.assisters,
          bettingCategories: stats.bettingCategories,
          playerProps: stats.playerProps,
          rosterSeason: stats.rosterSeason,
          dataSources: stats.dataSources
        }
      : null,
    dataSources: prediction?.dataSources ?? null,
    updatedAt: prediction?.updatedAt ?? null
  };
}

export async function enrichAnalystBundle(bundle) {
  if (!bundle?.fixture) return bundle;
  const { homeTeam, awayTeam, neutralVenue } = bundle.fixture;
  if (bundle.stats?.predictedStats) return bundle;

  try {
    const stats = await buildStatsResponse({
      homeTeam,
      awayTeam,
      neutralVenue: neutralVenue !== false
    });
    return {
      ...bundle,
      stats: {
        predictedStats: stats.predictedStats,
        goalscorers: stats.goalscorers,
        assisters: stats.assisters,
        bettingCategories: stats.bettingCategories,
        playerProps: stats.playerProps,
        blendNote: stats.blendNote,
        statsBlend: stats.statsBlend,
        rosterSeason: stats.rosterSeason,
        dataSources: stats.dataSources
      }
    };
  } catch {
    return bundle;
  }
}

function topPlayerPropLines(player, maxLines = 3) {
  return (player.lines ?? []).slice(0, maxLines).map((l) => ({
    line: l.line,
    overPct: l.overPct
  }));
}

/** Slim context for LLM — full stats JSON exceeds Groq on-demand TPM limits. */
export function compactAnalystBundle(bundle) {
  if (!bundle) return null;

  const stats = bundle.stats;
  const playerGoals = stats?.playerProps?.categories?.find((c) => c.id === 'playerGoals')?.players ?? [];

  return {
    fixture: bundle.fixture,
    probabilities: bundle.probabilities,
    modelProbabilities: bundle.modelProbabilities,
    marketProbabilities: bundle.marketProbabilities,
    knockout: bundle.knockout ?? null,
    scorelines: (bundle.scorelines ?? []).slice(0, 7),
    verdict: bundle.verdict,
    model: bundle.model,
    blend: bundle.blend,
    polymarket: bundle.polymarket
      ? {
          found: bundle.polymarket.found,
          source: bundle.polymarket.source,
          marketQuestion: bundle.polymarket.marketQuestion,
          implied: bundle.polymarket.implied ?? bundle.marketProbabilities
        }
      : null,
    stats: stats
      ? {
          matchTotals: stats.predictedStats?.match ?? null,
          home: stats.predictedStats?.home ?? null,
          away: stats.predictedStats?.away ?? null,
          goalscorers: (stats.goalscorers ?? []).slice(0, 10),
          assisters: (stats.assisters ?? []).slice(0, 8),
          playerProps: (stats.playerProps?.categories ?? []).map((cat) => ({
            id: cat.id,
            label: cat.label,
            players: (cat.players ?? []).slice(0, 6).map((p) => ({
              name: p.name,
              team: p.team,
              expected: p.expected,
              anytimePct: p.anytimePct,
              lines: topPlayerPropLines(p)
            }))
          })),
          rosterSeason: stats.rosterSeason
        }
      : null,
    dataSources: bundle.dataSources
      ? {
          home: bundle.dataSources.home?.source,
          away: bundle.dataSources.away?.source
        }
      : null
  };
}
