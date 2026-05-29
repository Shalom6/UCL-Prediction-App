import { buildPrediction } from './predictor.js';
import { getFixtureContext, getTeamProfiles } from './sampleData.js';
import { fetchPolymarketOdds } from './polymarket.js';

/**
 * Predictions Engine: season-stats model + optional Polymarket blend.
 */
export async function buildPredictionsResponse(body) {
  const homeTeam = body?.homeTeam ?? 'PSG';
  const awayTeam = body?.awayTeam ?? 'Arsenal';
  if (homeTeam === awayTeam) {
    throw new Error('homeTeam and awayTeam must be different');
  }

  const fixture = getFixtureContext(body);
  const { home, away } = getTeamProfiles(fixture.homeTeam, fixture.awayTeam);

  const polymarket = body?.skipPolymarket ? null : await fetchPolymarketOdds(homeTeam, awayTeam);
  const marketFromPolymarket = polymarket?.found && polymarket?.implied ? polymarket.implied : null;
  const market = body?.market ?? marketFromPolymarket;

  const blend =
    body?.blend ??
    (market ? { marketWeight: 0.5, modelWeight: 0.5 } : { marketWeight: 0, modelWeight: 1 });

  const prediction = buildPrediction({
    fixture,
    home,
    away,
    market,
    blend
  });

  const modelProbabilities = prediction.model.outcome;
  const marketProbabilities = prediction.market;
  const probabilities = prediction.blended ?? modelProbabilities;

  const ranked = [
    { key: 'homeWin', label: prediction.fixture.homeTeam, value: probabilities.homeWin },
    { key: 'draw', label: 'Draw', value: probabilities.draw },
    { key: 'awayWin', label: prediction.fixture.awayTeam, value: probabilities.awayWin }
  ].sort((a, b) => b.value - a.value);

  const favorite = ranked[0];
  const runnerUp = ranked[1];
  const confidenceGap = Number((favorite.value - runnerUp.value).toFixed(1));

  let summary;
  if (favorite.key === 'draw') {
    summary = 'Draw is the most likely outcome in 90 minutes';
  } else {
    summary = `${favorite.label} are most likely to win in 90 minutes`;
  }

  if (market && blend.marketWeight > 0 && blend.modelWeight > 0) {
    summary += ` (blended: ${Math.round(blend.modelWeight * 100)}% model, ${Math.round(blend.marketWeight * 100)}% Polymarket)`;
  } else if (market) {
    summary += ' (Polymarket odds only)';
  }

  return {
    fixture: prediction.fixture,
    probabilities,
    modelProbabilities,
    marketProbabilities,
    scorelines: prediction.topScorelines,
    verdict: {
      summary,
      favorite: favorite.label,
      confidenceGap
    },
    model: {
      lambda: prediction.model.lambda,
      note: 'UCL season goals for/against per match (Poisson model, final-adjusted)'
    },
    polymarket,
    blend,
    updatedAt: new Date().toISOString()
  };
}
