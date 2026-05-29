import { buildPrediction, computeKnockoutResolution } from './predictor.js';
import { getDataCatalog, getFixtureContext, getTeamProfiles } from './sampleData.js';
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

  const knockout = computeKnockoutResolution(
    prediction.model.lambda.home,
    prediction.model.lambda.away,
    probabilities
  );

  const trophyRanked = [
    { key: 'homeWin', label: prediction.fixture.homeTeam, value: knockout.toLiftTrophy.homeWin },
    { key: 'awayWin', label: prediction.fixture.awayTeam, value: knockout.toLiftTrophy.awayWin }
  ].sort((a, b) => b.value - a.value);

  const trophyFavorite = trophyRanked[0];
  const trophyRunnerUp = trophyRanked[1];
  const trophyGap = Number((trophyFavorite.value - trophyRunnerUp.value).toFixed(1));
  const TIE_THRESHOLD = 0.5;
  const isDeadHeat = trophyGap < TIE_THRESHOLD;

  let summary;
  let favoriteLabel = trophyFavorite.label;

  if (isDeadHeat) {
    favoriteLabel = `${trophyFavorite.label} / ${trophyRunnerUp.label}`;
    summary = `${trophyFavorite.label} and ${trophyRunnerUp.label} are neck and neck to lift the trophy`;
  } else {
    summary = `${trophyFavorite.label} most likely to win the final (incl. extra time & penalties if needed)`;
  }

  if (knockout.extraTimePct >= 8) {
    summary += ` · ${knockout.extraTimePct}% chance of extra time`;
  }
  if (knockout.penaltiesPct >= 4) {
    summary += ` · ${knockout.penaltiesPct}% chance of penalties`;
  }

  if (market && blend.marketWeight > 0 && blend.modelWeight > 0) {
    summary += ` (90-min blend: ${Math.round(blend.modelWeight * 100)}% model, ${Math.round(blend.marketWeight * 100)}% Polymarket)`;
  } else if (market) {
    summary += ' (90-min: Polymarket odds only)';
  }

  const ranked90 = [
    { key: 'homeWin', label: prediction.fixture.homeTeam, value: probabilities.homeWin },
    { key: 'draw', label: 'Draw', value: probabilities.draw },
    { key: 'awayWin', label: prediction.fixture.awayTeam, value: probabilities.awayWin }
  ].sort((a, b) => b.value - a.value);

  return {
    fixture: prediction.fixture,
    probabilities,
    regulationProbabilities: probabilities,
    knockout,
    modelProbabilities,
    marketProbabilities,
    scorelines: prediction.topScorelines,
    verdict: {
      summary,
      favorite: favoriteLabel,
      confidenceGap: isDeadHeat ? 0 : trophyGap,
      isDeadHeat,
      regulationFavorite: ranked90[0].label
    },
    model: {
      lambda: prediction.model.lambda,
      note: 'Poisson model using blended historical (2000-26) + 2025-26 form & rosters'
    },
    polymarket,
    blend,
    dataSources: {
      teams: {
        home: home.dataProvenance,
        away: away.dataProvenance
      },
      catalog: getDataCatalog()
    },
    updatedAt: new Date().toISOString()
  };
}
