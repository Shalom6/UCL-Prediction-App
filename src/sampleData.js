function team(name, overrides = {}) {
  return {
    name,
    goalsForPerMatch: 1.75,
    goalsAgainstPerMatch: 1.05,
    xgPerGoal: 1.05,
    xgPerShot: 0.1,
    sotRate: 0.34,
    cornersPerShot: 0.22,
    control: 0.5,
    players: [],
    ...overrides
  };
}

export function getFixtureContext(body) {
  return {
    competition: 'UEFA Champions League',
    stage: 'Final',
    venueCity: body?.venueCity ?? 'Budapest',
    date: body?.date ?? 'May 30',
    homeTeam: body?.homeTeam ?? 'PSG',
    awayTeam: body?.awayTeam ?? 'Arsenal',
    neutralVenue: body?.neutralVenue ?? true,
    finalScale: 0.92,
    finalTempo: 0.95
  };
}

export function getTeamProfiles(homeTeamName, awayTeamName) {
  const PSG = team('PSG', {
    goalsForPerMatch: 2.05,
    goalsAgainstPerMatch: 1.1,
    xgPerShot: 0.11,
    sotRate: 0.36,
    cornersPerShot: 0.24,
    control: 0.53,
    players: [
      { name: 'O. Dembele', xgShare: 0.21, likelyStarter: true, minutesFactor: 0.95 },
      { name: 'K. Mbappe', xgShare: 0.28, likelyStarter: true, minutesFactor: 0.98 },
      { name: 'G. Ramos', xgShare: 0.18, likelyStarter: true, minutesFactor: 0.85 },
      { name: 'B. Barcola', xgShare: 0.12, likelyStarter: true, minutesFactor: 0.8 },
      { name: 'V. Vitinha', xgShare: 0.06, likelyStarter: true, minutesFactor: 0.9 },
      { name: 'Sub forward', xgShare: 0.15, benchImpact: true, minutesFactor: 0.3 }
    ]
  });

  const Arsenal = team('Arsenal', {
    goalsForPerMatch: 1.7,
    goalsAgainstPerMatch: 0.85,
    xgPerShot: 0.1,
    sotRate: 0.35,
    cornersPerShot: 0.25,
    control: 0.55,
    players: [
      { name: 'B. Saka', xgShare: 0.2, likelyStarter: true, minutesFactor: 0.98 },
      { name: 'G. Martinelli', xgShare: 0.14, likelyStarter: true, minutesFactor: 0.9 },
      { name: 'K. Havertz', xgShare: 0.19, likelyStarter: true, minutesFactor: 0.88 },
      { name: 'M. Odegaard', xgShare: 0.1, likelyStarter: true, minutesFactor: 0.95 },
      { name: 'G. Jesus', xgShare: 0.12, likelyStarter: true, minutesFactor: 0.75 },
      { name: 'Sub striker', xgShare: 0.25, benchImpact: true, minutesFactor: 0.28 }
    ]
  });

  const byName = new Map([
    ['PSG', PSG],
    ['Arsenal', Arsenal]
  ]);

  const home = byName.get(homeTeamName) ?? team(homeTeamName);
  const away = byName.get(awayTeamName) ?? team(awayTeamName);
  return { home, away };
}

