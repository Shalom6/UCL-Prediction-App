import { getDataCatalog, getTeamProfiles as buildProfiles } from './teamProfiles.js';

export { getDataCatalog };

export function getFixtureContext(body) {
  return {
    competition: 'UEFA Champions League',
    stage: 'Final',
    venueCity: body?.venueCity ?? 'Budapest',
    date: body?.date ?? 'May 30, 2026',
    homeTeam: body?.homeTeam ?? 'PSG',
    awayTeam: body?.awayTeam ?? 'Arsenal',
    neutralVenue: body?.neutralVenue ?? true,
    finalScale: 0.92,
    finalTempo: 0.95
  };
}

export function getTeamProfiles(homeTeamName, awayTeamName) {
  return buildProfiles(homeTeamName, awayTeamName);
}
