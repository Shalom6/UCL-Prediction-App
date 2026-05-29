import { buildBettingCategories } from './bettingStats.js';
import { buildPlayerProps } from './playerProps.js';
import { buildPrediction, isGoalkeeperPlayer } from './predictor.js';
import { getFixtureContext, getTeamProfiles } from './sampleData.js';

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function round(n, dp = 1) {
  const p = 10 ** dp;
  return Math.round(n * p) / p;
}

function estimateFouls({ home, away, fixture }) {
  const finalTempo = fixture?.finalTempo ?? 0.95;
  const homeControl = home?.control ?? 0.5;
  const awayControl = away?.control ?? 0.5;
  const shareHome = clamp(homeControl / (homeControl + awayControl || 1), 0.35, 0.65);
  const baseTotal = 24 * finalTempo;
  const homeShare = clamp(0.5 - (shareHome - 0.5) * 0.6, 0.42, 0.58);
  return {
    home: round(clamp(baseTotal * homeShare, 8, 20), 1),
    away: round(clamp(baseTotal * (1 - homeShare), 8, 20), 1)
  };
}

function estimateOffsides(homeShots, awayShots) {
  return {
    home: round(clamp(homeShots * 0.11 + 1.1, 0.8, 5.5), 1),
    away: round(clamp(awayShots * 0.11 + 1.1, 0.8, 5.5), 1)
  };
}

function estimateCards({ home, away, fixture }) {
  const tempo = fixture?.finalTempo ?? 0.95;
  const baseTotal = 4.4 * tempo * 1.08;
  const homeShare = clamp(1 - (home.control ?? 0.5) + 0.08, 0.42, 0.58);
  const homeYellow = clamp(baseTotal * homeShare, 1.4, 3.8);
  const awayYellow = clamp(baseTotal * (1 - homeShare), 1.4, 3.8);
  return {
    home: {
      yellowCards: round(homeYellow, 1),
      bookingPoints: round(homeYellow * 10, 0)
    },
    away: {
      yellowCards: round(awayYellow, 1),
      bookingPoints: round(awayYellow * 10, 0)
    }
  };
}

function assistWeight(player) {
  const pos = String(player?.position ?? '').toLowerCase();
  const xg = player?.xgShare ?? 0.05;
  if (pos.includes('midfield')) return xg * 1.5 + 0.06;
  if (pos.includes('defender')) return xg * 0.5 + 0.03;
  if (pos.includes('attack') || pos.includes('forward')) return xg * 0.85 + 0.02;
  return xg;
}

export function assistProbabilities(team, expectedGoals) {
  const players =
    team.players?.filter((p) => (p.likelyStarter || p.benchImpact) && !isGoalkeeperPlayer(p)) ?? [];
  const weights = players.map((p) => assistWeight(p));
  const total = weights.reduce((a, w) => a + w, 0) || 1;
  const teamAssistLambda = expectedGoals * 0.82;

  const out = players.map((p, i) => {
    const share = weights[i] / total;
    const playerLambda = teamAssistLambda * share * (p.minutesFactor ?? 0.8);
    return {
      name: p.name,
      team: team.name,
      probability: round((1 - Math.exp(-playerLambda)) * 100, 1)
    };
  });

  return out.sort((a, b) => b.probability - a.probability);
}

function buildExtendedStats({ prediction, home, away, fixture }) {
  const base = prediction.expectedStats;
  const lh = prediction.model.lambda.home;
  const la = prediction.model.lambda.away;
  const fouls = estimateFouls({ home, away, fixture });
  const offsides = estimateOffsides(base.home.shots, base.away.shots);
  const cards = estimateCards({ home, away, fixture });

  return {
    home: {
      goals: round(lh, 2),
      shots: base.home.shots,
      shotsOnTarget: base.home.shotsOnTarget,
      corners: base.home.corners,
      fouls: fouls.home,
      offsides: offsides.home,
      yellowCards: cards.home.yellowCards,
      bookingPoints: cards.home.bookingPoints,
      possession: base.home.possession
    },
    away: {
      goals: round(la, 2),
      shots: base.away.shots,
      shotsOnTarget: base.away.shotsOnTarget,
      corners: base.away.corners,
      fouls: fouls.away,
      offsides: offsides.away,
      yellowCards: cards.away.yellowCards,
      bookingPoints: cards.away.bookingPoints,
      possession: base.away.possession
    }
  };
}

export function buildStatsResponse(query) {
  const fixture = getFixtureContext({
    homeTeam: query?.homeTeam,
    awayTeam: query?.awayTeam,
    venueCity: query?.venueCity,
    date: query?.date,
    neutralVenue:
      query?.neutralVenue === undefined ? undefined : String(query.neutralVenue) !== '0'
  });

  const { home, away } = getTeamProfiles(fixture.homeTeam, fixture.awayTeam);
  const prediction = buildPrediction({
    fixture,
    home,
    away,
    market: null,
    blend: { marketWeight: 0, modelWeight: 1 }
  });

  const predictedStats = buildExtendedStats({ prediction, home, away, fixture });
  const lh = prediction.model.lambda.home;
  const la = prediction.model.lambda.away;

  const scorerHome = prediction.topScorers.filter((s) => s.team === home.name);
  const scorerAway = prediction.topScorers.filter((s) => s.team === away.name);
  const allScorers = [...scorerHome, ...scorerAway]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 10);

  const assistHome = assistProbabilities(home, lh);
  const assistAway = assistProbabilities(away, la);
  const topAssists = [...assistHome.slice(0, 5), ...assistAway.slice(0, 5)]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 10);

  const bettingCategories = buildBettingCategories({
    fixture: prediction.fixture,
    predictedStats,
    lambdas: { home: lh, away: la }
  });

  const playerProps = buildPlayerProps({
    home,
    away,
    predictedStats,
    lambdas: { home: lh, away: la }
  });

  const matchFromCats = {
    goals: round(lh + la, 2),
    shots: round(predictedStats.home.shots + predictedStats.away.shots, 1),
    shotsOnTarget: round(predictedStats.home.shotsOnTarget + predictedStats.away.shotsOnTarget, 1),
    corners: round(predictedStats.home.corners + predictedStats.away.corners, 1),
    fouls: round(predictedStats.home.fouls + predictedStats.away.fouls, 1),
    offsides: round(predictedStats.home.offsides + predictedStats.away.offsides, 1),
    yellowCards: round(predictedStats.home.yellowCards + predictedStats.away.yellowCards, 1),
    bookingPoints: predictedStats.home.bookingPoints + predictedStats.away.bookingPoints
  };

  return {
    fixture: prediction.fixture,
    predictedStats: { ...predictedStats, match: matchFromCats },
    bettingCategories,
    playerProps,
    goalscorers: allScorers.length ? allScorers : prediction.topScorers,
    assisters: topAssists,
    rosterSeason: '2025-26',
    dataSources: {
      home: home.dataProvenance,
      away: away.dataProvenance
    }
  };
}
