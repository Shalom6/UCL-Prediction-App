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
    const stats = buildStatsResponse({
      homeTeam,
      awayTeam,
      neutralVenue: neutralVenue !== false
    });
    return { ...bundle, stats: { predictedStats: stats.predictedStats, goalscorers: stats.goalscorers, dataSources: stats.dataSources } };
  } catch {
    return bundle;
  }
}
